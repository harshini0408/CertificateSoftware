from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from ..core.dependencies import require_role
from ..models.user import User, UserRole
from ..models.student_credit import StudentCredit
from ..models.certificate import Certificate, CertStatus
from ..models.event import Event
from ..models.club import Club
from ..services.storage_service import storage_url_to_path

router = APIRouter(tags=["Student"])


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
    credit_doc = await StudentCredit.find_one(
        StudentCredit.student_email == current_user.email
    )
    if not credit_doc:
        return {"total_credits": 0, "breakdown": [], "credit_history": []}

    # Build breakdown by cert_type
    breakdown = {}
    for entry in credit_doc.credit_history:
        ct = entry.cert_type
        if ct not in breakdown:
            breakdown[ct] = {"cert_type": ct, "count": 0, "credits": 0}
        breakdown[ct]["count"] += 1
        breakdown[ct]["credits"] += entry.points_awarded

    return {
        "total_credits": credit_doc.total_credits,
        "breakdown": list(breakdown.values()),
        "credit_history": [e.model_dump() for e in credit_doc.credit_history],
    }


# ── /students/me/credits/history ──────────────────────────────────────────

@router.get("/students/me/credits/history")
async def get_credits_history(current_user: User = Depends(require_role(UserRole.STUDENT))):
    credit_doc = await StudentCredit.find_one(
        StudentCredit.student_email == current_user.email
    )
    if not credit_doc:
        return []
    return [e.model_dump() for e in credit_doc.credit_history]


# ── /students/me/certificates ────────────────────────────────────────────

@router.get("/students/me/certificates")
async def get_my_certificates(current_user: User = Depends(require_role(UserRole.STUDENT))):
    """Return all certificates belonging to the current student.

    Matches by email in snapshot, since participants may not have a user_id link.
    """
    certs = await Certificate.find(
        {"snapshot.email": current_user.email}
    ).to_list()

    results = []
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
            "pdf_url": getattr(c, "pdf_url", None),
        })

    return results


# ── /students/{student_id}/credits (admin/coordinator view) ──────────────

@router.get("/students/{student_id}/credits")
async def get_student_credits(student_id: str):
    """Fetch credits for a specific student by email (preferred) or registration number."""
    credit_doc = await StudentCredit.find_one(
        StudentCredit.student_email == student_id
    )
    if not credit_doc:
        credit_doc = await StudentCredit.find_one(
            StudentCredit.registration_number == student_id
        )
    if not credit_doc:
        return {"total_credits": 0, "breakdown": [], "credit_history": []}

    breakdown = {}
    for entry in credit_doc.credit_history:
        ct = entry.cert_type
        if ct not in breakdown:
            breakdown[ct] = {"cert_type": ct, "count": 0, "credits": 0}
        breakdown[ct]["count"] += 1
        breakdown[ct]["credits"] += entry.points_awarded

    return {
        "total_credits": credit_doc.total_credits,
        "breakdown": list(breakdown.values()),
        "credit_history": [e.model_dump() for e in credit_doc.credit_history],
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
