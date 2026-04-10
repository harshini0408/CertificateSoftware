from datetime import datetime
import re
from typing import Dict

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ...core.dependencies import require_role
from ...models.credit_rule import CreditRule
from ...models.certificate import Certificate
from ...models.event import Event
from ...models.student_credit import CreditHistoryEntry, StudentCredit
from ...models.user import User, UserRole

router = APIRouter(tags=["Tutor"])


class TutorManualCertificateRequest(BaseModel):
    student_email: str
    cert_type: str
    cert_number: str | None = None


def _norm_email(value: str | None) -> str:
    return (value or "").strip().lower()


@router.get("/tutor/me")
async def get_tutor_profile(current_user: User = Depends(require_role(UserRole.TUTOR))):
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "username": current_user.username,
        "email": current_user.email,
        "department": current_user.department,
        "batch": current_user.batch,
        "section": current_user.section,
    }


@router.get("/tutor/students")
async def list_tutor_students(current_user: User = Depends(require_role(UserRole.TUTOR))):
    tutor_email = _norm_email(current_user.email)
    docs = await StudentCredit.find({
        "tutor_email": {"$regex": f"^{re.escape(tutor_email)}$", "$options": "i"}
    }).to_list()

    docs.sort(key=lambda d: (d.student_name or "").lower())
    return [
        {
            "student_name": d.student_name,
            "registration_number": d.registration_number,
            "student_email": d.student_email,
            "total_credits": d.total_credits,
            "department": d.department,
            "batch": d.batch,
            "section": d.section,
        }
        for d in docs
    ]


@router.get("/tutor/students/{student_email}")
async def get_tutor_student_detail(
    student_email: str,
    current_user: User = Depends(require_role(UserRole.TUTOR)),
):
    tutor_email = _norm_email(current_user.email)
    student_email_norm = _norm_email(student_email)

    doc = await StudentCredit.find_one({
        "student_email": {"$regex": f"^{re.escape(student_email_norm)}$", "$options": "i"},
        "tutor_email": {"$regex": f"^{re.escape(tutor_email)}$", "$options": "i"},
    })
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found for this tutor")

    cert_numbers = [entry.cert_number for entry in (doc.credit_history or []) if entry.cert_number]
    certs = await Certificate.find({"cert_number": {"$in": cert_numbers}}).to_list() if cert_numbers else []
    cert_by_number: Dict[str, Certificate] = {c.cert_number: c for c in certs}

    event_ids = []
    for c in certs:
        if not c.event_id:
            continue
        try:
            event_ids.append(PydanticObjectId(str(c.event_id)))
        except Exception:
            continue
    event_ids = list({eid for eid in event_ids})
    event_by_id: Dict[str, Event] = {}
    if event_ids:
        events = await Event.find({"_id": {"$in": event_ids}}).to_list()
        event_by_id = {str(e.id): e for e in events}

    event_details = []
    for entry in (doc.credit_history or []):
        cert = cert_by_number.get(entry.cert_number)
        event_date = None
        if cert and cert.event_id:
            event = event_by_id.get(str(cert.event_id))
            if event:
                event_date = event.event_date

        event_details.append(
            {
                "event_name": entry.event_name,
                "role": entry.cert_type,
                "certificate_number": entry.cert_number,
                "event_date": event_date,
                "credit_points": entry.points_awarded,
                "awarded_at": entry.awarded_at,
            }
        )

    event_details.sort(key=lambda item: item.get("event_date") or item.get("awarded_at") or datetime.min, reverse=True)

    return {
        "student_name": doc.student_name,
        "student_email": doc.student_email,
        "registration_number": doc.registration_number,
        "department": doc.department,
        "batch": doc.batch,
        "section": doc.section,
        "total_credits": doc.total_credits,
        "event_details": event_details,
    }


@router.get("/tutor/credit-rules")
async def list_tutor_credit_rules(current_user: User = Depends(require_role(UserRole.TUTOR))):
    _ = current_user
    rules = await CreditRule.find_all().to_list()
    rules.sort(key=lambda r: r.cert_type)
    return [{"cert_type": r.cert_type, "points": r.points} for r in rules]


@router.post("/tutor/certificates/manual")
async def add_manual_tutor_certificate(
    body: TutorManualCertificateRequest,
    current_user: User = Depends(require_role(UserRole.TUTOR)),
):
    tutor_email = _norm_email(current_user.email)
    student_email = _norm_email(body.student_email)
    cert_type = (body.cert_type or "").strip().lower().replace("-", "_").replace(" ", "_")

    if not student_email or not cert_type:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "student_email and cert_type are required")

    student = await StudentCredit.find_one({
        "student_email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"},
        "tutor_email": {"$regex": f"^{re.escape(tutor_email)}$", "$options": "i"},
    })
    if not student:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found for this tutor")

    rule = await CreditRule.find_one(CreditRule.cert_type == cert_type)
    if not rule:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No credit rule configured for selected role")

    cert_number = (body.cert_number or "").strip()
    if not cert_number:
        cert_number = f"MANUAL-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

    entry = CreditHistoryEntry(
        cert_number=cert_number,
        event_name="Manual Entry",
        club_name=(current_user.department or "Tutor Dashboard"),
        cert_type=cert_type,
        points_awarded=rule.points,
        awarded_at=datetime.utcnow(),
    )

    student.credit_history.append(entry)
    student.total_credits = int(student.total_credits or 0) + int(rule.points)
    student.last_updated = datetime.utcnow()
    await student.save()

    return {
        "message": "Manual certificate entry added",
        "student_email": student.student_email,
        "cert_type": cert_type,
        "cert_number": cert_number,
        "points_awarded": rule.points,
        "total_credits": student.total_credits,
    }
