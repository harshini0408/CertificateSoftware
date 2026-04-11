from datetime import datetime
import re
from typing import Dict, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ...core.dependencies import require_role
from ...models.credit_rule import CreditRule
from ...models.certificate import Certificate
from ...models.event import Event
from ...models.student_credit import CreditHistoryEntry, StudentCredit
from ...models.manual_credit_submission import ManualCreditSubmission, ManualSubmissionStatus
from ...models.user import User, UserRole

router = APIRouter(tags=["Tutor"])


class TutorManualCertificateRequest(BaseModel):
    student_email: str
    cert_type: str
    cert_number: str | None = None


class SubmissionReviewRequest(BaseModel):
    reason: Optional[str] = None


def _norm_email(value: str | None) -> str:
    return (value or "").strip().lower()


def _history_key(entry: CreditHistoryEntry) -> str:
    return entry.cert_number or f"manual::{entry.awarded_at.isoformat()}::{entry.cert_type}"


def _norm_cert_type(value: str | None) -> str:
    return (value or "").strip().lower().replace("-", "_").replace(" ", "_")


async def _resolve_credit_rule(cert_type_raw: str) -> CreditRule | None:
    normalized = _norm_cert_type(cert_type_raw)
    spaced = normalized.replace("_", " ")
    display = spaced.title() if normalized else cert_type_raw

    candidates = [cert_type_raw, normalized, spaced, display]
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


async def _linked_credit_docs_for_tutor(base: StudentCredit, tutor_email: str) -> list[StudentCredit]:
    clauses = [
        {"student_email": {"$regex": f"^{re.escape(_norm_email(base.student_email))}$", "$options": "i"}},
    ]
    if base.registration_number:
        clauses.append({"registration_number": base.registration_number})

    candidates = await StudentCredit.find({"$or": clauses}).to_list()
    linked = []
    for doc in candidates:
        doc_tutor = _norm_email(doc.tutor_email)
        if doc_tutor and doc_tutor != tutor_email:
            continue
        linked.append(doc)
    return linked


def _rollup_credit_docs(docs: list[StudentCredit]) -> tuple[int, list[CreditHistoryEntry]]:
    dedup: Dict[str, CreditHistoryEntry] = {}
    for doc in docs:
        for entry in (doc.credit_history or []):
            key = _history_key(entry)
            if key not in dedup:
                dedup[key] = entry
    history = sorted(dedup.values(), key=lambda e: e.awarded_at, reverse=True)
    total = sum(int(e.points_awarded or 0) for e in history)
    return total, history


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
    seen = set()
    rows = []
    for d in docs:
        identity = (_norm_email(d.student_email), (d.registration_number or "").strip())
        if identity in seen:
            continue
        seen.add(identity)

        linked = await _linked_credit_docs_for_tutor(d, tutor_email)
        total, _ = _rollup_credit_docs(linked)
        rows.append(
            {
                "student_name": d.student_name,
                "registration_number": d.registration_number,
                "student_email": d.student_email,
                "total_credits": total,
                "department": d.department,
                "batch": d.batch,
                "section": d.section,
            }
        )

    rows.sort(key=lambda d: (d.get("student_name") or "").lower())
    return rows


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

    linked_docs = await _linked_credit_docs_for_tutor(doc, tutor_email)
    total_credits, rolled_history = _rollup_credit_docs(linked_docs)

    cert_numbers = [entry.cert_number for entry in rolled_history if entry.cert_number]
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
    for entry in rolled_history:
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
        "total_credits": total_credits,
        "event_details": event_details,
    }


@router.get("/tutor/credit-rules")
async def list_tutor_credit_rules(current_user: User = Depends(require_role(UserRole.TUTOR))):
    _ = current_user
    rules = await CreditRule.find_all().to_list()
    rules.sort(key=lambda r: r.cert_type)
    return [{"cert_type": r.cert_type, "points": r.points} for r in rules]


@router.get("/tutor/credit-point-verifications")
async def list_credit_point_verifications(current_user: User = Depends(require_role(UserRole.TUTOR))):
    tutor_email = _norm_email(current_user.email)
    submissions = await ManualCreditSubmission.find({
        "tutor_email": {"$regex": f"^{re.escape(tutor_email)}$", "$options": "i"}
    }).sort("-submitted_at").to_list()

    return [
        {
            "id": str(s.id),
            "student_name": s.student_name,
            "student_email": s.student_email,
            "registration_number": s.registration_number,
            "cert_type": s.cert_type,
            "event_date": s.event_date,
            "certificate_image_url": s.certificate_image_url,
            "status": s.status.value,
            "points_awarded": int(s.points_awarded or 0),
            "review_comment": s.review_comment,
            "reviewed_at": s.reviewed_at,
            "submitted_at": s.submitted_at,
        }
        for s in submissions
    ]


@router.post("/tutor/credit-point-verifications/{submission_id}/verify")
async def verify_credit_point_submission(
    submission_id: PydanticObjectId,
    current_user: User = Depends(require_role(UserRole.TUTOR)),
):
    tutor_email = _norm_email(current_user.email)
    submission = await ManualCreditSubmission.get(submission_id)
    if not submission:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    if _norm_email(submission.tutor_email) != tutor_email:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This submission is not assigned to you")
    if submission.status != ManualSubmissionStatus.PENDING:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Submission is already reviewed")

    rule = await _resolve_credit_rule(submission.cert_type)
    if not rule:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No credit rule configured for selected role")

    student_doc = await StudentCredit.find_one({
        "student_email": {"$regex": f"^{re.escape(_norm_email(submission.student_email))}$", "$options": "i"},
        "tutor_email": {"$regex": f"^{re.escape(tutor_email)}$", "$options": "i"},
    })
    if not student_doc and submission.registration_number:
        student_doc = await StudentCredit.find_one({
            "registration_number": submission.registration_number,
            "tutor_email": {"$regex": f"^{re.escape(tutor_email)}$", "$options": "i"},
        })

    if not student_doc:
        student_doc = await StudentCredit(
            student_email=_norm_email(submission.student_email),
            tutor_email=tutor_email,
            registration_number=submission.registration_number,
            student_name=submission.student_name,
            total_credits=0,
            credit_history=[],
            last_updated=datetime.utcnow(),
        ).insert()

    cert_number = f"STU-MANUAL-{str(submission.id)[-8:].upper()}"
    entry = CreditHistoryEntry(
        cert_number=cert_number,
        event_name="Student Manual Submission",
        club_name="Student Upload",
        cert_type=submission.cert_type,
        points_awarded=int(rule.points or 0),
        awarded_at=datetime.utcnow(),
    )
    student_doc.credit_history.append(entry)
    student_doc.total_credits = int(student_doc.total_credits or 0) + int(rule.points or 0)
    student_doc.last_updated = datetime.utcnow()
    await student_doc.save()

    submission.status = ManualSubmissionStatus.VERIFIED
    submission.points_awarded = int(rule.points or 0)
    submission.reviewed_at = datetime.utcnow()
    submission.reviewed_by = str(current_user.id)
    submission.review_comment = None
    await submission.save()

    return {
        "message": "Submission verified and credits awarded",
        "student_email": student_doc.student_email,
        "points_awarded": int(rule.points or 0),
        "total_credits": student_doc.total_credits,
    }


@router.post("/tutor/credit-point-verifications/{submission_id}/reject")
async def reject_credit_point_submission(
    submission_id: PydanticObjectId,
    body: SubmissionReviewRequest,
    current_user: User = Depends(require_role(UserRole.TUTOR)),
):
    tutor_email = _norm_email(current_user.email)
    submission = await ManualCreditSubmission.get(submission_id)
    if not submission:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    if _norm_email(submission.tutor_email) != tutor_email:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This submission is not assigned to you")
    if submission.status != ManualSubmissionStatus.PENDING:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Submission is already reviewed")

    submission.status = ManualSubmissionStatus.REJECTED
    submission.points_awarded = 0
    submission.reviewed_at = datetime.utcnow()
    submission.reviewed_by = str(current_user.id)
    submission.review_comment = (body.reason or "").strip() or "Rejected by tutor"
    await submission.save()

    return {"message": "Submission rejected"}


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
