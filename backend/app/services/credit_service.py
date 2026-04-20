from datetime import datetime
import re

from ..models.certificate import Certificate, CertStatus
from ..models.credit_rule import CreditRule
from ..models.student_credit import CreditHistoryEntry, StudentCredit
from ..models.user import User, UserRole


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

    entry = CreditHistoryEntry(
        cert_number=certificate.cert_number,
        event_name=certificate.snapshot.event_name,
        club_name=certificate.snapshot.club_name,
        cert_type=certificate.snapshot.cert_type,
        points_awarded=rule.points,
        awarded_at=datetime.utcnow(),
    )

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

        credit_doc.total_credits += rule.points
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
            total_credits=rule.points,
            credit_history=[entry],
            last_updated=datetime.utcnow(),
        ).insert()
