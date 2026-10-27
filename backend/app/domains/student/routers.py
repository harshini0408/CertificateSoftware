from pathlib import Path
import re
from datetime import date, datetime
from typing import Optional, List
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from beanie import PydanticObjectId

from pydantic import BaseModel
from ...config import get_settings
from ...core.dependencies import require_role
from ...models.user import User, UserRole
from ...models.student_credit import StudentCredit
from ...models.certificate import Certificate, CertStatus
from ...models.dept_certificate import DeptCertificate
from ...models.faculty_certificate import FacultyCertificate
from ...models.credit_rule import CreditRule
from ...models.manual_credit_submission import ManualCreditSubmission, ManualSubmissionStatus
from ...models.event import Event, EventStatus
from ...models.club import Club
from ...models.professional_society import ProfessionalSociety
from ...models.society_event import SocietyEvent, SocietyEventStatus
from ...models.student_club_membership import StudentClubMembership, MembershipStatus
from ...models.student_society_membership import StudentSocietyMembership
from ...models.event_registration import EventRegistration
from ...services.storage_service import storage_url_to_path
from ...services.semester_service import get_current_semester

router = APIRouter(tags=["Student"])


def _norm_email(value: str | None) -> str:
    return (value or "").strip().lower()


def _manual_submission_cert_number(submission: ManualCreditSubmission) -> str:
    return f"STU-MANUAL-{str(submission.id)[-8:].upper()}"


def is_temporary_reg_no(reg_no: Optional[str]) -> bool:
    if not reg_no:
        return True
    clean = reg_no.strip()
    return not bool(re.fullmatch(r"^\d{12}$", clean))


class StudentUpdateRegNoRequest(BaseModel):
    registration_number: str


# ── /students/me ─────────────────────────────────────────────────────────

@router.get("/students/me")
async def get_profile(current_user: User = Depends(require_role(UserRole.STUDENT))):
    is_temp = is_temporary_reg_no(current_user.registration_number)
    can_update = is_temp and (getattr(current_user, "student_reg_no_change_count", 0) or 0) == 0

    tutor_email = None
    tutor_name = None

    email = _norm_email(current_user.email)
    reg_no = (current_user.registration_number or "").strip()
    query = {"$or": [{"student_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}}]}
    if reg_no:
        query["$or"].append({"registration_number": reg_no})

    credit_doc = await StudentCredit.find_one(query)
    if credit_doc and credit_doc.tutor_email:
        tutor_email = credit_doc.tutor_email

    # Fallback to assigned_classes or class matching if not mapped in StudentCredit
    if not tutor_email and current_user.department and current_user.batch and current_user.section:
        tutor_user = await User.find_one({
            "role": {"$in": [UserRole.TUTOR, UserRole.FACULTY]},
            "assigned_classes": {
                "$elemMatch": {
                    "department": current_user.department,
                    "batch": current_user.batch,
                    "section": current_user.section,
                }
            }
        })
        if not tutor_user:
            tutor_user = await User.find_one({
                "role": {"$in": [UserRole.TUTOR, UserRole.FACULTY]},
                "department": current_user.department,
                "batch": current_user.batch,
                "section": current_user.section,
            })
        if tutor_user:
            tutor_email = tutor_user.email

    if tutor_email:
        tutor_user = await User.find_one({"email": {"$regex": f"^{re.escape(tutor_email.strip())}$", "$options": "i"}})
        if tutor_user:
            tutor_name = tutor_user.name
        else:
            tutor_name = tutor_email

    return {
        "id": str(current_user.id),
        "name": current_user.name,
        "username": current_user.username,
        "email": current_user.email,
        "registration_number": current_user.registration_number,
        "batch": current_user.batch,
        "department": current_user.department,
        "section": current_user.section,
        "tutor_name": tutor_name,
        "tutor_email": tutor_email,
        "is_temporary_reg_no": is_temp,
        "can_update_reg_no": can_update,
        "student_reg_no_change_count": getattr(current_user, "student_reg_no_change_count", 0) or 0,
    }


@router.post("/students/me/update-registration-number")
async def student_update_registration_number(
    body: StudentUpdateRegNoRequest,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    if (getattr(current_user, "student_reg_no_change_count", 0) or 0) >= 1:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Registration number can only be updated once by the student.",
        )
    if not is_temporary_reg_no(current_user.registration_number):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "You already have a valid 12-digit registration number and cannot update it.",
        )

    new_reg = body.registration_number.strip()
    if not re.fullmatch(r"^\d{12}$", new_reg):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Registration number must be a valid 12-digit number (e.g. 715522104001).",
        )

    # Check if another user already has this registration_number or username
    existing_user = await User.find_one({
        "_id": {"$ne": current_user.id},
        "$or": [
            {"registration_number": {"$regex": f"^{re.escape(new_reg)}$", "$options": "i"}},
            {"username": {"$regex": f"^{re.escape(new_reg)}$", "$options": "i"}},
        ]
    })
    if existing_user:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This registration number is already registered by another student.",
        )

    old_reg = current_user.registration_number
    current_user.registration_number = new_reg
    if current_user.username == old_reg or is_temporary_reg_no(current_user.username):
        current_user.username = new_reg
    current_user.student_reg_no_change_count = (getattr(current_user, "student_reg_no_change_count", 0) or 0) + 1
    await current_user.save()

    # Sync registration number across StudentCredit docs for this student's email
    norm_email = _norm_email(current_user.email)
    credit_docs = await StudentCredit.find({
        "student_email": {"$regex": f"^{re.escape(norm_email)}$", "$options": "i"}
    }).to_list()
    for cd in credit_docs:
        cd.registration_number = new_reg
        await cd.save()

    return {
        "message": "Registration number updated successfully",
        "registration_number": new_reg,
        "username": current_user.username,
        "can_update_reg_no": False,
        "is_temporary_reg_no": False,
        "student_reg_no_change_count": current_user.student_reg_no_change_count,
    }


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

        # If it's a student manual upload, direct tutor award, department cert, or not an event Certificate document, keep it
        if (
            cert_number.startswith("STU-MANUAL-")
            or cert_number.startswith("MANUAL-")
            or cert_number.startswith("DPT-")
            or cert_number not in cert_status_map
        ):
            filtered.append(entry)
            continue

        status_value = (cert_status_map.get(cert_number) or "").lower()
        if status_value == CertStatus.EMAILED.value:
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




# ── /students/me/credits ─────────────────────────────────────────────────

@router.get("/students/me/credits")
async def get_credits(current_user: User = Depends(require_role(UserRole.STUDENT))):
    current_semester = await get_current_semester()
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
        return {
            "total_credits": 0,
            "breakdown": [],
            "credit_history": [],
            "current_semester": current_semester,
            "semester_totals": [],
        }

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

    # Build breakdown by cert_type for the current semester if set
    breakdown = {}
    semester_history = all_history
    if current_semester:
        semester_history = [e for e in all_history if (e.semester or "Unknown") == current_semester]

    for entry in semester_history:
        ct = entry.cert_type
        if ct not in breakdown:
            breakdown[ct] = {"cert_type": ct, "count": 0, "credits": 0}
        breakdown[ct]["count"] += 1
        breakdown[ct]["credits"] += entry.points_awarded

    semester_totals = {}
    for entry in all_history:
        semester = entry.semester or "Unknown"
        semester_totals[semester] = semester_totals.get(semester, 0) + int(entry.points_awarded or 0)

    total_credits = sum(entry.points_awarded for entry in all_history)

    return {
        "total_credits": total_credits,
        "breakdown": list(breakdown.values()),
        "credit_history": [e.model_dump() for e in sorted(all_history, key=lambda e: e.awarded_at, reverse=True)],
        "current_semester": current_semester,
        "semester_totals": [
            {"semester": sem, "total_credits": total}
            for sem, total in sorted(semester_totals.items())
        ],
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

    Includes club certificates, department certificates, and tutor-verified
    student uploads.
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
        is_faculty_cert = str(dc.cert_number or "").startswith("FAC-") or str(dc.department or "").lower().startswith("faculty event")
        is_guest_cert = str(dc.cert_number or "").startswith("GUEST-") or str(dc.department or "").lower().startswith("guest event")
        results.append({
            "_id": str(dc.id),
            "cert_number": dc.cert_number,
            "cert_type": "faculty" if is_faculty_cert else ("guest" if is_guest_cert else (dc.contribution or "participant")),
            "event_name": "",  # Department events don't have event_name in DeptCertificate
            "club_name": dc.department,
            "issued_at": dc.emailed_at or dc.created_at,
            "status": "emailed" if dc.emailed_at else "generated",
            "png_url": dc.png_url,
            "pdf_url": None,
        })

    # Get faculty certificates
    fac_certs = await FacultyCertificate.find({
        "recipient_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}
    }).to_list()
    for fc in fac_certs:
        results.append({
            "_id": str(fc.id),
            "cert_number": fc.cert_number,
            "cert_type": "faculty",
            "event_name": fc.event_name or "Faculty Event",
            "club_name": "Faculty Event",
            "issued_at": fc.emailed_at or fc.created_at,
            "status": fc.status,
            "png_url": fc.png_url,
            "pdf_url": None,
        })

    # A verified student upload is the student's original certificate image,
    # rather than an event-generated Certificate document.
    manual_submissions = await ManualCreditSubmission.find({
        "student_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"},
        "status": ManualSubmissionStatus.VERIFIED.value,
    }).to_list()
    for submission in manual_submissions:
        results.append({
            "_id": f"manual-{submission.id}",
            "cert_number": _manual_submission_cert_number(submission),
            "cert_type": submission.cert_type,
            "event_name": "Student Certificate Submission",
            "club_name": "Student Upload",
            "issued_at": submission.reviewed_at or submission.submitted_at,
            "status": ManualSubmissionStatus.VERIFIED.value,
            "png_url": submission.certificate_image_url,
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

    tutor_emails = list({s.tutor_email for s in submissions if s.tutor_email})
    reviewer_ids = list({s.reviewed_by for s in submissions if s.reviewed_by})
    users_by_email = {}
    users_by_id = {}
    if tutor_emails:
        t_users = await User.find({"email": {"$in": tutor_emails}}).to_list()
        for u in t_users:
            users_by_email[u.email.lower()] = u.name
    if reviewer_ids:
        r_oids = []
        for rid in reviewer_ids:
            try:
                r_oids.append(PydanticObjectId(rid))
            except Exception:
                pass
        if r_oids:
            r_users = await User.find({"_id": {"$in": r_oids}}).to_list()
            for u in r_users:
                users_by_id[str(u.id)] = u.name

    result = []
    for s in submissions:
        reviewer_name = s.reviewed_by_name
        if not reviewer_name and s.reviewed_by and str(s.reviewed_by) in users_by_id:
            reviewer_name = users_by_id[str(s.reviewed_by)]
        if not reviewer_name and s.status in [ManualSubmissionStatus.VERIFIED, ManualSubmissionStatus.REJECTED] and s.tutor_email:
            reviewer_name = users_by_email.get(s.tutor_email.lower()) or s.tutor_email

        result.append({
            "id": str(s.id),
            "cert_type": s.cert_type,
            "event_date": s.event_date,
            "certificate_image_url": s.certificate_image_url,
            "status": s.status.value,
            "points_awarded": int(s.points_awarded or 0),
            "review_comment": s.review_comment,
            "reviewed_at": s.reviewed_at,
            "reviewed_by_name": reviewer_name,
            "submitted_at": s.submitted_at,
            "semester": s.semester,
        })
    return result


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
    current_semester = await get_current_semester() or "Unknown"
    submission = await ManualCreditSubmission(
        student_email=email,
        student_name=(current_user.name or "").strip(),
        registration_number=reg_no or None,
        tutor_email=_norm_email(mapped_doc.tutor_email),
        cert_type=rule.cert_type,
        event_date=parsed_event_date,
        certificate_image_url=image_url,
        semester=current_semester,
        status=ManualSubmissionStatus.PENDING,
        points_awarded=0,
        submitted_at=datetime.utcnow(),
    ).insert()

    return {
        "message": "Submission created and sent for tutor verification",
        "id": str(submission.id),
        "status": submission.status.value,
    }


# ── /students/me/clubs ───────────────────────────────────────────────────────

@router.get("/students/me/clubs")
async def get_my_club_memberships(current_user: User = Depends(require_role(UserRole.STUDENT))):
    """Return all club membership applications for the current student."""
    memberships = await StudentClubMembership.find(
        StudentClubMembership.student_id == current_user.id
    ).sort("-applied_at").to_list()
    return [
        {
            "id": str(m.id),
            "club_id": str(m.club_id),
            "club_name": m.club_name or "",
            "status": m.status.value,
            "applied_at": m.applied_at,
            "updated_at": m.updated_at,
            "review_note": m.review_note,
            "office_bearer_role": m.office_bearer_role,
        }
        for m in memberships
    ]


# ── /students/me/societies ───────────────────────────────────────────────────

@router.get("/students/me/societies")
async def get_my_society_memberships(current_user: User = Depends(require_role(UserRole.STUDENT))):
    """Return all professional society membership applications for the current student."""
    memberships = await StudentSocietyMembership.find(
        StudentSocietyMembership.student_id == current_user.id
    ).sort("-applied_at").to_list()
    return [
        {
            "id": str(m.id),
            "society_id": str(m.society_id),
            "society_name": m.society_name or "",
            "status": m.status.value,
            "applied_at": m.applied_at,
            "updated_at": m.updated_at,
            "review_note": m.review_note,
            "office_bearer_role": m.office_bearer_role,
        }
        for m in memberships
    ]




@router.post("/students/me/clubs/apply")
async def apply_for_club(
    body: dict,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    """Apply to join a club. A student may have at most 2 active (pending/approved) memberships."""
    club_id_str = (body.get("club_id") or "").strip()
    if not club_id_str:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "club_id is required")

    from beanie import PydanticObjectId as ObjId
    try:
        club_oid = ObjId(club_id_str)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid club_id")

    club = await Club.get(club_oid)
    if not club or not club.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found or inactive")

    # Check for duplicate active application to this club
    existing_for_club = await StudentClubMembership.find_one({
        "student_id": current_user.id,
        "club_id": club_oid,
        "status": {"$in": [MembershipStatus.PENDING.value, MembershipStatus.APPROVED.value]},
    })
    if existing_for_club:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "You already have an active application or membership for this club",
        )

    # Enforce max 2 active (pending + approved) memberships across all clubs
    active_count = await StudentClubMembership.find({
        "student_id": current_user.id,
        "status": {"$in": [MembershipStatus.PENDING.value, MembershipStatus.APPROVED.value]},
    }).count()
    if active_count >= 2:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "You can apply for at most 2 clubs. Please wait for a pending application outcome or have an approved membership removed.",
        )

    membership = await StudentClubMembership(
        student_id=current_user.id,
        student_name=current_user.name,
        student_email=(current_user.email or "").strip().lower(),
        club_id=club_oid,
        club_name=club.name,
        status=MembershipStatus.PENDING,
    ).insert()

    return {
        "message": "Application submitted. Awaiting coordinator approval.",
        "id": str(membership.id),
        "club_name": club.name,
        "status": membership.status.value,
    }


@router.delete("/students/me/clubs/{membership_id}")
async def leave_club_membership(
    membership_id: PydanticObjectId,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    """Allow a student to withdraw their pending or approved club membership."""
    membership = await StudentClubMembership.get(membership_id)
    if not membership:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membership not found")
    if membership.student_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This membership does not belong to you")
    club_name = membership.club_name or "the club"
    await membership.delete()
    return {"message": f"Successfully withdrawn from {club_name}"}


@router.put("/students/me/manual-credit-submissions/{submission_id}")
async def update_manual_credit_submission(
    submission_id: PydanticObjectId,
    cert_type: str = Form(None),
    event_date: str = Form(None),
    certificate_image: UploadFile = File(None),
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    """Edit a pending manual credit submission. Only allowed while status is 'pending'."""
    email = _norm_email(current_user.email)
    submission = await ManualCreditSubmission.get(submission_id)
    if not submission:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    if _norm_email(submission.student_email) != email:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This submission does not belong to you")
    if submission.status == ManualSubmissionStatus.VERIFIED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Verified submissions cannot be edited",
        )

    updates = {}
    # If it was rejected, editing re-submits it to pending review
    if submission.status == ManualSubmissionStatus.REJECTED:
        updates["status"] = ManualSubmissionStatus.PENDING

    if cert_type:
        cert_type_clean = cert_type.strip()
        rule = await _resolve_credit_rule(cert_type_clean)
        if not rule:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid role selected")
        updates["cert_type"] = rule.cert_type

    if event_date:
        try:
            parsed_event_date = date.fromisoformat(event_date.strip())
            updates["event_date"] = parsed_event_date
        except Exception:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid event_date. Use YYYY-MM-DD")

    if certificate_image and certificate_image.filename:
        if not (certificate_image.content_type or "").lower().startswith("image/"):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only image files are allowed")
        settings_cfg = get_settings()
        upload_dir = settings_cfg.storage_root / "manual_credit_uploads"
        upload_dir.mkdir(parents=True, exist_ok=True)
        suffix = Path(certificate_image.filename).suffix or ".png"
        saved_name = f"{uuid4().hex}{suffix.lower()}"
        target = upload_dir / saved_name
        data = await certificate_image.read()
        if not data:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file is empty")
        target.write_bytes(data)
        updates["certificate_image_url"] = f"/storage/manual_credit_uploads/{saved_name}"

    if not updates:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fields provided to update")

    await submission.set(updates)
    return {"message": "Submission updated successfully", "id": str(submission.id)}


@router.delete("/students/me/manual-credit-submissions/{submission_id}")
async def delete_manual_credit_submission(
    submission_id: PydanticObjectId,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    """Delete a manual credit submission. Only allowed until verified."""
    email = _norm_email(current_user.email)
    submission = await ManualCreditSubmission.get(submission_id)
    if not submission:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")
    if _norm_email(submission.student_email) != email:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This submission does not belong to you")
    if submission.status == ManualSubmissionStatus.VERIFIED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Verified submissions cannot be deleted",
        )
    await submission.delete()
    return {"message": "Submission deleted successfully"}


@router.get("/students/{student_id}/credits")
async def get_student_credits(student_id: str):
    """Fetch credits for a specific student by email (preferred) or registration number."""
    current_semester = await get_current_semester()
    student_id_norm = _norm_email(student_id)
    credit_docs = await StudentCredit.find({
        "$or": [
            {"student_email": {"$regex": f"^{re.escape(student_id_norm)}$", "$options": "i"}},
            {"registration_number": student_id},
        ]
    }).to_list()
    if not credit_docs:
        return {
            "total_credits": 0,
            "breakdown": [],
            "credit_history": [],
            "current_semester": current_semester,
            "semester_totals": [],
        }

    all_history = []
    for doc in credit_docs:
        all_history.extend(doc.credit_history or [])

    dedup = {}
    for entry in all_history:
        key = entry.cert_number or f"manual::{entry.awarded_at.isoformat()}::{entry.cert_type}"
        if key not in dedup:
            dedup[key] = entry
    filtered_history = await _filter_emailed_credit_entries(list(dedup.values()))

    breakdown = {}
    semester_history = filtered_history
    if current_semester:
        semester_history = [e for e in filtered_history if (e.semester or "Unknown") == current_semester]

    for entry in semester_history:
        ct = entry.cert_type
        if ct not in breakdown:
            breakdown[ct] = {"cert_type": ct, "count": 0, "credits": 0}
        breakdown[ct]["count"] += 1
        breakdown[ct]["credits"] += entry.points_awarded

    semester_totals = {}
    for entry in filtered_history:
        semester = entry.semester or "Unknown"
        semester_totals[semester] = semester_totals.get(semester, 0) + int(entry.points_awarded or 0)

    total_credits = semester_totals.get(current_semester, 0) if current_semester else sum(e.points_awarded for e in filtered_history)

    return {
        "total_credits": total_credits,
        "breakdown": list(breakdown.values()),
        "credit_history": [e.model_dump() for e in filtered_history],
        "current_semester": current_semester,
        "semester_totals": [
            {"semester": sem, "total_credits": total}
            for sem, total in sorted(semester_totals.items())
        ],
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
    # Find an event-generated certificate by cert_number first.
    cert = await Certificate.find_one(Certificate.cert_number == cert_number)
    certificate_url = None
    if cert:
        # Ownership check — the certificate must belong to this student.
        if not cert.snapshot or cert.snapshot.email.lower() != current_user.email.lower():
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificate not found")
        if cert.status.value not in (CertStatus.GENERATED.value, CertStatus.EMAILED.value):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificate has not been generated yet")
        certificate_url = cert.png_url
    else:
        # Manual submissions keep the uploaded image in their own collection.
        email = _norm_email(current_user.email)
        manual_submissions = await ManualCreditSubmission.find({
            "student_email": {"$regex": f"^{re.escape(email)}$", "$options": "i"},
            "status": ManualSubmissionStatus.VERIFIED.value,
        }).to_list()
        submission = next(
            (item for item in manual_submissions if _manual_submission_cert_number(item) == cert_number),
            None,
        )
        if not submission:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificate not found")
        certificate_url = submission.certificate_image_url

    if not certificate_url:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificate file not available")

    file_path = Path(storage_url_to_path(certificate_url))
    if not file_path.exists():
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Certificate file not found on disk. Please contact the administrator."
        )

    return FileResponse(
        path=str(file_path),
        filename=f"{cert_number}{file_path.suffix.lower() or '.png'}",
    )


# ═══ UPCOMING EVENTS & EVENT REGISTRATION ═══════════════════════════════════


def _normalize_session(time_str: Optional[str]) -> str:
    """Normalize session to 'FN' or 'AN'."""
    val = (time_str or "").strip().lower()
    if "an" in val or "afternoon" in val or "pm" in val and not "10" in val and not "11" in val and not "9" in val and not "8" in val:
        return "AN"
    return "FN"


@router.get("/student/upcoming-events")
async def list_upcoming_events(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):

    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)

    # Auto-complete past published events.
    past_active = await Event.find({
        "is_published": True,
        "status": {"$ne": EventStatus.COMPLETED.value},
        "event_date": {"$lt": today_start},
    }).to_list()
    for pe in past_active:
        await pe.set({"status": EventStatus.COMPLETED.value})

    events = await Event.find({
        "is_published": True,
        "status": {"$ne": EventStatus.COMPLETED.value},
        "event_date": {"$gte": today_start},
    }).sort(+Event.event_date).to_list()

    clubs = await Club.find().to_list()
    club_map = {str(c.id): c.name for c in clubs}

    # Fetch this student's registrations
    registrations = await EventRegistration.find(
        EventRegistration.student_email == current_user.email.lower(),
    ).to_list()
    student_reg_map = {}
    for r in registrations:
        eid = str(r.event_id)
        reg_type = getattr(r, "registration_type", "participant")
        reg_status = getattr(r, "status", "accepted" if reg_type == "participant" else "pending")
        student_reg_map[eid] = {
            "id": str(r.id),
            "type": reg_type,
            "status": reg_status,
            "team_id": getattr(r, "team_id", None),
            "team_name": getattr(r, "team_name", None),
            "team_role": getattr(r, "team_role", None),
        }

    # Count registrations per event
    all_regs = await EventRegistration.find().to_list()
    participant_counts = {}
    volunteer_counts = {}
    team_counts = {}
    for r in all_regs:
        eid = str(r.event_id)
        reg_type = getattr(r, "registration_type", "participant")
        reg_status = getattr(r, "status", "accepted")
        if reg_type == "volunteer":
            if reg_status != "rejected":
                volunteer_counts[eid] = volunteer_counts.get(eid, 0) + 1
        else:
            participant_counts[eid] = participant_counts.get(eid, 0) + 1
            if getattr(r, "team_id", None) and getattr(r, "team_role", None) == "leader":
                team_counts[eid] = team_counts.get(eid, 0) + 1

    results = []
    for e in events:
        eid = str(e.id)
        session = getattr(e, "session", None) or _normalize_session(e.event_time)
        slot = getattr(e, "slot", None)
        my_reg = student_reg_map.get(eid)
        results.append({
            "id": eid,
            "name": e.name,
            "description": e.description,
            "club_id": str(e.club_id),
            "club_name": club_map.get(str(e.club_id), "Unknown"),
            "event_date": e.event_date.isoformat() if e.event_date else None,
            "event_time": e.event_time,
            "session": session,
            "slot": slot,
            "venue": e.venue,
            "category": e.category,
            "poster_url": e.poster_url,
            "is_team_event": getattr(e, "is_team_event", False) or False,
            "min_team_size": getattr(e, "min_team_size", 2) or 2,
            "max_team_size": getattr(e, "max_team_size", 4) or 4,
            "max_participants": getattr(e, "max_participants", None),
            "max_teams": getattr(e, "max_teams", None),
            "team_count": max(getattr(e, "team_count", 0) or 0, team_counts.get(eid, 0)),
            "participant_count": max(getattr(e, "participant_count", 0) or 0, participant_counts.get(eid, 0)),
            "is_registered": my_reg is not None,
            "registration_id": my_reg["id"] if my_reg else None,
            "registration_type": my_reg["type"] if my_reg else None,
            "team_id": my_reg.get("team_id") if my_reg else None,
            "team_name": my_reg.get("team_name") if my_reg else None,
            "team_role": my_reg.get("team_role") if my_reg else None,
            "volunteer_status": my_reg["status"] if (my_reg and my_reg["type"] == "volunteer") else None,
            "registered_count": participant_counts.get(eid, 0),
            "volunteers_required": getattr(e, "volunteers_required", 0) or 0,
            "volunteers_registered": volunteer_counts.get(eid, 0),
            "registration_stopped": getattr(e, "registration_stopped", False) or False,
        })
    return results


@router.post("/student/events/{event_id}/register")
async def register_for_event(
    event_id: PydanticObjectId,
    type: str = "participant",
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    """Register for an upcoming event. Validates against duplicate registration and same-day same-session collision."""
    event = await Event.get(event_id)
    if not event or not event.is_published or event.status == EventStatus.COMPLETED:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found or not open for registration")

    if getattr(event, "registration_stopped", False):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Registration has been stopped for this event. Max participants reached."
        )

    student_email = current_user.email.lower()

    # Check if already registered for this event
    existing_reg = await EventRegistration.find_one(
        EventRegistration.event_id == event_id,
        EventRegistration.student_email == student_email,
    )
    if existing_reg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You are already registered for this event")

    # Format event date, session, and slot
    event_date_str = event.event_date.strftime("%Y-%m-%d") if event.event_date else "unknown"
    session = getattr(event, "session", None) or _normalize_session(event.event_time)
    slot = getattr(event, "slot", None)
    session_label = "Morning (FN)" if session == "FN" else "Afternoon (AN)"

    # Collision Check: Cannot register for conflicting slot on same date
    if slot:
        collision = await EventRegistration.find_one({
            "student_email": student_email,
            "event_date_str": event_date_str,
            "$or": [
                {"slot": slot},
                {"session": session, "slot": None},
                {"session": session, "slot": {"$exists": False}},
            ]
        })
    else:
        collision = await EventRegistration.find_one(
            EventRegistration.student_email == student_email,
            EventRegistration.event_date_str == event_date_str,
            EventRegistration.session == session,
        )
    if collision:
        conflicting_event = await Event.get(collision.event_id)
        if not conflicting_event:
            conflicting_event = await SocietyEvent.get(collision.event_id)
        conflict_name = conflicting_event.name if conflicting_event else "another event"
        slot_text = f" in the {slot} slot" if slot else f" in the {session_label} session"
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Registration conflict: You are already registered for '{conflict_name}' on {event_date_str}{slot_text}.",
        )

    if getattr(event, "registration_stopped", False):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Registration has been stopped for this event.")

    if type == "participant":
        max_p = getattr(event, "max_participants", None)
        if max_p is not None and max_p > 0:
            reg_count = await EventRegistration.find(
                {"event_id": event_id, "registration_type": {"$ne": "volunteer"}}
            ).count()
            current_count = max(event.participant_count or 0, reg_count)
            if current_count >= max_p:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Registration limit reached: This event is capped at {max_p} participants."
                )

    # Volunteer capacity check
    if type == "volunteer":
        if (event.volunteers_required or 0) <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Volunteering is not currently open for this event")
        volunteers_registered = await EventRegistration.find(
            EventRegistration.event_id == event_id,
            EventRegistration.registration_type == "volunteer",
            {"$or": [{"status": "accepted"}, {"status": "pending"}]}
        ).count()
        if volunteers_registered >= (event.volunteers_required or 0):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Maximum volunteers already registered for this event")

    # Create registration
    reg = EventRegistration(
        event_id=event.id,
        event=event.name,
        student_id=current_user.id,
        student_name=current_user.name,
        student_email=student_email,
        registration_number=current_user.registration_number,
        department=current_user.department,
        event_date_str=event_date_str,
        session=session,
        slot=slot,
        registration_type=type,
        status="pending" if type == "volunteer" else "accepted",
    )
    await reg.insert()

    # Determine mapped participant role based on event category
    p_cert_type = type
    if type == "participant":
        cat = (event.category or "").strip()
        if cat == "Technical Event":
            p_cert_type = "technical_participant"
        elif cat == "Non-Technical Event":
            p_cert_type = "non_technical_participant"
        elif cat == "Technical Talk":
            p_cert_type = "technical_talk"
        elif "tech" in cat.lower() or cat in ("Workshop", "Hackathon"):
            p_cert_type = "technical_participant"
        else:
            p_cert_type = "non_technical_participant"
    elif type == "volunteer":
        p_cert_type = "student_volunteer"

    from ...models.participant import Participant, ParticipantSource
    existing_p = await Participant.find_one(
        Participant.event_id == event_id,
        Participant.email == student_email
    )
    if not existing_p:
        p = Participant(
            event_id=event.id,
            club_id=event.club_id,
            email=student_email,
            registration_number=current_user.registration_number,
            cert_type=p_cert_type,
            fields={
                "Name": current_user.name or "",
                "Email": student_email,
                "Registration Number": current_user.registration_number or "",
                "Department": current_user.department or "",
                "Role": p_cert_type,
            },
            source=ParticipantSource.REGISTRATION,
            # Attendance-based: participant stays unverified until they mark attendance
            verified=False,
            status="pending" if type == "volunteer" else "registered",
        )
        await p.insert()

    # Update participant count dynamically (volunteers are tracked separately)
    if type == "participant":
        total_participants = await EventRegistration.find(
            {"event_id": event.id, "registration_type": {"$ne": "volunteer"}}
        ).count()
        await event.set({"participant_count": total_participants})

    msg = f"Volunteer request submitted for '{event.name}'. Awaiting club coordinator approval." if type == "volunteer" else f"Successfully registered for '{event.name}'"
    return {
        "message": msg,
        "registration_id": str(reg.id),
        "session": session,
        "slot": slot,
    }


class TeamRegisterRequest(BaseModel):
    team_name: str
    member_roll_nos: List[str] = []


async def _check_teammate_eligibility(
    roll_no: str,
    event_id: PydanticObjectId,
    event_date_str: str,
    session: str,
    slot: Optional[str],
) -> User:
    clean_roll = (roll_no or "").strip()
    if not clean_roll:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Roll number cannot be empty")

    student = await User.find_one({
        "registration_number": {"$regex": f"^{re.escape(clean_roll)}$", "$options": "i"},
        "role": UserRole.STUDENT,
    })
    if not student:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"Student with Roll Number '{clean_roll}' not found in the student database."
        )

    student_email = student.email.lower()

    # Check if already registered for this event
    existing_reg = await EventRegistration.find_one(
        EventRegistration.event_id == event_id,
        EventRegistration.student_email == student_email,
    )
    if existing_reg:
        team_info = f" in team '{existing_reg.team_name}'" if getattr(existing_reg, "team_name", None) else ""
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Student '{student.name}' ({clean_roll}) is already registered for this event{team_info}."
        )

    # Collision Check
    session_label = "Morning (FN)" if session == "FN" else "Afternoon (AN)"
    if slot:
        collision = await EventRegistration.find_one({
            "student_email": student_email,
            "event_date_str": event_date_str,
            "$or": [
                {"slot": slot},
                {"session": session, "slot": None},
                {"session": session, "slot": {"$exists": False}},
            ]
        })
    else:
        collision = await EventRegistration.find_one(
            EventRegistration.student_email == student_email,
            EventRegistration.event_date_str == event_date_str,
            EventRegistration.session == session,
        )

    if collision:
        conflicting_event = await Event.get(collision.event_id) or await SocietyEvent.get(collision.event_id)
        c_name = conflicting_event.name if conflicting_event else "another event"
        slot_text = f" in slot {slot}" if slot else f" in {session_label} session"
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Schedule conflict for '{student.name}' ({clean_roll}): already registered for '{c_name}' on {event_date_str}{slot_text}."
        )

    return student


@router.get("/student/events/{event_id}/check-member")
@router.get("/student/society-events/{event_id}/check-member")
async def check_event_team_member(
    event_id: PydanticObjectId,
    roll_no: str,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    event = await Event.get(event_id)
    if not event:
        event = await SocietyEvent.get(event_id)
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    event_date_str = event.event_date.strftime("%Y-%m-%d") if event.event_date else "unknown"
    session = getattr(event, "session", None) or _normalize_session(event.event_time)
    slot = getattr(event, "slot", None)

    student = await _check_teammate_eligibility(roll_no, event_id, event_date_str, session, slot)
    return {
        "eligible": True,
        "student_id": str(student.id),
        "name": student.name,
        "department": student.department,
        "registration_number": student.registration_number,
        "email": student.email,
    }


@router.post("/student/events/{event_id}/register-team")
async def register_team_for_event(
    event_id: PydanticObjectId,
    body: TeamRegisterRequest,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    event = await Event.get(event_id)
    if not event or event.status != EventStatus.ACTIVE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found or not open for registration")

    if not getattr(event, "is_team_event", False):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This event is configured for solo participation.")

    if getattr(event, "registration_stopped", False):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Registration has been stopped for this event.")

    team_name = (body.team_name or "").strip()
    if not team_name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Team name is required")

    clean_member_rolls = [r.strip().upper() for r in body.member_roll_nos if r and r.strip()]
    leader_roll = (current_user.registration_number or "").strip().upper()
    if leader_roll in clean_member_rolls:
        clean_member_rolls = [r for r in clean_member_rolls if r != leader_roll]

    if len(clean_member_rolls) != len(set(clean_member_rolls)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Duplicate roll numbers detected in team members list")

    total_team_size = 1 + len(clean_member_rolls)
    min_s = getattr(event, "min_team_size", 2) or 2
    max_s = getattr(event, "max_team_size", 4) or 4
    if total_team_size < min_s or total_team_size > max_s:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Team size must be between {min_s} and {max_s} members (including leader). Current: {total_team_size}"
        )

    max_t = getattr(event, "max_teams", None)
    if max_t and max_t > 0:
        teams_count = await EventRegistration.find(
            EventRegistration.event_id == event_id,
            EventRegistration.team_role == "leader",
        ).count()
        if teams_count >= max_t:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Registration limit reached: This event is capped at {max_t} teams."
            )

    max_p = getattr(event, "max_participants", None)
    if max_p and max_p > 0:
        reg_count = await EventRegistration.find(
            {"event_id": event_id, "registration_type": "participant"}
        ).count()
        current_count = max(event.participant_count or 0, reg_count)
        if current_count + total_team_size > max_p:
            available = max(0, max_p - current_count)
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot register team of {total_team_size}: only {available} spot(s) remaining for this event."
            )

    event_date_str = event.event_date.strftime("%Y-%m-%d") if event.event_date else "unknown"
    session = getattr(event, "session", None) or _normalize_session(event.event_time)
    slot = getattr(event, "slot", None)

    leader_email = current_user.email.lower()
    existing_leader_reg = await EventRegistration.find_one(
        EventRegistration.event_id == event_id,
        EventRegistration.student_email == leader_email,
    )
    if existing_leader_reg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You are already registered for this event")

    session_label = "Morning (FN)" if session == "FN" else "Afternoon (AN)"
    if slot:
        collision = await EventRegistration.find_one({
            "student_email": leader_email,
            "event_date_str": event_date_str,
            "$or": [
                {"slot": slot},
                {"session": session, "slot": None},
                {"session": session, "slot": {"$exists": False}},
            ]
        })
    else:
        collision = await EventRegistration.find_one(
            EventRegistration.student_email == leader_email,
            EventRegistration.event_date_str == event_date_str,
            EventRegistration.session == session,
        )
    if collision:
        conflicting_event = await Event.get(collision.event_id) or await SocietyEvent.get(collision.event_id)
        c_name = conflicting_event.name if conflicting_event else "another event"
        slot_text = f" in slot {slot}" if slot else f" in {session_label} session"
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Schedule conflict for you (leader): already registered for '{c_name}' on {event_date_str}{slot_text}."
        )

    member_users = []
    for m_roll in clean_member_rolls:
        m_user = await _check_teammate_eligibility(m_roll, event_id, event_date_str, session, slot)
        member_users.append(m_user)

    team_id = str(uuid4())

    cat = (event.category or "").strip()
    if cat == "Technical Event":
        p_cert_type = "technical_participant"
    elif cat == "Non-Technical Event":
        p_cert_type = "non_technical_participant"
    elif cat == "Technical Talk":
        p_cert_type = "technical_talk"
    elif "tech" in cat.lower() or cat in ("Workshop", "Hackathon"):
        p_cert_type = "technical_participant"
    else:
        p_cert_type = "non_technical_participant"

    all_students_to_register = [
        (current_user, "leader"),
        *[(m_u, "member") for m_u in member_users]
    ]

    from ...models.participant import Participant, ParticipantSource

    for u, role in all_students_to_register:
        u_email = u.email.lower()
        reg = EventRegistration(
            event_id=event.id,
            event=event.name,
            student_id=u.id,
            student_name=u.name,
            student_email=u_email,
            registration_number=u.registration_number,
            department=u.department,
            event_date_str=event_date_str,
            session=session,
            slot=slot,
            registration_type="participant",
            status="accepted",
            team_id=team_id,
            team_name=team_name,
            team_role=role,
        )
        await reg.insert()

        existing_p = await Participant.find_one(
            Participant.event_id == event_id,
            Participant.email == u_email
        )
        if not existing_p:
            p = Participant(
                event_id=event.id,
                club_id=event.club_id,
                email=u_email,
                registration_number=u.registration_number,
                cert_type=p_cert_type,
                fields={
                    "Name": u.name or "",
                    "Email": u_email,
                    "Registration Number": u.registration_number or "",
                    "Department": u.department or "",
                    "Role": p_cert_type,
                },
                source=ParticipantSource.REGISTRATION,
                verified=False,
                status="registered",
                team_id=team_id,
                team_name=team_name,
                team_role=role,
            )
            await p.insert()

    total_participants = await EventRegistration.find(
        {"event_id": event.id, "registration_type": "participant"}
    ).count()
    teams_count = await EventRegistration.find(
        EventRegistration.event_id == event.id,
        EventRegistration.team_role == "leader",
    ).count()
    await event.set({
        "participant_count": total_participants,
        "team_count": teams_count,
    })

    return {
        "message": f"Team '{team_name}' ({total_team_size} members) registered successfully!",
        "team_id": team_id,
        "team_name": team_name,
    }


@router.post("/student/events/{event_id}/cancel-registration")
@router.delete("/student/events/{event_id}/register")
async def cancel_event_registration(
    event_id: PydanticObjectId,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    """Cancel registration for an upcoming event."""
    student_email = current_user.email.lower()
    reg = await EventRegistration.find_one(
        EventRegistration.event_id == event_id,
        EventRegistration.student_email == student_email,
    )
    if not reg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registration record not found")

    from ...models.participant import Participant, ParticipantSource

    if getattr(reg, "team_id", None):
        team_id = reg.team_id
        is_leader = getattr(reg, "team_role", None) == "leader"
        if is_leader:
            team_regs = await EventRegistration.find(
                EventRegistration.event_id == event_id,
                EventRegistration.team_id == team_id,
            ).to_list()
            emails = [r.student_email for r in team_regs]
            for r in team_regs:
                await r.delete()
            team_parts = await Participant.find({
                "event_id": event_id,
                "email": {"$in": emails},
                "source": ParticipantSource.REGISTRATION,
            }).to_list()
            for p in team_parts:
                await p.delete()
            event = await Event.get(event_id)
            if event:
                total_participants = await EventRegistration.find(
                    {"event_id": event_id, "registration_type": {"$ne": "volunteer"}}
                ).count()
                teams_count = await EventRegistration.find(
                    EventRegistration.event_id == event_id,
                    EventRegistration.team_role == "leader",
                ).count()
                await event.set({
                    "participant_count": total_participants,
                    "team_count": teams_count,
                })
            return {"message": f"Team registration for '{reg.team_name or 'team'}' cancelled successfully"}
        else:
            await reg.delete()
            p = await Participant.find_one(
                Participant.event_id == event_id,
                Participant.email == student_email,
                Participant.source == ParticipantSource.REGISTRATION,
            )
            if p:
                await p.delete()
            event = await Event.get(event_id)
            if event:
                total_participants = await EventRegistration.find(
                    {"event_id": event_id, "registration_type": {"$ne": "volunteer"}}
                ).count()
                await event.set({"participant_count": total_participants})
            return {"message": "You have left the team registration"}

    await reg.delete()

    p = await Participant.find_one(
        Participant.event_id == event_id,
        Participant.email == student_email
    )
    if p and p.source == ParticipantSource.REGISTRATION:
        await p.delete()

    event = await Event.get(event_id)
    if event:
        total_participants = await EventRegistration.find(
            {"event_id": event_id, "registration_type": {"$ne": "volunteer"}}
        ).count()
        await event.set({"participant_count": total_participants})

    return {"message": "Registration cancelled successfully"}


# ═══ PROFESSIONAL SOCIETY EVENTS & REGISTRATION ═══════════════════════════════

@router.get("/student/upcoming-society-events")
async def list_upcoming_society_events(
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)

    # Auto-complete past active/closed society events
    past_active = await SocietyEvent.find({
        "status": {"$in": [SocietyEventStatus.ACTIVE.value, SocietyEventStatus.CLOSED.value]},
        "event_date": {"$lt": today_start},
    }).to_list()
    for pe in past_active:
        await pe.set({"status": SocietyEventStatus.COMPLETED.value})

    events = await SocietyEvent.find({
        "$or": [
            {"status": {"$in": [SocietyEventStatus.ACTIVE.value, SocietyEventStatus.CLOSED.value]}},
            {"is_published": True},
        ],
        "status": {"$ne": SocietyEventStatus.COMPLETED.value},
        "event_date": {"$gte": today_start},
        "is_published": True,
    }).sort(+SocietyEvent.event_date).to_list()

    societies = await ProfessionalSociety.find().to_list()
    society_map = {str(s.id): s.name for s in societies}

    # Fetch this student's registrations
    registrations = await EventRegistration.find(
        EventRegistration.student_email == current_user.email.lower(),
    ).to_list()
    student_reg_map = {}
    for r in registrations:
        eid = str(r.event_id)
        reg_type = getattr(r, "registration_type", "participant")
        reg_status = getattr(r, "status", "accepted" if reg_type == "participant" else "pending")
        student_reg_map[eid] = {
            "id": str(r.id),
            "type": reg_type,
            "status": reg_status,
            "team_id": getattr(r, "team_id", None),
            "team_name": getattr(r, "team_name", None),
            "team_role": getattr(r, "team_role", None),
        }

    all_regs = await EventRegistration.find().to_list()
    participant_counts = {}
    volunteer_counts = {}
    team_counts = {}
    for r in all_regs:
        eid = str(r.event_id)
        reg_type = getattr(r, "registration_type", "participant")
        reg_status = getattr(r, "status", "accepted")
        if reg_type == "volunteer":
            if reg_status != "rejected":
                volunteer_counts[eid] = volunteer_counts.get(eid, 0) + 1
        else:
            participant_counts[eid] = participant_counts.get(eid, 0) + 1
            if getattr(r, "team_id", None) and getattr(r, "team_role", None) == "leader":
                team_counts[eid] = team_counts.get(eid, 0) + 1

    results = []
    for e in events:
        eid = str(e.id)
        session = e.session or _normalize_session(e.event_time)
        my_reg = student_reg_map.get(eid)
        results.append({
            "id": eid,
            "name": e.name,
            "description": e.description,
            "society_id": str(e.society_id),
            "society_name": society_map.get(str(e.society_id), "Unknown"),
            "event_date": e.event_date.isoformat() if e.event_date else None,
            "event_time": e.event_time,
            "session": session,
            "venue": e.venue,
            "category": e.category,
            "poster_url": e.poster_url,
            "is_team_event": getattr(e, "is_team_event", False) or False,
            "min_team_size": getattr(e, "min_team_size", 2) or 2,
            "max_team_size": getattr(e, "max_team_size", 4) or 4,
            "max_participants": getattr(e, "max_participants", None),
            "max_teams": getattr(e, "max_teams", None),
            "team_count": max(getattr(e, "team_count", 0) or 0, team_counts.get(eid, 0)),
            "participant_count": max(getattr(e, "participant_count", 0) or 0, participant_counts.get(eid, 0)),
            "is_registered": my_reg is not None,
            "registration_id": my_reg["id"] if my_reg else None,
            "registration_type": my_reg["type"] if my_reg else None,
            "team_id": my_reg.get("team_id") if my_reg else None,
            "team_name": my_reg.get("team_name") if my_reg else None,
            "team_role": my_reg.get("team_role") if my_reg else None,
            "volunteer_status": my_reg["status"] if (my_reg and my_reg["type"] == "volunteer") else None,
            "registered_count": participant_counts.get(eid, 0),
            "volunteers_required": getattr(e, "volunteers_required", 0) or 0,
            "volunteers_registered": volunteer_counts.get(eid, 0),
            "registration_stopped": getattr(e, "registration_stopped", False) or False,
        })
    return results


@router.post("/student/society-events/{event_id}/register")
async def register_for_society_event(
    event_id: PydanticObjectId,
    type: str = "participant",
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    """Register for an upcoming society event."""
    event = await SocietyEvent.get(event_id)
    if not event or (event.status != SocietyEventStatus.ACTIVE and not event.is_published):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Society event not found or not open for registration")

    if getattr(event, "registration_stopped", False):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Registration has been stopped for this event. Max participants reached."
        )

    student_email = current_user.email.lower()

    existing_reg = await EventRegistration.find_one(
        EventRegistration.event_id == event_id,
        EventRegistration.student_email == student_email,
    )
    if existing_reg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You are already registered for this event")

    event_date_str = event.event_date.strftime("%Y-%m-%d") if event.event_date else "unknown"
    session = event.session or _normalize_session(event.event_time)
    slot = getattr(event, "slot", None)
    session_label = "Morning (FN)" if session == "FN" else "Afternoon (AN)"

    if slot:
        collision = await EventRegistration.find_one({
            "student_email": student_email,
            "event_date_str": event_date_str,
            "$or": [
                {"slot": slot},
                {"session": session, "slot": None},
                {"session": session, "slot": {"$exists": False}},
            ]
        })
    else:
        collision = await EventRegistration.find_one(
            EventRegistration.student_email == student_email,
            EventRegistration.event_date_str == event_date_str,
            EventRegistration.session == session,
        )
    if collision:
        conflicting_name = "another event"
        c_event = await SocietyEvent.get(collision.event_id)
        if c_event:
            conflicting_name = c_event.name
        else:
            c_club_event = await Event.get(collision.event_id)
            if c_club_event:
                conflicting_name = c_club_event.name
        slot_text = f" in the {slot} slot" if slot else f" in the {session_label} session"
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Registration conflict: You are already registered for '{conflicting_name}' on {event_date_str}{slot_text}.",
        )

    if getattr(event, "registration_stopped", False):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Registration has been stopped for this event.")

    if type == "participant":
        max_p = getattr(event, "max_participants", None)
        if max_p is not None and max_p > 0:
            reg_count = await EventRegistration.find(
                {"event_id": event_id, "registration_type": {"$ne": "volunteer"}}
            ).count()
            current_count = max(getattr(event, "participant_count", 0) or 0, reg_count)
            if current_count >= max_p:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Registration limit reached: This event is capped at {max_p} participants."
                )

    if type == "volunteer":
        if (event.volunteers_required or 0) <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Volunteering is not currently open for this event")
        volunteers_registered = await EventRegistration.find(
            EventRegistration.event_id == event_id,
            EventRegistration.registration_type == "volunteer",
            {"$or": [{"status": "accepted"}, {"status": "pending"}]}
        ).count()
        if volunteers_registered >= (event.volunteers_required or 0):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Maximum volunteers already registered for this event")

    reg = EventRegistration(
        event_id=event.id,
        event=event.name,
        student_id=current_user.id,
        student_name=current_user.name,
        student_email=student_email,
        registration_number=current_user.registration_number,
        department=current_user.department,
        event_date_str=event_date_str,
        session=session,
        slot=slot,
        registration_type=type,
        status="pending" if type == "volunteer" else "accepted",
    )
    await reg.insert()

    if type == "participant":
        total_participants = await EventRegistration.find(
            {"event_id": event.id, "registration_type": {"$ne": "volunteer"}}
        ).count()
        await event.set({"participant_count": total_participants})

    msg = f"Volunteer request submitted for '{event.name}'. Awaiting coordinator approval." if type == "volunteer" else f"Successfully registered for '{event.name}'"
    return {
        "message": msg,
        "registration_id": str(reg.id),
        "session": session,
        "slot": slot,
    }


@router.post("/student/society-events/{event_id}/register-team")
async def register_team_for_society_event(
    event_id: PydanticObjectId,
    body: TeamRegisterRequest,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    event = await SocietyEvent.get(event_id)
    if not event or event.status != SocietyEventStatus.ACTIVE:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Society event not found or not open for registration")

    if not getattr(event, "is_team_event", False):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This event is configured for solo participation.")

    if getattr(event, "registration_stopped", False):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Registration has been stopped for this event.")

    team_name = (body.team_name or "").strip()
    if not team_name:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Team name is required")

    clean_member_rolls = [r.strip().upper() for r in body.member_roll_nos if r and r.strip()]
    leader_roll = (current_user.registration_number or "").strip().upper()
    if leader_roll in clean_member_rolls:
        clean_member_rolls = [r for r in clean_member_rolls if r != leader_roll]

    if len(clean_member_rolls) != len(set(clean_member_rolls)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Duplicate roll numbers detected in team members list")

    total_team_size = 1 + len(clean_member_rolls)
    min_s = getattr(event, "min_team_size", 2) or 2
    max_s = getattr(event, "max_team_size", 4) or 4
    if total_team_size < min_s or total_team_size > max_s:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Team size must be between {min_s} and {max_s} members (including leader). Current: {total_team_size}"
        )

    max_t = getattr(event, "max_teams", None)
    if max_t and max_t > 0:
        teams_count = await EventRegistration.find(
            EventRegistration.event_id == event_id,
            EventRegistration.team_role == "leader",
        ).count()
        if teams_count >= max_t:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Registration limit reached: This event is capped at {max_t} teams."
            )

    max_p = getattr(event, "max_participants", None)
    if max_p and max_p > 0:
        reg_count = await EventRegistration.find(
            {"event_id": event_id, "registration_type": "participant"}
        ).count()
        current_count = max(event.participant_count or 0, reg_count)
        if current_count + total_team_size > max_p:
            available = max(0, max_p - current_count)
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Cannot register team of {total_team_size}: only {available} spot(s) remaining for this event."
            )

    event_date_str = event.event_date.strftime("%Y-%m-%d") if event.event_date else "unknown"
    session = getattr(event, "session", None) or _normalize_session(event.event_time)
    slot = getattr(event, "slot", None)

    leader_email = current_user.email.lower()
    existing_leader_reg = await EventRegistration.find_one(
        EventRegistration.event_id == event_id,
        EventRegistration.student_email == leader_email,
    )
    if existing_leader_reg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You are already registered for this event")

    session_label = "Morning (FN)" if session == "FN" else "Afternoon (AN)"
    if slot:
        collision = await EventRegistration.find_one({
            "student_email": leader_email,
            "event_date_str": event_date_str,
            "$or": [
                {"slot": slot},
                {"session": session, "slot": None},
                {"session": session, "slot": {"$exists": False}},
            ]
        })
    else:
        collision = await EventRegistration.find_one(
            EventRegistration.student_email == leader_email,
            EventRegistration.event_date_str == event_date_str,
            EventRegistration.session == session,
        )
    if collision:
        conflicting_event = await SocietyEvent.get(collision.event_id) or await Event.get(collision.event_id)
        c_name = conflicting_event.name if conflicting_event else "another event"
        slot_text = f" in slot {slot}" if slot else f" in {session_label} session"
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Schedule conflict for you (leader): already registered for '{c_name}' on {event_date_str}{slot_text}."
        )

    member_users = []
    for m_roll in clean_member_rolls:
        m_user = await _check_teammate_eligibility(m_roll, event_id, event_date_str, session, slot)
        member_users.append(m_user)

    team_id = str(uuid4())
    all_students_to_register = [
        (current_user, "leader"),
        *[(m_u, "member") for m_u in member_users]
    ]

    for u, role in all_students_to_register:
        u_email = u.email.lower()
        reg = EventRegistration(
            event_id=event.id,
            event=event.name,
            student_id=u.id,
            student_name=u.name,
            student_email=u_email,
            registration_number=u.registration_number,
            department=u.department,
            event_date_str=event_date_str,
            session=session,
            slot=slot,
            registration_type="participant",
            status="accepted",
            team_id=team_id,
            team_name=team_name,
            team_role=role,
        )
        await reg.insert()

    total_participants = await EventRegistration.find(
        {"event_id": event.id, "registration_type": "participant"}
    ).count()
    teams_count = await EventRegistration.find(
        EventRegistration.event_id == event.id,
        EventRegistration.team_role == "leader",
    ).count()
    await event.set({
        "participant_count": total_participants,
        "team_count": teams_count,
    })

    return {
        "message": f"Team '{team_name}' ({total_team_size} members) registered successfully!",
        "team_id": team_id,
        "team_name": team_name,
    }


@router.post("/student/society-events/{event_id}/cancel-registration")
@router.delete("/student/society-events/{event_id}/register")
async def cancel_society_event_registration(
    event_id: PydanticObjectId,
    current_user: User = Depends(require_role(UserRole.STUDENT)),
):
    """Cancel registration for an upcoming society event."""
    student_email = current_user.email.lower()
    reg = await EventRegistration.find_one(
        EventRegistration.event_id == event_id,
        EventRegistration.student_email == student_email,
    )
    if not reg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registration record not found")

    if getattr(reg, "team_id", None):
        team_id = reg.team_id
        is_leader = getattr(reg, "team_role", None) == "leader"
        if is_leader:
            team_regs = await EventRegistration.find(
                EventRegistration.event_id == event_id,
                EventRegistration.team_id == team_id,
            ).to_list()
            for r in team_regs:
                await r.delete()
            event = await SocietyEvent.get(event_id)
            if event:
                total_participants = await EventRegistration.find(
                    {"event_id": event_id, "registration_type": {"$ne": "volunteer"}}
                ).count()
                teams_count = await EventRegistration.find(
                    EventRegistration.event_id == event_id,
                    EventRegistration.team_role == "leader",
                ).count()
                await event.set({
                    "participant_count": total_participants,
                    "team_count": teams_count,
                })
            return {"message": f"Team registration for '{reg.team_name or 'team'}' cancelled successfully"}
        else:
            await reg.delete()
            event = await SocietyEvent.get(event_id)
            if event:
                total_participants = await EventRegistration.find(
                    {"event_id": event_id, "registration_type": {"$ne": "volunteer"}}
                ).count()
                await event.set({"participant_count": total_participants})
            return {"message": "You have left the team registration"}

    await reg.delete()

    event = await SocietyEvent.get(event_id)
    if event:
        total_participants = await EventRegistration.find(
            {"event_id": event_id, "registration_type": {"$ne": "volunteer"}}
        ).count()
        await event.set({"participant_count": total_participants})

    return {"message": "Registration cancelled successfully"}
