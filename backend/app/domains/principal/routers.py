import re
from datetime import datetime
from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...core.dependencies import require_role
from ...models.user import User, UserRole
from ...models.student_credit import StudentCredit
from ...models.certificate import Certificate
from ...models.manual_credit_submission import ManualCreditSubmission

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

    credit_doc = await StudentCredit.find_one({
        "$or": [
            {"student_email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"}},
            {"registration_number": student.registration_number} if student.registration_number else {"_id": None},
        ]
    })

    credit_points_by_cert: dict[str, int] = {}
    if credit_doc:
        for entry in credit_doc.credit_history or []:
            if entry.cert_number:
                credit_points_by_cert[entry.cert_number] = int(entry.points_awarded or 0)

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
            }
        )

    certificates.sort(
        key=lambda item: item.get("issued_at") or datetime.min,
        reverse=True,
    )

    return {
        "student": _student_summary(student, int(credit_doc.total_credits if credit_doc else 0)),
        "count": len(certificates),
        "certificates": certificates,
    }
