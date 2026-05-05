import re
from datetime import datetime
from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...core.dependencies import require_role
from ...models.certificate import Certificate
from ...models.dept_certificate import DeptCertificate
from ...models.manual_credit_submission import ManualCreditSubmission
from ...models.student_credit import StudentCredit
from ...services.semester_service import get_current_semester
from ...models.user import User, UserRole

router = APIRouter(prefix="/hod", tags=["HOD"])

_hod = Depends(require_role(UserRole.HOD, UserRole.SUPER_ADMIN))


def _normalize_optional(value: Optional[str]) -> Optional[str]:
    text = (value or "").strip()
    return text or None


def _build_hod_scope(current_user: User) -> dict:
    departments = []

    primary_department = _normalize_optional(current_user.department)
    if primary_department:
        departments.append(primary_department)

    for dep in (getattr(current_user, "departments", None) or []):
        normalized = _normalize_optional(dep)
        if normalized and normalized not in departments:
            departments.append(normalized)

    if not departments:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Departments are not configured for this HOD account.",
        )

    scope = {
        "department": departments[0],
        "departments": departments,
    }
    mapped_batch = _normalize_optional(current_user.batch)
    mapped_section = _normalize_optional(current_user.section)

    if mapped_batch:
        scope["batch"] = mapped_batch
    if mapped_section:
        scope["section"] = mapped_section

    return scope


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


@router.get("/me")
async def get_hod_profile(current_user: User = _hod):
    scope = _build_hod_scope(current_user)
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "email": current_user.email,
        "department": scope.get("department"),
        "departments": scope.get("departments", []),
        "batch": scope.get("batch"),
        "section": scope.get("section"),
    }


@router.get("/students")
async def list_hod_students(
    batch: Optional[str] = None,
    section: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = _hod,
):
    scope = _build_hod_scope(current_user)

    query: dict = {
        "role": UserRole.STUDENT,
        "is_active": True,
        "department": {"$in": scope["departments"]},
    }

    mapped_batch = scope.get("batch")
    mapped_section = scope.get("section")
    requested_batch = _normalize_optional(batch)
    requested_section = _normalize_optional(section)

    if mapped_batch:
        if requested_batch and requested_batch != mapped_batch:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to the requested batch")
        query["batch"] = mapped_batch
    elif requested_batch:
        query["batch"] = requested_batch

    if mapped_section:
        if requested_section and requested_section != mapped_section:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to the requested section")
        query["section"] = mapped_section
    elif requested_section:
        query["section"] = requested_section

    if search and search.strip():
        pattern = re.compile(re.escape(search.strip()), re.IGNORECASE)
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
async def get_hod_student_certificates(student_id: PydanticObjectId, current_user: User = _hod):
    scope = _build_hod_scope(current_user)

    student = await User.get(student_id)
    if not student or student.role != UserRole.STUDENT:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")

    if _normalize_optional(student.department) not in set(scope["departments"]):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this student")

    mapped_batch = scope.get("batch")
    mapped_section = scope.get("section")

    if mapped_batch and _normalize_optional(student.batch) != mapped_batch:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this student")
    if mapped_section and _normalize_optional(student.section) != mapped_section:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this student")

    student_email = (student.email or "").strip().lower()
    if not student_email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Student email is missing")

    generated_certs = await Certificate.find(
        {
            "snapshot.email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"},
        }
    ).sort("-issued_at").to_list()

    manual_submissions = await ManualCreditSubmission.find(
        {
            "student_email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"},
        }
    ).sort("-submitted_at").to_list()

    current_semester = await get_current_semester()
    credit_docs = await StudentCredit.find(
        {
            "$or": [
                {"student_email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"}},
                {"registration_number": student.registration_number} if student.registration_number else {"_id": None},
            ]
        }
    ).to_list()

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
                "certificate_image_url": cert.png_url,
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
                "certificate_image_url": submission.certificate_image_url,
                "semester": submission.semester or "Unknown",
            }
        )

    # Get department certificates
    # First try to match by email
    dept_certs = await DeptCertificate.find({
        "participant_email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"}
    }).to_list()

    # If no certificates found by email and student has name/batch, try fallback matching
    if not dept_certs and student.name and student.batch:
        student_name_normalized = (student.name or "").strip().lower()
        # Try to find certificates by name and batch (for cases where email doesn't match)
        dept_certs = await DeptCertificate.find({
            "name": {"$regex": f"^{re.escape(student_name_normalized)}$", "$options": "i"},
            "class_name": {"$regex": f"^{re.escape(student.batch)}$", "$options": "i"}
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
