from pathlib import Path
import re
from datetime import date, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from ...config import get_settings
from ...core.dependencies import require_role
from ...models.user import User, UserRole
from ...models.student_credit import StudentCredit
from ...models.certificate import Certificate, CertStatus
from ...models.dept_certificate import DeptCertificate
from ...models.credit_rule import CreditRule
from ...models.manual_credit_submission import ManualCreditSubmission, ManualSubmissionStatus
from ...models.event import Event
from ...models.club import Club
from ...services.storage_service import storage_url_to_path

router = APIRouter(tags=["Student"])


def _norm_email(value: str | None) -> str:
    return (value or "").strip().lower()


def _norm_cert_type(value: str | None) -> str:
    return (value or "").strip().lower().replace("-", "_").replace(" ", "_")


async def _filter_emailed_credit_entries(entries: list):
    """Keep manual entries and only keep certificate-linked entries that are EMAILED."""
    if not entries:
        return []

    cert_numbers = [e.cert_number for e in entries if getattr(e, "cert_number", None)]
    if not cert_numbers:
        return entries

    certs = await Certificate.find({"cert_number": {"$in": cert_numbers}}).to_list()
    cert_status_map = {c.cert_number: c.status.value for c in certs if c and c.cert_number}

    filtered = []
    for entry in entries:
        cert_number = getattr(entry, "cert_number", None)
        if not cert_number:
            # Manual/tutor entries without a Certificate document stay valid.
            filtered.append(entry)
            continue

        status_value = (cert_status_map.get(cert_number) or "").lower()
        if status_value == CertStatus.EMAILED.value or cert_number.startswith("DPT-"):
            # Allow department certificates (DPT-) regardless of email status if they were awarded
            filtered.append(entry)

    return filtered


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


# ── /students/me ─────────────────────────────────────────────────────────

@router.get("/students/me")
async def get_profile(current_user: User = Depends(require_role(UserRole.STUDENT))):
    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "username": current_user.username,
        "email": current_user.email,
        "registration_number": current_user.registration_number,
        "batch": current_user.batch,
        "department": current_user.department,
        "section": current_user.section,
    }


# ── /students/me/credits ─────────────────────────────────────────────────

@router.get("/students/me/credits")
async def get_credits(current_user: User = Depends(require_role(UserRole.STUDENT))):
    email = _norm_email(current_user.email)
    reg_no = (current_user.registration_number or "").strip()
    query = {
        "$or": [
            {"student_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}},
        ]
    }
    if reg_no:
        query["$or"].append({"registration_number": reg_no})

    credit_docs = await StudentCredit.find(query).to_list()
    if not credit_docs:
        return {"total_credits": 0, "breakdown": [], "credit_history": []}

    all_history = []
    for doc in credit_docs:
        all_history.extend(doc.credit_history or [])

    # Avoid counting duplicate entries if legacy split docs exist.
    dedup = {}
    for entry in all_history:
        key = entry.cert_number or f"manual::{entry.awarded_at.isoformat()}::{entry.cert_type}"
        if key not in dedup:
            dedup[key] = entry
    all_history = list(dedup.values())
    all_history = await _filter_emailed_credit_entries(all_history)

    # Build breakdown by cert_type
    breakdown = {}
    for entry in all_history:
        ct = entry.cert_type
        if ct not in breakdown:
            breakdown[ct] = {"cert_type": ct, "count": 0, "credits": 0}
        breakdown[ct]["count"] += 1
        breakdown[ct]["credits"] += entry.points_awarded

    total_credits = sum(entry.points_awarded for entry in all_history)

    return {
        "total_credits": total_credits,
        "breakdown": list(breakdown.values()),
        "credit_history": [e.model_dump() for e in sorted(all_history, key=lambda e: e.awarded_at, reverse=True)],
    }


# ── /students/me/credits/history ──────────────────────────────────────────

@router.get("/students/me/credits/history")
async def get_credits_history(current_user: User = Depends(require_role(UserRole.STUDENT))):
    email = _norm_email(current_user.email)
    reg_no = (current_user.registration_number or "").strip()
    query = {
        "$or": [
            {"student_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}},
        ]
    }
    if reg_no:
        query["$or"].append({"registration_number": reg_no})

    credit_docs = await StudentCredit.find(query).to_list()
    if not credit_docs:
        return []
    all_history = []
    for doc in credit_docs:
        all_history.extend(doc.credit_history or [])
    dedup = {}
    for entry in all_history:
        key = entry.cert_number or f"manual::{entry.awarded_at.isoformat()}::{entry.cert_type}"
        if key not in dedup:
            dedup[key] = entry
    filtered = await _filter_emailed_credit_entries(list(dedup.values()))
    ordered = sorted(filtered, key=lambda e: e.awarded_at, reverse=True)
    return [e.model_dump() for e in ordered]


# ── /students/me/certificates ────────────────────────────────────────────

@router.get("/students/me/certificates")
async def get_my_certificates(current_user: User = Depends(require_role(UserRole.STUDENT))):
    """Return all certificates belonging to the current student.

    Includes both club and department certificates.
    Matches by email since participants may not have a user_id link.
    """
    email = _norm_email(current_user.email)
    results = []

    # Get club certificates
    certs = await Certificate.find({
        "snapshot.email": {"$regex": f"^{re.escape(email)}$", "$options": "i"},
        "status": {"$in": [CertStatus.GENERATED, CertStatus.EMAILED]},
    }).to_list()

    for c in certs:
        snap = c.snapshot
        results.append({
            "_id": str(c.id),
            "cert_number": c.cert_number,
            "cert_type": getattr(snap, "cert_type", "participant") if snap else "participant",
            "event_name": getattr(snap, "event_name", "") if snap else "",
            "club_name": getattr(snap, "club_name", "") if snap else "",
            "issued_at": c.issued_at,
            "status": c.status.value,
            "png_url": c.png_url,
            "pdf_url": getattr(c, "pdf_url", None),
        })

    # Get department certificates (even if not yet emailed)
    dept_certs = await DeptCertificate.find({
        "participant_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}
    }).to_list()

    for dc in dept_certs:
        results.append({
            "_id": str(dc.id),
            "cert_number": dc.cert_number,
            "cert_type": dc.contribution or "participant",
            "event_name": "",  # Department events don't have event_name in DeptCertificate
            "club_name": dc.department,
            "issued_at": dc.emailed_at or dc.created_at,
            "status": "emailed" if dc.emailed_at else "generated",
            "png_url": dc.png_url,
            "pdf_url": None,
        })

    # Sort by issued_at descending
    results.sort(key=lambda x: x.get("issued_at") or datetime.min, reverse=True)
    return results


@router.get("/students/me/credit-rules")
async def get_credit_rules_for_student(current_user: User = Depends(require_role(UserRole.STUDENT))):
    _ = current_user
    rules = await CreditRule.find_all().to_list()
    rules.sort(key=lambda r: r.cert_type.lower())
    return [{"cert_type": r.cert_type, "points": int(r.points or 0)} for r in rules]


@router.get("/students/me/manual-credit-submissions")
async def get_my_manual_credit_submissions(current_user: User = Depends(require_role(UserRole.STUDENT))):
    email = _norm_email(current_user.email)
    submissions = await ManualCreditSubmission.find({
        "student_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}
    }).sort("-submitted_at").to_list()

    return [
        {
            "id": str(s.id),
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


@router.post("/students/me/manual-credit-submissions")
async def create_manual_credit_submission(
    cert_type: str = Form(...),
    event_date: str = Form(...),
    certificate_image: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    cert_type_clean = (cert_type or "").strip()
    if not cert_type_clean:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Role is required")

    rule = await _resolve_credit_rule(cert_type_clean)
    if not rule:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role selected")

    try:
        parsed_event_date = date.fromisoformat((event_date or "").strip())
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid event_date. Use YYYY-MM-DD")

    if not certificate_image or not certificate_image.filename:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Certificate image is required")
    if not (certificate_image.content_type or "").lower().startswith("image/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only image files are allowed")

    email = _norm_email(current_user.email)
    reg_no = (current_user.registration_number or "").strip()
    query = {"$or": [{"student_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}]}
    if reg_no:
        query["$or"].append({"registration_number": reg_no})

    credit_docs = await StudentCredit.find(query).to_list()
    mapped_doc = next((d for d in credit_docs if d.tutor_email), None)
    if not mapped_doc or not mapped_doc.tutor_email:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "No tutor is mapped to your account yet. Please contact your department coordinator.",
        )

    settings = get_settings()
    upload_dir = settings.storage_root / "manual_credit_uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    suffix = Path(certificate_image.filename).suffix or ".png"
    saved_name = f"{uuid4().hex}{suffix.lower()}"
    target = upload_dir / saved_name

    data = await certificate_image.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file is empty")
    target.write_bytes(data)

    image_url = f"/storage/manual_credit_uploads/{saved_name}"
    submission = await ManualCreditSubmission(
        student_email=email,
        student_name=(current_user.name or "").strip(),
        registration_number=reg_no or None,
        tutor_email=_norm_email(mapped_doc.tutor_email),
        cert_type=rule.cert_type,
        event_date=parsed_event_date,
        certificate_image_url=image_url,
        status=ManualSubmissionStatus.PENDING,
        points_awarded=0,
        submitted_at=datetime.utcnow(),
    ).insert()

    return {
        "message": "Submission created and sent for tutor verification",
        "id": str(submission.id),
        "status": submission.status.value,
    }


# ── /students/{student_id}/credits (admin/coordinator view) ──────────────

@router.get("/students/{student_id}/credits")
async def get_student_credits(student_id: str):
    """Fetch credits for a specific student by email (preferred) or registration number."""
    student_id_norm = _norm_email(student_id)
    credit_doc = await StudentCredit.find_one({
        "student_email": {"$regex": f"^{re.escape(student_id_norm)}$", "$options": "i"}
    })
    if not credit_doc:
        credit_doc = await StudentCredit.find_one(
            StudentCredit.registration_number == student_id
        )
    if not credit_doc:
        return {"total_credits": 0, "breakdown": [], "credit_history": []}

    filtered_history = await _filter_emailed_credit_entries(credit_doc.credit_history)

    breakdown = {}
    for entry in filtered_history:
        ct = entry.cert_type
        if ct not in breakdown:
            breakdown[ct] = {"cert_type": ct, "count": 0, "credits": 0}
        breakdown[ct]["count"] += 1
        breakdown[ct]["credits"] += entry.points_awarded

    return {
        "total_credits": sum(e.points_awarded for e in filtered_history),
        "breakdown": list(breakdown.values()),
        "credit_history": [e.model_dump() for e in filtered_history],
    }


@router.get("/students/me/certificates/{cert_number}/download")
async def download_my_certificate(
    cert_number: str,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    """Download a certificate PNG that belongs to the currently logged-in student.

    Verifies ownership by matching snapshot.email == current_user.email.
    Returns the PNG as a file attachment.
    """
    # Find certificate by cert_number
    cert = await Certificate.find_one(Certificate.cert_number == cert_number)
    if not cert:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificate not found")

    # Ownership check — the certificate must belong to this student
    if not cert.snapshot or cert.snapshot.email.lower() != current_user.email.lower():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificate not found")

    # Certificate must be in a downloadable state
    if cert.status.value not in ("generated", "emailed"):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Certificate has not been generated yet"
        )

    # Resolve the PNG file path from the stored /storage URL
    if not cert.png_url:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificate file not available")

    file_path = Path(storage_url_to_path(cert.png_url))
    if not file_path.exists():
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Certificate file not found on disk. Please contact the administrator."
        )

    return FileResponse(
        path=str(file_path),
        media_type="image/png",
        filename=f"{cert_number}.png",
        headers={"Content-Disposition": f'attachment; filename="{cert_number}.png"'},
    )
