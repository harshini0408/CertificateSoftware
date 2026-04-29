from datetime import datetime
import io
from pathlib import Path
import re
import zipfile
from typing import Dict, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ...core.dependencies import require_role
from ...models.credit_rule import CreditRule
from ...models.certificate import Certificate, CertStatus
from ...models.event import Event
from ...models.student_credit import CreditHistoryEntry, StudentCredit
from ...models.manual_credit_submission import ManualCreditSubmission, ManualSubmissionStatus
from ...models.dept_certificate import DeptCertificate
from ...models.user import User, UserRole
from ...services.storage_service import storage_url_to_path

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


def _safe_zip_token(value: str | None, fallback: str) -> str:
    token = re.sub(r"[^A-Za-z0-9._-]+", "_", (value or "").strip())
    token = token.strip("._-")
    return token or fallback


def _unique_zip_name(used: set[str], name: str) -> str:
    if name not in used:
        used.add(name)
        return name

    stem, dot, suffix = name.rpartition(".")
    base = stem if dot else name
    ext = f".{suffix}" if dot else ""

    idx = 2
    while True:
        candidate = f"{base}_{idx}{ext}"
        if candidate not in used:
            used.add(candidate)
            return candidate
        idx += 1


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

    cert_points_map: Dict[str, int] = {
        entry.cert_number: int(entry.points_awarded or 0)
        for entry in rolled_history if entry.cert_number
    }
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

    # Fetch relevant DeptCertificates to handle images for department events
    dept_certs = await DeptCertificate.find({
        "participant_email": {"$regex": f"^{re.escape(student_email_norm)}$", "$options": "i"}
    }).to_list()
    dept_cert_by_number = {dc.cert_number: dc for dc in dept_certs if dc.cert_number}

    event_details = []
    for entry in rolled_history:
        cert = cert_by_number.get(entry.cert_number) or dept_cert_by_number.get(entry.cert_number)
        event_date = None
        
        # If it's a club certificate, get date from event
        if cert and isinstance(cert, Certificate) and cert.event_id:
            event = event_by_id.get(str(cert.event_id))
            if event:
                event_date = event.event_date
        # If it's a dept certificate, it might not have a direct event link in the same way, 
        # or it might have a created_at we can use as fallback
        elif cert and isinstance(cert, DeptCertificate):
            dc = cert
            event_details.append(
                {
                    "event_name": "Department Event",
                    "role": dc.contribution or "Participant",
                    "certificate_number": dc.cert_number,
                    "event_date": dc.created_at,
                    "credit_points": int(cert_points_map.get(dc.cert_number, 0)),
                    "awarded_at": dc.created_at,
                    "certificate_image_url": dc.png_url,
                }
            )
            continue
            
        event_details.append(
            {
                "event_name": entry.event_name,
                "role": entry.cert_type,
                "certificate_number": entry.cert_number,
                "event_date": event_date,
                "credit_points": entry.points_awarded,
                "awarded_at": entry.awarded_at,
                "certificate_image_url": cert.png_url if cert else None,
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


@router.get("/tutor/students/{student_email}/certificates/download-all")
async def download_all_tutor_student_certificates(
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
    linked_emails = {_norm_email(d.student_email) for d in linked_docs if d.student_email}
    linked_regs = {(d.registration_number or "").strip() for d in linked_docs if (d.registration_number or "").strip()}

    email_clauses = [
        {"snapshot.email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}
        for email in linked_emails
    ]
    certs = await Certificate.find({
        "$and": [
            {"status": {"$in": [CertStatus.GENERATED, CertStatus.EMAILED]}},
            {"$or": email_clauses},
        ]
    }).to_list() if email_clauses else []

    submissions = await ManualCreditSubmission.find({
        "tutor_email": {"$regex": f"^{re.escape(tutor_email)}$", "$options": "i"}
    }).to_list()

    dept_certs = await DeptCertificate.find({
        "participant_email": {"$regex": f"^{re.escape(student_email_norm)}$", "$options": "i"}
    }).to_list()

    matched_submissions = []
    for submission in submissions:
        sub_email = _norm_email(submission.student_email)
        sub_reg = (submission.registration_number or "").strip()
        if sub_email in linked_emails or (sub_reg and sub_reg in linked_regs):
            matched_submissions.append(submission)

    zip_buffer = io.BytesIO()
    used_names: set[str] = set()
    generated_count = 0
    uploaded_count = 0

    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for cert in certs:
            if not cert.png_url:
                continue
            cert_path = Path(storage_url_to_path(cert.png_url))
            if not cert_path.exists() or not cert_path.is_file():
                continue

            ext = cert_path.suffix.lower() or ".png"
            base_name = _safe_zip_token(cert.cert_number, f"generated_{generated_count + 1}")
            archive_name = _unique_zip_name(used_names, f"generated/{base_name}{ext}")
            generated_count += 1

        for dc in dept_certs:
            if not dc.png_url:
                continue
            dc_path = Path(storage_url_to_path(dc.png_url))
            if not dc_path.exists() or not dc_path.is_file():
                continue
            ext = dc_path.suffix.lower() or ".png"
            base_name = _safe_zip_token(dc.cert_number, f"dept_{generated_count + 1}")
            archive_name = _unique_zip_name(used_names, f"generated/{base_name}{ext}")
            zip_file.write(dc_path, archive_name)
            generated_count += 1

        for dc in dept_certs:
            if not dc.png_url:
                continue
            dc_path = Path(storage_url_to_path(dc.png_url))
            if not dc_path.exists() or not dc_path.is_file():
                continue
            
            ext = dc_path.suffix.lower() or ".png"
            base_name = _safe_zip_token(dc.cert_number, f"dept_{generated_count + 1}")
            archive_name = _unique_zip_name(used_names, f"generated/{base_name}{ext}")
            zip_file.write(dc_path, archive_name)
            generated_count += 1

        for submission in matched_submissions:
            if not submission.certificate_image_url:
                continue
            image_path = Path(storage_url_to_path(submission.certificate_image_url))
            if not image_path.exists() or not image_path.is_file():
                continue

            ext = image_path.suffix.lower() or ".png"
            type_token = _safe_zip_token(submission.cert_type, "manual")
            base_name = f"{type_token}_{(submission.event_date.isoformat() if submission.event_date else 'date_unknown')}"
            archive_name = _unique_zip_name(used_names, f"uploaded/{base_name}{ext}")
            zip_file.write(image_path, archive_name)
            uploaded_count += 1

    if generated_count + uploaded_count == 0:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No downloadable certificate files found for this student",
        )

    zip_buffer.seek(0)
    student_token = _safe_zip_token(doc.student_name or doc.registration_number or doc.student_email, "student")
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{student_token}_certificates.zip"'},
    )


@router.get("/tutor/certificates/download-all")
async def download_all_assigned_students_certificates(
    current_user: User = Depends(require_role(UserRole.TUTOR)),
):
    tutor_email = _norm_email(current_user.email)
    docs = await StudentCredit.find({
        "tutor_email": {"$regex": f"^{re.escape(tutor_email)}$", "$options": "i"}
    }).to_list()

    if not docs:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No students mapped to this tutor")

    linked_emails = {_norm_email(d.student_email) for d in docs if d.student_email}
    linked_regs = {(d.registration_number or "").strip() for d in docs if (d.registration_number or "").strip()}

    student_token_by_email: Dict[str, str] = {}
    student_token_by_reg: Dict[str, str] = {}
    for doc in docs:
        student_token = _safe_zip_token(doc.student_name or doc.registration_number or doc.student_email, "student")
        email_key = _norm_email(doc.student_email)
        reg_key = (doc.registration_number or "").strip()
        if email_key and email_key not in student_token_by_email:
            student_token_by_email[email_key] = student_token
        if reg_key and reg_key not in student_token_by_reg:
            student_token_by_reg[reg_key] = student_token

    email_clauses = [
        {"snapshot.email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}
        for email in linked_emails
    ]
    certs = await Certificate.find({
        "$and": [
            {"status": {"$in": [CertStatus.GENERATED, CertStatus.EMAILED]}},
            {"$or": email_clauses},
        ]
    }).to_list() if email_clauses else []

    submissions = await ManualCreditSubmission.find({
        "tutor_email": {"$regex": f"^{re.escape(tutor_email)}$", "$options": "i"}
    }).to_list()

    dept_certs = await DeptCertificate.find({
        "participant_email": {"$in": list(linked_emails)}
    }).to_list() if linked_emails else []

    matched_submissions = []
    for submission in submissions:
        sub_email = _norm_email(submission.student_email)
        sub_reg = (submission.registration_number or "").strip()
        if sub_email in linked_emails or (sub_reg and sub_reg in linked_regs):
            matched_submissions.append(submission)

    zip_buffer = io.BytesIO()
    used_names: set[str] = set()
    generated_count = 0
    uploaded_count = 0

    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for cert in certs:
            if not cert.png_url:
                continue
            cert_path = Path(storage_url_to_path(cert.png_url))
            if not cert_path.exists() or not cert_path.is_file():
                continue

            snapshot_email = _norm_email((cert.snapshot.email if cert.snapshot else None))
            student_folder = student_token_by_email.get(snapshot_email, "student")

            ext = cert_path.suffix.lower() or ".png"
            base_name = _safe_zip_token(cert.cert_number, f"generated_{generated_count + 1}")
            archive_name = _unique_zip_name(used_names, f"generated/{student_folder}/{base_name}{ext}")
            zip_file.write(cert_path, archive_name)
            generated_count += 1

        for dc in dept_certs:
            if not dc.png_url:
                continue
            dc_path = Path(storage_url_to_path(dc.png_url))
            if not dc_path.exists() or not dc_path.is_file():
                continue
            dc_email = _norm_email(dc.participant_email)
            st_folder = student_token_by_email.get(dc_email, "student")
            ext = dc_path.suffix.lower() or ".png"
            base_name = _safe_zip_token(dc.cert_number, f"dept_{generated_count + 1}")
            archive_name = _unique_zip_name(used_names, f"generated/{st_folder}/{base_name}{ext}")
            zip_file.write(dc_path, archive_name)
            generated_count += 1

        for submission in matched_submissions:
            if not submission.certificate_image_url:
                continue
            image_path = Path(storage_url_to_path(submission.certificate_image_url))
            if not image_path.exists() or not image_path.is_file():
                continue

            sub_email = _norm_email(submission.student_email)
            sub_reg = (submission.registration_number or "").strip()
            student_folder = student_token_by_email.get(sub_email) or student_token_by_reg.get(sub_reg) or "student"

            ext = image_path.suffix.lower() or ".png"
            type_token = _safe_zip_token(submission.cert_type, "manual")
            base_name = f"{type_token}_{(submission.event_date.isoformat() if submission.event_date else 'date_unknown')}"
            archive_name = _unique_zip_name(used_names, f"uploaded/{student_folder}/{base_name}{ext}")
            zip_file.write(image_path, archive_name)
            uploaded_count += 1

    if generated_count + uploaded_count == 0:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No downloadable certificate files found for assigned students",
        )

    zip_buffer.seek(0)
    tutor_token = _safe_zip_token(current_user.name or current_user.username or current_user.email, "tutor")
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{tutor_token}_assigned_students_certificates.zip"'},
    )


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
