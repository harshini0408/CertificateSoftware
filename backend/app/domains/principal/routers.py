import re
from datetime import datetime
from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...core.dependencies import require_role
from ...models.user import User, UserRole
from ...models.student_credit import StudentCredit
from ...models.certificate import Certificate, CertStatus
from ...models.club import Club
from ...models.event import Event
from ...models.dept_event import DeptEvent
from ...models.dept_certificate import DeptCertificate
from ...models.credit_rule import CreditRule
from ...models.manual_credit_submission import ManualCreditSubmission
from ...services.semester_service import get_current_semester

router = APIRouter(prefix="/principal", tags=["Principal"])

_principal = Depends(require_role(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN))


def _student_summary(user: User, total_credits: int) -> dict:
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "registration_number": user.registration_number,
        "department": user.department,
        "batch": user.batch,
        "section": user.section,
        "total_credits": int(total_credits or 0),
    }


def _normalize_cert_type(value: str | None) -> str:
    return (value or "").strip().lower().replace("-", "_").replace(" ", "_")


DEFAULT_ROLE_POINTS: dict[str, int] = {
    "class_representative": 3,
    "club_member": 2,
    "coordinator": 3,
    "first_place": 5,
    "non_technical_participant": 2,
    "office_bearer": 3,
    "organizer": 5,
    "paper_presenter": 3,
    "second_place": 5,
    "student_council_member": 5,
    "student_volunteer": 2,
    "technical_talk": 2,
    "technical_participant": 2,
    "third_place": 5,
    "workshop": 3,
}


@router.get("/students")
async def list_students(
    department: Optional[str] = None,
    batch: Optional[str] = None,
    class_name: Optional[str] = Query(default=None, alias="class"),
    search: Optional[str] = None,
    _user: User = _principal,
):
    query: dict = {
        "role": UserRole.STUDENT,
        "is_active": True,
    }

    if department:
        query["department"] = department.strip()
    if batch:
        query["batch"] = batch.strip()
    if class_name:
        query["section"] = class_name.strip()
    if search:
        text = search.strip()
        if text:
            pattern = re.compile(re.escape(text), re.IGNORECASE)
            query["$or"] = [
                {"name": pattern},
                {"email": pattern},
                {"registration_number": pattern},
            ]

    students = await User.find(query).sort("name").to_list()

    emails = [(s.email or "").strip().lower() for s in students if s.email]
    reg_numbers = [(s.registration_number or "").strip() for s in students if s.registration_number]

    credit_query = {}
    clauses = []
    if emails:
        clauses.append({"student_email": {"$in": emails}})
    if reg_numbers:
        clauses.append({"registration_number": {"$in": reg_numbers}})
    if clauses:
        credit_query["$or"] = clauses

    credits_docs = await StudentCredit.find(credit_query).to_list() if credit_query else []
    credits_by_email = {
        (doc.student_email or "").strip().lower(): int(doc.total_credits or 0)
        for doc in credits_docs
        if doc.student_email
    }
    credits_by_reg = {
        (doc.registration_number or "").strip(): int(doc.total_credits or 0)
        for doc in credits_docs
        if doc.registration_number
    }

    items = []
    for student in students:
        email_key = (student.email or "").strip().lower()
        reg_key = (student.registration_number or "").strip()
        total_credits = credits_by_email.get(email_key, credits_by_reg.get(reg_key, 0))
        items.append(_student_summary(student, total_credits))

    return {
        "count": len(items),
        "items": items,
    }


@router.get("/students/{student_id}/certificates")
async def get_student_certificates(student_id: PydanticObjectId, _user: User = _principal):
    student = await User.get(student_id)
    if not student or student.role != UserRole.STUDENT:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")

    student_email = (student.email or "").strip().lower()
    if not student_email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Student email is missing")

    generated_certs = await Certificate.find({
        "snapshot.email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"},
    }).sort("-issued_at").to_list()

    manual_submissions = await ManualCreditSubmission.find({
        "student_email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"},
    }).sort("-submitted_at").to_list()

    current_semester = await get_current_semester()
    credit_docs = await StudentCredit.find({
        "$or": [
            {"student_email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"}},
            {"registration_number": student.registration_number} if student.registration_number else {"_id": None},
        ]
    }).to_list()

    credit_history = []
    for doc in credit_docs:
        credit_history.extend(doc.credit_history or [])

    dedup = {}
    for entry in credit_history:
        key = entry.cert_number or f"manual::{entry.awarded_at.isoformat()}::{entry.cert_type}"
        if key not in dedup:
            dedup[key] = entry
    credit_history = list(dedup.values())

    credit_points_by_cert: dict[str, int] = {}
    credit_semester_by_cert: dict[str, str] = {}
    semester_totals: dict[str, int] = {}
    for entry in credit_history:
        if entry.cert_number:
            credit_points_by_cert[entry.cert_number] = int(entry.points_awarded or 0)
            credit_semester_by_cert[entry.cert_number] = entry.semester or "Unknown"
        semester = entry.semester or "Unknown"
        semester_totals[semester] = semester_totals.get(semester, 0) + int(entry.points_awarded or 0)
    total_credits = sum(semester_totals.values())

    certificates = []
    for cert in generated_certs:
        certificates.append(
            {
                "source_type": "generated",
                "cert_number": cert.cert_number,
                "cert_type": cert.snapshot.cert_type if cert.snapshot else "",
                "event_name": cert.snapshot.event_name if cert.snapshot else "",
                "issuer": cert.snapshot.club_name if cert.snapshot else "",
                "status": cert.status.value,
                "issued_at": cert.issued_at,
                "credit_points": int(credit_points_by_cert.get(cert.cert_number, 0)),
                "semester": credit_semester_by_cert.get(cert.cert_number, "Unknown"),
            }
        )

    for submission in manual_submissions:
        certificates.append(
            {
                "source_type": "manual_upload",
                "cert_number": f"STU-MANUAL-{str(submission.id)[-8:].upper()}",
                "cert_type": submission.cert_type,
                "event_name": "Manual Submission",
                "issuer": submission.tutor_email,
                "status": submission.status.value,
                "issued_at": submission.submitted_at,
                "credit_points": int(submission.points_awarded or 0),
                "semester": submission.semester or "Unknown",
            }
        )

    # Get department certificates
    dept_certs = await DeptCertificate.find({
        "participant_email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"}
    }).to_list()

    for dc in dept_certs:
        certificates.append({
            "source_type": "dept_event",
            "cert_number": dc.cert_number,
            "cert_type": dc.contribution or "Participant",
            "event_name": "Department Event",
            "issuer": dc.department,
            "status": "emailed" if dc.emailed_at else "generated",
            "issued_at": dc.emailed_at or dc.created_at,
            "credit_points": int(credit_points_by_cert.get(dc.cert_number, 0)),
            "certificate_image_url": dc.png_url,
            "semester": credit_semester_by_cert.get(dc.cert_number, "Unknown"),
        })

    certificates.sort(
        key=lambda item: item.get("issued_at") or datetime.min,
        reverse=True,
    )

    return {
        "student": _student_summary(student, int(total_credits)),
        "current_semester": current_semester,
        "semester_totals": [
            {"semester": sem, "total_credits": total}
            for sem, total in sorted(semester_totals.items())
        ],
        "count": len(certificates),
        "certificates": certificates,
    }


@router.get("/events-overview")
async def get_events_overview(
    source_type: Optional[str] = None,
    search: Optional[str] = None,
    _user: User = _principal,
):
    search_pattern = re.compile(re.escape(search.strip()), re.IGNORECASE) if search and search.strip() else None
    source_type_normalized = (source_type or "").strip().lower()

    rows = []

    rules = await CreditRule.find_all().to_list()
    rule_points_by_type = {
        _normalize_cert_type(rule.cert_type): int(rule.points or 0)
        for rule in rules
    }

    def _points_for_type(cert_type: str | None) -> int:
        normalized = _normalize_cert_type(cert_type)
        if not normalized:
            return 0
        if normalized in rule_points_by_type:
            return int(rule_points_by_type[normalized] or 0)
        return int(DEFAULT_ROLE_POINTS.get(normalized, 0))

    include_clubs = source_type_normalized in ("", "club")
    include_departments = source_type_normalized in ("", "department")

    if include_clubs:
        club_events = await Event.find_all().to_list()
        club_ids = list({event.club_id for event in club_events if event.club_id})
        clubs = await Club.find({"_id": {"$in": club_ids}}).to_list() if club_ids else []
        club_name_by_id = {str(club.id): club.name for club in clubs}

        event_ids = [event.id for event in club_events if event.id]
        certificates = await Certificate.find({"event_id": {"$in": event_ids}}).to_list() if event_ids else []
        certs_by_event: dict[str, list[Certificate]] = {}
        for cert in certificates:
            key = str(cert.event_id)
            certs_by_event.setdefault(key, []).append(cert)

        for event in club_events:
            event_certs = certs_by_event.get(str(event.id), [])
            if not event_certs:
                continue
            if any(cert.status != CertStatus.EMAILED for cert in event_certs):
                continue

            participant_map = {}
            for cert in event_certs:
                snapshot = cert.snapshot
                unique_key = "|".join([
                    (snapshot.email or "").strip().lower(),
                    (snapshot.registration_number or "").strip(),
                    (snapshot.name or "").strip().lower(),
                ])
                item = participant_map.get(unique_key)
                if not item:
                    participant_map[unique_key] = {
                        "name": snapshot.name,
                        "email": snapshot.email,
                        "registration_number": snapshot.registration_number,
                        "class_name": None,
                        "contribution": snapshot.cert_type,
                        "allocated_points": _points_for_type(snapshot.cert_type),
                    }
                else:
                    item["allocated_points"] += _points_for_type(snapshot.cert_type)

            participants = list(participant_map.values())
            owner_name = club_name_by_id.get(str(event.club_id), "Club")
            row = {
                "source_type": "club",
                "source_name": owner_name,
                "event_name": event.name,
                "event_date": event.event_date,
                "certificates_count": len(event_certs),
                "participants_count": len(participants),
                "participants": participants,
            }

            if search_pattern:
                haystack = f"{row['event_name']} {row['source_name']}"
                if not search_pattern.search(haystack):
                    continue
            rows.append(row)

    if include_departments:
        dept_events = await DeptEvent.find_all().to_list()
        dept_event_ids = [str(event.id) for event in dept_events if event.id]
        dept_certs = await DeptCertificate.find({"event_id": {"$in": dept_event_ids}}).to_list() if dept_event_ids else []
        certs_by_event: dict[str, list[DeptCertificate]] = {}
        for cert in dept_certs:
            key = str(cert.event_id or "")
            certs_by_event.setdefault(key, []).append(cert)

        for event in dept_events:
            event_certs = certs_by_event.get(str(event.id), [])
            if not event_certs:
                continue
            if any(not cert.emailed_at for cert in event_certs):
                continue

            participant_map = {}
            for cert in event_certs:
                unique_key = "|".join([
                    (cert.participant_email or "").strip().lower(),
                    (cert.name or "").strip().lower(),
                    (cert.class_name or "").strip().lower(),
                ])
                item = participant_map.get(unique_key)
                if not item:
                    participant_map[unique_key] = {
                        "name": cert.name,
                        "email": cert.participant_email,
                        "registration_number": None,
                        "class_name": cert.class_name,
                        "contribution": cert.contribution,
                        "allocated_points": _points_for_type(cert.contribution),
                    }
                else:
                    item["allocated_points"] += _points_for_type(cert.contribution)

            participants = list(participant_map.values())
            row = {
                "source_type": "department",
                "source_name": event.department,
                "event_name": event.name,
                "event_date": event.event_date,
                "certificates_count": len(event_certs),
                "participants_count": len(participants),
                "participants": participants,
            }

            if search_pattern:
                haystack = f"{row['event_name']} {row['source_name']}"
                if not search_pattern.search(haystack):
                    continue
            rows.append(row)

    rows.sort(key=lambda item: item.get("event_date") or datetime.min, reverse=True)
    return {
        "count": len(rows),
        "items": rows,
    }
