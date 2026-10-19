import hashlib
from datetime import datetime as _datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from beanie import PydanticObjectId
from bson import ObjectId as _ObjId
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from pydantic import BaseModel, Field

from ...core.dependencies import get_current_user, require_role, require_society_access, require_society_event_access
from ...models.user import User, UserRole
from ...models.professional_society import ProfessionalSociety, DEFAULT_SOCIETY_OFFICE_BEARER_POSITIONS
from ...models.society_event import SocietyEvent, SocietyEventStatus
from ...models.student_society_membership import StudentSocietyMembership, SocietyMembershipStatus
from ...models.attendance import Attendance
from ...models.attendance_session import AttendanceSession
from ...schemas.professional_society import SocietyResponse
from ...config import get_settings
from ...services.signature_service import process_signature, save_logo
from ...services.storage_service import storage_path_to_url

settings = get_settings()

router = APIRouter(prefix="/societies", tags=["Professional Societies"])
coordinator_router = APIRouter(prefix="/society-coordinator", tags=["Society Coordinator"])


def _society_response(s: ProfessionalSociety) -> SocietyResponse:
    assets = getattr(s, "assets", None)
    return SocietyResponse(
        id=str(s.id),
        name=s.name,
        slug=s.slug,
        slug_locked=getattr(s, "slug_locked", False) or False,
        contact_email=s.contact_email or "",
        is_active=s.is_active,
        created_at=s.created_at,
        logo_url=getattr(assets, "logo_url", None) if assets else None,
        signature_url=getattr(assets, "signature_url", None) if assets else None,
        signature2_url=getattr(assets, "signature2_url", None) if assets else None,
    )


def _society_assets_ready(society: ProfessionalSociety) -> bool:
    assets = getattr(society, "assets", None)
    return bool(
        assets
        and (assets.logo_path or assets.logo_url)
        and (assets.signature_path or assets.signature_url)
    )


class SocietyEventCreate(BaseModel):
    name: str
    description: Optional[str] = None
    event_date: Optional[_datetime] = None
    event_time: Optional[str] = None
    session: Optional[str] = None  # "FN" or "AN"
    venue: Optional[str] = None
    category: Optional[str] = None
    academic_year: Optional[str] = None
    academic_years: List[str] = Field(default_factory=list)
    max_participants: Optional[int] = None
    volunteers_required: int = 0
    is_published: bool = False


class SocietyEventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[_datetime] = None
    event_time: Optional[str] = None
    session: Optional[str] = None
    venue: Optional[str] = None
    category: Optional[str] = None
    academic_year: Optional[str] = None
    academic_years: Optional[List[str]] = None
    max_participants: Optional[int] = None
    volunteers_required: Optional[int] = None
    registration_stopped: Optional[bool] = None
    status: Optional[str] = None
    is_published: Optional[bool] = None


class ReviewMembershipRequest(BaseModel):
    action: str  # "approve" or "reject"
    review_note: Optional[str] = None


class BulkApproveMembershipsRequest(BaseModel):
    membership_ids: List[str]
    review_note: Optional[str] = None


class AssignOfficeBearerRequest(BaseModel):
    position: str
    student_id: Optional[str] = None
    student_email: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# Public / Authenticated Society Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("", response_model=List[SocietyResponse])
async def list_active_societies(_user: User = Depends(get_current_user)):
    societies = await ProfessionalSociety.find(ProfessionalSociety.is_active == True).to_list()
    return [_society_response(s) for s in societies]


@router.get("/{society_id}", response_model=SocietyResponse)
async def get_society(society_id: PydanticObjectId, _user: User = Depends(get_current_user)):
    society = await ProfessionalSociety.get(society_id)
    if not society or not society.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Professional Society not found or inactive")
    return _society_response(society)


@router.get("/{society_id}/dashboard")
async def society_dashboard(
    society_id: PydanticObjectId,
    _user: User = Depends(require_society_access),
):
    society = await ProfessionalSociety.get(society_id)
    if not society:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Professional Society not found")

    all_events = await SocietyEvent.find(SocietyEvent.society_id == society_id).to_list()
    active_members_count = await StudentSocietyMembership.find({
        "society_id": society_id,
        "status": SocietyMembershipStatus.APPROVED.value,
    }).count()

    total_conducted = len(all_events)
    published_events = [e for e in all_events if e.is_published]

    return {
        "society_id": str(society.id),
        "name": society.name,
        "slug": society.slug,
        "contact_email": society.contact_email or "",
        "total_events": total_conducted,
        "published_events_count": len(published_events),
        "active_members_count": active_members_count,
        "assets_configured": _society_assets_ready(society),
        "office_bearer_positions": society.office_bearer_positions or DEFAULT_SOCIETY_OFFICE_BEARER_POSITIONS,
    }


# ─── Events CRUD ──────────────────────────────────────────────────────────────

@router.get("/{society_id}/events")
async def get_society_events(
    society_id: PydanticObjectId,
    _user: User = Depends(require_society_access),
):
    events = await SocietyEvent.find(SocietyEvent.society_id == society_id).sort("-created_at").to_list()
    return [
        {
            "id": str(e.id),
            "society_id": str(e.society_id),
            "name": e.name,
            "description": e.description,
            "event_date": e.event_date,
            "event_time": e.event_time,
            "session": e.session,
            "venue": e.venue,
            "category": e.category,
            "status": e.status.value if hasattr(e.status, "value") else str(e.status),
            "poster_url": e.poster_url,
            "is_published": e.is_published,
            "max_participants": e.max_participants,
            "participant_count": e.participant_count,
            "volunteers_required": e.volunteers_required,
            "volunteers_registered": e.volunteers_registered,
            "registration_stopped": e.registration_stopped,
            "created_at": e.created_at,
        }
        for e in events
    ]


@router.post("/{society_id}/events", status_code=201)
async def create_society_event(
    society_id: PydanticObjectId,
    body: SocietyEventCreate,
    _user: User = Depends(require_society_access),
):
    society = await ProfessionalSociety.get(society_id)
    if not society:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Professional Society not found")

    status_val = SocietyEventStatus.ACTIVE if body.is_published else SocietyEventStatus.DRAFT
    new_event = SocietyEvent(
        society_id=society_id,
        name=body.name,
        description=body.description,
        event_date=body.event_date,
        event_time=body.event_time,
        session=body.session,
        venue=body.venue,
        category=body.category,
        academic_year=body.academic_year,
        academic_years=body.academic_years or [],
        status=status_val,
        max_participants=body.max_participants,
        volunteers_required=body.volunteers_required,
        is_published=body.is_published,
    )
    await new_event.insert()
    return {"message": "Event created successfully", "id": str(new_event.id)}


@router.get("/{society_id}/events/{event_id}")
async def get_society_event_detail(
    society_id: PydanticObjectId,
    event_id: PydanticObjectId,
    _user: User = Depends(require_society_event_access),
):
    event = await SocietyEvent.get(event_id)
    if not event or event.society_id != society_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    return {
        "id": str(event.id),
        "society_id": str(event.society_id),
        "name": event.name,
        "description": event.description,
        "event_date": event.event_date,
        "event_time": event.event_time,
        "session": event.session,
        "venue": event.venue,
        "category": event.category,
        "academic_year": event.academic_year,
        "academic_years": event.academic_years,
        "status": event.status.value if hasattr(event.status, "value") else str(event.status),
        "poster_url": event.poster_url,
        "is_published": event.is_published,
        "max_participants": event.max_participants,
        "participant_count": event.participant_count,
        "volunteers_required": event.volunteers_required,
        "volunteers_registered": event.volunteers_registered,
        "registration_stopped": event.registration_stopped,
        "report_url": event.report_url,
        "report_status": event.report_status,
        "created_at": event.created_at,
    }


@router.patch("/{society_id}/events/{event_id}")
async def update_society_event(
    society_id: PydanticObjectId,
    event_id: PydanticObjectId,
    body: SocietyEventUpdate,
    _user: User = Depends(require_society_event_access),
):
    event = await SocietyEvent.get(event_id)
    if not event or event.society_id != society_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    updates = body.model_dump(exclude_none=True)
    if "is_published" in updates and "status" not in updates:
        updates["status"] = SocietyEventStatus.ACTIVE if updates["is_published"] else SocietyEventStatus.DRAFT

    if "status" in updates:
        try:
            updates["status"] = SocietyEventStatus(updates["status"])
        except Exception:
            pass

    if updates:
        await event.set(updates)
        event = await SocietyEvent.get(event_id)

    return {"message": "Event updated successfully", "id": str(event.id)}


@router.delete("/{society_id}/events/{event_id}", status_code=204)
async def delete_society_event(
    society_id: PydanticObjectId,
    event_id: PydanticObjectId,
    _user: User = Depends(require_society_event_access),
):
    event = await SocietyEvent.get(event_id)
    if not event or event.society_id != society_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    await event.delete()
    return None


@router.post("/{society_id}/events/{event_id}/poster")
async def upload_society_event_poster(
    society_id: PydanticObjectId,
    event_id: PydanticObjectId,
    poster: UploadFile = File(...),
    _user: User = Depends(require_society_event_access),
):
    event = await SocietyEvent.get(event_id)
    if not event or event.society_id != society_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    content = await poster.read()
    filename = poster.filename or "poster.jpg"
    ext = Path(filename).suffix or ".jpg"
    poster_dir = settings.storage_root / "posters" / f"society_{str(society_id)}"
    poster_dir.mkdir(parents=True, exist_ok=True)
    poster_path = poster_dir / f"{str(event_id)}_poster{ext}"
    poster_path.write_bytes(content)
    poster_url = storage_path_to_url(str(poster_path))

    await event.set({
        "poster_path": str(poster_path),
        "poster_url": poster_url,
    })

    return {"message": "Poster uploaded", "poster_url": poster_url}


# ─── Society Assets (Logo & Signature) ────────────────────────────────────────

@router.post("/{society_id}/assets")
async def update_society_assets(
    society_id: PydanticObjectId,
    logo: UploadFile | None = File(None),
    signature: UploadFile | None = File(None),
    _user: User = Depends(require_society_access),
):
    if not logo and not signature:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload logo or signature")

    society = await ProfessionalSociety.get(society_id)
    if not society:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Professional Society not found")

    assets = society.assets
    slug = society.slug or "society"

    if logo:
        logo_bytes = await logo.read()
        assets.logo_hash = hashlib.md5(logo_bytes).hexdigest()
        assets.logo_path = save_logo(logo_bytes, slug)
        assets.logo_url = storage_path_to_url(assets.logo_path)

    if signature:
        sig_bytes = await signature.read()
        assets.signature_hash = hashlib.md5(sig_bytes).hexdigest()
        assets.signature_path = process_signature(sig_bytes, slug)
        assets.signature_url = storage_path_to_url(assets.signature_path)

    await society.set({"assets": assets.model_dump()})

    return {
        "message": "Society assets updated",
        "assets": {
            "logo_url": assets.logo_url,
            "signature_url": assets.signature_url,
            "is_configured": _society_assets_ready(society),
        },
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Coordinator Router Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@coordinator_router.get("/stats")
async def coordinator_stats(
    current_user: User = Depends(require_role(UserRole.PROFESSIONAL_SOCIETY_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    society = await ProfessionalSociety.get(current_user.society_id) if current_user.society_id else None
    total_events = await SocietyEvent.find(SocietyEvent.society_id == current_user.society_id).count() if current_user.society_id else 0
    active_members = await StudentSocietyMembership.find({
        "society_id": current_user.society_id,
        "status": SocietyMembershipStatus.APPROVED.value,
    }).count() if current_user.society_id else 0

    return {
        "society_name": society.name if society else "",
        "total_events": total_events,
        "active_members_count": active_members,
    }


@coordinator_router.get("/memberships/requests")
async def get_membership_requests(
    current_user: User = Depends(require_role(UserRole.PROFESSIONAL_SOCIETY_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    if not current_user.society_id and current_user.role != UserRole.SUPER_ADMIN:
        return []

    society_id = current_user.society_id
    query: dict[str, Any] = {}
    if society_id:
        query["society_id"] = society_id

    memberships = await StudentSocietyMembership.find(query).sort("-applied_at").to_list()
    return [
        {
            "id": str(m.id),
            "student_id": str(m.student_id),
            "student_name": m.student_name,
            "student_email": m.student_email,
            "society_id": str(m.society_id),
            "society_name": m.society_name,
            "status": m.status.value,
            "applied_at": m.applied_at,
            "office_bearer_role": m.office_bearer_role,
            "review_note": m.review_note,
        }
        for m in memberships
    ]


@coordinator_router.patch("/memberships/requests/bulk-approve")
async def bulk_approve_memberships(
    body: BulkApproveMembershipsRequest,
    current_user: User = Depends(require_role(UserRole.PROFESSIONAL_SOCIETY_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    if not body.membership_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No membership IDs provided")

    approved_count = 0
    now = _datetime.utcnow()
    reviewer_id = str(current_user.id)
    note = (body.review_note or "").strip() or None

    for m_id_str in body.membership_ids:
        try:
            m_id = PydanticObjectId(m_id_str)
        except Exception:
            continue

        membership = await StudentSocietyMembership.get(m_id)
        if not membership:
            continue

        if current_user.role == UserRole.PROFESSIONAL_SOCIETY_COORDINATOR:
            if not current_user.society_id or membership.society_id != current_user.society_id:
                continue

        if membership.status != SocietyMembershipStatus.PENDING:
            continue

        membership.status = SocietyMembershipStatus.APPROVED
        membership.reviewed_by = reviewer_id
        membership.review_note = note
        membership.updated_at = now
        await membership.save()
        approved_count += 1

    return {
        "message": f"Successfully approved {approved_count} membership request(s)",
        "approved_count": approved_count,
    }


@coordinator_router.patch("/memberships/{membership_id}")
async def review_single_membership(
    membership_id: PydanticObjectId,
    body: ReviewMembershipRequest,
    current_user: User = Depends(require_role(UserRole.PROFESSIONAL_SOCIETY_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    membership = await StudentSocietyMembership.get(membership_id)
    if not membership:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membership request not found")

    if current_user.role == UserRole.PROFESSIONAL_SOCIETY_COORDINATOR:
        if current_user.society_id != membership.society_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this membership")

    if body.action == "approve":
        membership.status = SocietyMembershipStatus.APPROVED
    elif body.action == "reject":
        membership.status = SocietyMembershipStatus.REJECTED
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Action must be 'approve' or 'reject'")

    membership.reviewed_by = str(current_user.id)
    membership.review_note = body.review_note
    membership.updated_at = _datetime.utcnow()
    await membership.save()

    return {"message": f"Membership {body.action}d successfully"}


@coordinator_router.delete("/memberships/{membership_id}")
async def delete_or_remove_membership(
    membership_id: PydanticObjectId,
    current_user: User = Depends(require_role(UserRole.PROFESSIONAL_SOCIETY_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    """Delete a membership request or remove a student member from this society."""
    membership = await StudentSocietyMembership.get(membership_id)
    if not membership:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membership not found")

    if current_user.role == UserRole.PROFESSIONAL_SOCIETY_COORDINATOR:
        if current_user.society_id != membership.society_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this membership")

    await membership.delete()
    return {"message": "Membership removed successfully"}


# ─── Office Bearers ───────────────────────────────────────────────────────────

@coordinator_router.get("/office-bearers")
async def get_office_bearers(
    current_user: User = Depends(require_role(UserRole.PROFESSIONAL_SOCIETY_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    society_id = current_user.society_id
    if not society_id:
        return {"positions": DEFAULT_SOCIETY_OFFICE_BEARER_POSITIONS, "office_bearers": []}

    society = await ProfessionalSociety.get(society_id)
    positions = society.office_bearer_positions if society and society.office_bearer_positions else DEFAULT_SOCIETY_OFFICE_BEARER_POSITIONS

    members = await StudentSocietyMembership.find({
        "society_id": society_id,
        "office_bearer_role": {"$ne": None},
    }).to_list()

    return {
        "positions": positions,
        "office_bearers": [
            {
                "id": str(m.id),
                "student_id": str(m.student_id),
                "student_name": m.student_name,
                "student_email": m.student_email,
                "position": m.office_bearer_role,
            }
            for m in members
        ],
    }


@coordinator_router.post("/office-bearers")
async def assign_office_bearer(
    body: AssignOfficeBearerRequest,
    current_user: User = Depends(require_role(UserRole.PROFESSIONAL_SOCIETY_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    society_id = current_user.society_id
    if not society_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No society assigned to coordinator")

    position = body.position.strip()
    if not position:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Position name is required")

    # Find the student's approved membership in this society
    query: dict[str, Any] = {
        "society_id": society_id,
        "status": SocietyMembershipStatus.APPROVED.value,
    }
    if body.student_id:
        query["student_id"] = PydanticObjectId(body.student_id)
    elif body.student_email:
        query["student_email"] = body.student_email.strip().lower()
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Student ID or Email is required")

    membership = await StudentSocietyMembership.find_one(query)
    if not membership:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Student must be an approved member of this professional society to become an office bearer.",
        )

    # Clear position from existing holder if exact match
    existing_holder = await StudentSocietyMembership.find_one({
        "society_id": society_id,
        "office_bearer_role": position,
    })
    if existing_holder and existing_holder.id != membership.id:
        existing_holder.office_bearer_role = None
        await existing_holder.save()

    membership.office_bearer_role = position
    membership.updated_at = _datetime.utcnow()
    await membership.save()

    return {"message": f"Assigned {position} to {membership.student_name}"}


@coordinator_router.delete("/office-bearers/{position}")
async def remove_office_bearer(
    position: str,
    current_user: User = Depends(require_role(UserRole.PROFESSIONAL_SOCIETY_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    society_id = current_user.society_id
    if not society_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No society assigned to coordinator")

    pos_clean = position.strip()
    holder = await StudentSocietyMembership.find_one({
        "society_id": society_id,
        "office_bearer_role": pos_clean,
    })
    if holder:
        holder.office_bearer_role = None
        holder.updated_at = _datetime.utcnow()
        await holder.save()

    return {"message": f"Office bearer position '{pos_clean}' unassigned"}


# ─── Active Members ───────────────────────────────────────────────────────────

@coordinator_router.get("/active-members")
async def get_active_members(
    current_user: User = Depends(require_role(UserRole.PROFESSIONAL_SOCIETY_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    society_id = current_user.society_id
    if not society_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No society assigned to coordinator")

    approved_memberships = await StudentSocietyMembership.find({
        "society_id": society_id,
        "status": SocietyMembershipStatus.APPROVED.value,
    }).to_list()

    return [
        {
            "id": str(m.id),
            "student_id": str(m.student_id),
            "student_name": m.student_name,
            "student_email": m.student_email,
            "registration_number": getattr(m, "registration_number", None),
            "office_bearer_role": m.office_bearer_role,
            "applied_at": m.applied_at,
        }
        for m in approved_memberships
    ]
