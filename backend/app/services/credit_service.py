from datetime import datetime
import re

from ..models.certificate import Certificate, CertStatus
from ..models.credit_rule import CreditRule
from ..models.student_credit import CreditHistoryEntry, StudentCredit
from ..models.user import User, UserRole
from ..services.semester_service import get_current_semester


def _same_credit_rule(left: CreditRule | None, right: CreditRule) -> bool:
    return bool(left and str(left.id) == str(right.id))


def _norm_email(value: str | None) -> str:
    return (value or "").strip().lower()


def _norm_cert_type(value: str | None) -> str:
    return (value or "").strip().lower().replace("-", "_").replace(" ", "_")


async def _resolve_credit_rule(cert_type_raw: str) -> CreditRule | None:
    normalized = _norm_cert_type(cert_type_raw)
    spaced = normalized.replace("_", " ")
    display = spaced.title() if normalized else cert_type_raw

    # Deterministic lookup order prevents random matches when DB has mixed variants.
    candidates = [
        cert_type_raw,
        normalized,
        spaced,
        display,
    ]
    if normalized in {"volunteer", "student_volunteer"}:
        candidates.extend(["student_volunteer", "Student Volunteer", "student volunteer", "volunteer", "Volunteer"])
    seen = set()
    for candidate in candidates:
        key = (candidate or "").strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        rule = await CreditRule.find_one({
            "cert_type": {"$regex": f"^{re.escape(candidate)}$", "$options": "i"}
        })
        if rule:
            return rule
    return None


async def capped_credit_points(
    student_credit: StudentCredit | None,
    cert_type: str,
    semester: str,
    requested_points: int,
    exclude_cert_number: str | None = None,
) -> int:
    """Return zero when this student has already reached the rule's semester cap."""
    if requested_points <= 0:
        return 0

    rule = await _resolve_credit_rule(cert_type)
    if not rule or rule.max_certificates is None or not student_credit:
        return requested_points

    matching_count = 0
    resolved_types: dict[str, bool] = {}
    for entry in student_credit.credit_history:
        if (
            entry.semester != semester
            or entry.points_awarded <= 0
            or entry.cert_number == exclude_cert_number
        ):
            continue

        normalized_type = _norm_cert_type(entry.cert_type)
        if normalized_type not in resolved_types:
            prior_rule = await _resolve_credit_rule(entry.cert_type)
            resolved_types[normalized_type] = bool(
                prior_rule and str(prior_rule.id) == str(rule.id)
            )
        if resolved_types[normalized_type]:
            matching_count += 1
            if matching_count >= rule.max_certificates:
                return 0

    return requested_points


async def recalculate_credit_rule_cap(rule: CreditRule) -> dict[str, int]:
    """Reapply a rule's certificate cap to existing credit history."""
    credit_docs = await StudentCredit.find_all().to_list()
    parent = list(range(len(credit_docs)))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left: int, right: int) -> None:
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    identity_owner: dict[tuple[str, str], int] = {}
    for index, credit_doc in enumerate(credit_docs):
        identities = []
        email = _norm_email(credit_doc.student_email)
        registration_number = (credit_doc.registration_number or "").strip().lower()
        if email:
            identities.append(("email", email))
        if registration_number:
            identities.append(("registration_number", registration_number))
        for identity in identities:
            previous = identity_owner.setdefault(identity, index)
            union(index, previous)

    grouped_docs: dict[int, list[StudentCredit]] = {}
    for index, credit_doc in enumerate(credit_docs):
        grouped_docs.setdefault(find(index), []).append(credit_doc)

    students_updated = 0
    certificates_updated = 0
    points_adjusted = 0
    rule_cache: dict[str, bool] = {}

    for student_docs in grouped_docs.values():
        entries_by_semester: dict[str, dict[str, list[tuple[StudentCredit, CreditHistoryEntry]]]] = {}
        for credit_doc in student_docs:
            for entry in credit_doc.credit_history or []:
                normalized_type = _norm_cert_type(entry.cert_type)
                if normalized_type not in rule_cache:
                    entry_rule = await _resolve_credit_rule(entry.cert_type)
                    rule_cache[normalized_type] = _same_credit_rule(entry_rule, rule)
                if not rule_cache[normalized_type]:
                    continue

                semester = (entry.semester or "Unknown").strip() or "Unknown"
                certificate_key = entry.cert_number or f"manual::{entry.awarded_at.isoformat()}::{normalized_type}"
                entries_by_semester.setdefault(semester, {}).setdefault(certificate_key, []).append(
                    (credit_doc, entry)
                )

        docs_changed: set[str] = set()
        for certificate_entries in entries_by_semester.values():
            certificate_groups = []
            for certificate_key, linked_entries in certificate_entries.items():
                eligible_points = max(
                    int(entry.eligible_points if entry.eligible_points is not None else entry.points_awarded or 0)
                    for _, entry in linked_entries
                )
                awarded_at = min(entry.awarded_at for _, entry in linked_entries)
                certificate_groups.append((awarded_at, certificate_key, eligible_points, linked_entries))

            certificate_groups.sort(key=lambda item: (item[0], item[1]))
            eligible_count = 0
            for _, _, eligible_points, linked_entries in certificate_groups:
                capped_points = 0
                if eligible_points > 0 and (
                    rule.max_certificates is None or eligible_count < rule.max_certificates
                ):
                    capped_points = eligible_points
                    if rule.max_certificates is not None:
                        eligible_count += 1

                for credit_doc, entry in linked_entries:
                    old_points = int(entry.points_awarded or 0)
                    if entry.eligible_points != eligible_points or old_points != capped_points:
                        entry.eligible_points = eligible_points
                        entry.points_awarded = capped_points
                        docs_changed.add(str(credit_doc.id))
                        certificates_updated += 1
                        points_adjusted += abs(old_points - capped_points)

        for credit_doc in student_docs:
            if str(credit_doc.id) not in docs_changed:
                continue
            credit_doc.total_credits = sum(int(entry.points_awarded or 0) for entry in credit_doc.credit_history)
            credit_doc.last_updated = datetime.utcnow()
            await credit_doc.save()
            students_updated += 1

    return {
        "students_updated": students_updated,
        "certificates_updated": certificates_updated,
        "points_adjusted": points_adjusted,
    }


async def award_credits(certificate: Certificate) -> None:
    """Look up the credit rule for this cert_type and award points
    to the student's credit ledger.

    If no rule exists for the cert_type, this is a no-op.
    """
    if certificate.status != CertStatus.EMAILED:
        return

    cert_type_raw = (certificate.snapshot.cert_type or "").strip()
    rule = await _resolve_credit_rule(cert_type_raw)
    if not rule or rule.points <= 0:
        return

    email = _norm_email(certificate.snapshot.email)
    reg_no = (certificate.snapshot.registration_number or "").strip() or None
    if not email:
        return

    credit_doc = await StudentCredit.find_one(
        StudentCredit.student_email == email,
    )
    if not credit_doc and reg_no:
        credit_doc = await StudentCredit.find_one(
            StudentCredit.registration_number == reg_no,
        )

    user_student = await User.find_one({
        "$or": [
            {
                "email": {"$regex": f"^{re.escape(email)}$", "$options": "i"},
                "role": UserRole.STUDENT,
            },
            {
                "registration_number": reg_no,
                "role": UserRole.STUDENT,
            } if reg_no else {"_id": None},
        ]
    })

    mapped_doc_for_reg = None
    if reg_no:
        mapped_doc_for_reg = await StudentCredit.find_one({
            "registration_number": reg_no,
            "tutor_email": {"$ne": None},
        })

    semester = await get_current_semester() or "Unknown"
    if credit_doc:
        if any(h.cert_number == certificate.cert_number for h in credit_doc.credit_history):
            return

        updates = {}
        if not credit_doc.registration_number and reg_no:
            updates["registration_number"] = reg_no
        if (not credit_doc.student_name) and certificate.snapshot.name:
            updates["student_name"] = certificate.snapshot.name

        # Keep tutor mapping/profile data in sync from canonical student user.
        if user_student:
            if not credit_doc.department and user_student.department:
                updates["department"] = user_student.department
            if not credit_doc.batch and user_student.batch:
                updates["batch"] = user_student.batch
            if not credit_doc.section and user_student.section:
                updates["section"] = user_student.section
        if not credit_doc.tutor_email and mapped_doc_for_reg and mapped_doc_for_reg.tutor_email:
            updates["tutor_email"] = mapped_doc_for_reg.tutor_email

        # If this doc was found by registration number, avoid creating a split ledger by email.
        if credit_doc.student_email and credit_doc.student_email != email and reg_no and credit_doc.registration_number == reg_no:
            pass

        if updates:
            await credit_doc.set(updates)
            credit_doc = await StudentCredit.get(credit_doc.id)

    awarded_points = await capped_credit_points(
        credit_doc,
        cert_type_raw,
        semester,
        rule.points,
    )
    entry = CreditHistoryEntry(
        cert_number=certificate.cert_number,
        event_name=certificate.snapshot.event_name,
        club_name=certificate.snapshot.club_name,
        cert_type=certificate.snapshot.cert_type,
        points_awarded=awarded_points,
        eligible_points=rule.points,
        semester=semester,
        awarded_at=datetime.utcnow(),
    )

    if credit_doc:
        credit_doc.total_credits += awarded_points
        credit_doc.credit_history.append(entry)
        credit_doc.last_updated = datetime.utcnow()
        await credit_doc.save()
    else:
        canonical_email = _norm_email(user_student.email) if user_student and user_student.email else email
        await StudentCredit(
            student_email=canonical_email,
            tutor_email=(mapped_doc_for_reg.tutor_email if mapped_doc_for_reg and mapped_doc_for_reg.tutor_email else None),
            registration_number=reg_no,
            student_name=(user_student.name if user_student and user_student.name else certificate.snapshot.name),
            department=(user_student.department if user_student else None),
            batch=(user_student.batch if user_student else None),
            section=(user_student.section if user_student else None),
            total_credits=awarded_points,
            credit_history=[entry],
            last_updated=datetime.utcnow(),
        ).insert()
