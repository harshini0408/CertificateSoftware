import hashlib
from pathlib import Path
from typing import List

from beanie import PydanticObjectId
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from ...core.dependencies import get_current_user, require_club_access, require_role
from ...models.user import User, UserRole
from ...models.club import Club
from ...models.event import Event
from ...models.certificate import Certificate, CertStatus
from ...models.participant import Participant
from ...schemas.club import ClubResponse
from ...schemas.user import UserResponse
from ...models.student_club_membership import StudentClubMembership, MembershipStatus
from ...services.signature_service import process_signature, save_logo
from ...services.storage_service import storage_path_to_url, storage_url_to_path

router = APIRouter(prefix="/clubs", tags=["Clubs"])
coordinator_router = APIRouter(prefix="/coordinator", tags=["Coordinator"])


def _issued_status_candidates() -> list[str]:
    return [
        CertStatus.GENERATED.value,
        CertStatus.EMAILED.value,
        "GENERATED",
        "EMAILED",
        "CertStatus.GENERATED",
        "CertStatus.EMAILED",
    ]


async def _count_event_certificates(event_id: PydanticObjectId) -> int:
    oid = ObjectId(str(event_id))
    issued_count = await Certificate.find({
        "$or": [{"event_id": oid}, {"event_id": str(event_id)}],
        "status": {"$in": _issued_status_candidates()},
    }).count()
    if issued_count > 0:
        return issued_count
    return await Certificate.find({
        "$or": [{"event_id": oid}, {"event_id": str(event_id)}],
    }).count()


# ── Helper builders ──────────────────────────────────────────────────────────

def _club_response(c: Club) -> ClubResponse:
    return ClubResponse(
        id=str(c.id),
        name=c.name,
        slug=c.slug,
        contact_email=c.contact_email or "",
        is_active=c.is_active,
        created_at=c.created_at,
    )


def _user_response(u: User) -> UserResponse:
    return UserResponse(
        id=str(u.id),
        username=u.username,
        name=u.name,
        email=u.email,
        role=u.role.value,
        is_active=u.is_active,
        created_at=u.created_at,
        club_id=str(u.club_id) if u.club_id else None,
        event_id=str(u.event_id) if u.event_id else None,
        department=u.department,
        registration_number=u.registration_number,
        batch=u.batch,
        section=u.section,
    )


def _club_assets_ready(club: Club) -> bool:
    assets = getattr(club, "assets", None)
    return bool(
        assets
        and (assets.logo_path or assets.logo_url)
        and (assets.signature_path or assets.signature_url)
    )


# ═══ GET /clubs ══════════════════════════════════════════════════════════════

@router.get("", response_model=List[ClubResponse])
async def list_clubs(_user: User = Depends(get_current_user)):
    # Any authenticated user could potentially list active clubs (used by Guest dashboard)
    # We could restrict to GUEST and SUPER_ADMIN
    clubs = await Club.find(Club.is_active == True).to_list()
    return [_club_response(c) for c in clubs]


# ═══ GET /clubs/{club_id} ════════════════════════════════════════════════════

@router.get("/{club_id}", response_model=ClubResponse)
async def get_club(
    club_id: PydanticObjectId,
    _user: User = Depends(require_club_access),
):
    club = await Club.get(club_id)
    if not club or not club.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found or inactive")
    return _club_response(club)


# ═══ GET /clubs/{club_id}/dashboard ══════════════════════════════════════════

@router.get("/{club_id}/dashboard")
async def club_dashboard(
    club_id: PydanticObjectId,
    _user: User = Depends(require_club_access),
):
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")

    # ── Stats ────────────────────────────────────────────────────────────────
    all_events = await Event.find(Event.club_id == club_id).to_list()
    event_ids = [ev.id for ev in all_events]
    certs = await Certificate.find({"event_id": {"$in": event_ids}}).to_list() if event_ids else []
    certs_by_event: dict[str, list[Certificate]] = {}
    for cert in certs:
        certs_by_event.setdefault(str(cert.event_id), []).append(cert)

    completed_events = []
    for ev in all_events:
        event_certs = certs_by_event.get(str(ev.id), [])
        if not event_certs:
            continue
        if any(cert.status != CertStatus.EMAILED for cert in event_certs):
            continue
        completed_events.append(ev)

    completed_event_ids = [ev.id for ev in completed_events]
    total_events = len(completed_events)
    total_certificates_issued = sum(len(certs_by_event.get(str(ev.id), [])) for ev in completed_events)
    total_participants = await Participant.find(
        {"event_id": {"$in": completed_event_ids}},
    ).count() if completed_event_ids else 0

    # ── Recent events ────────────────────────────────────────────────────────
    recent_events_docs = sorted(completed_events, key=lambda e: e.created_at, reverse=True)[:5]

    recent_events = []
    for ev in recent_events_docs:
        p_count = await Participant.find(Participant.event_id == ev.id).count()
        c_count = len(certs_by_event.get(str(ev.id), []))
        recent_events.append({
            "event_id": str(ev.id),
            "name": ev.name,
            "event_date": ev.event_date,
            "status": ev.status.value,
            "participant_count": p_count,
            "cert_count": c_count,
        })

    club_payload = _club_response(club).model_dump()
    if not club_payload.get("contact_email"):
        coordinator = await User.find_one(
            User.club_id == club_id,
            User.role == UserRole.CLUB_COORDINATOR,
        )
        if coordinator and coordinator.email:
            club_payload["contact_email"] = coordinator.email

    return {
        "club": club_payload,
        "stats": {
            "total_events": total_events,
            "total_certificates_issued": total_certificates_issued,
            "total_participants": total_participants,
        },
        "recent_events": recent_events,
        "assets_configured": _club_assets_ready(club),
    }


@router.get("/{club_id}/assets")
async def get_club_assets(
    club_id: PydanticObjectId,
    _user: User = Depends(require_club_access),
):
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")

    assets = club.assets
    updated = False

    if assets.logo_path and (not assets.logo_url or not str(assets.logo_url).startswith("/storage/")):
        assets.logo_url = storage_path_to_url(assets.logo_path)
        updated = True
    if assets.signature_path and (not assets.signature_url or not str(assets.signature_url).startswith("/storage/")):
        assets.signature_url = storage_path_to_url(assets.signature_path)
        updated = True

    if not assets.logo_path and assets.logo_url:
        inferred_logo_path = storage_url_to_path(assets.logo_url)
        if inferred_logo_path and Path(inferred_logo_path).exists():
            assets.logo_path = inferred_logo_path
            updated = True
    if not assets.signature_path and assets.signature_url:
        inferred_sig_path = storage_url_to_path(assets.signature_url)
        if inferred_sig_path and Path(inferred_sig_path).exists():
            assets.signature_path = inferred_sig_path
            updated = True

    if updated:
        await club.set({"assets": assets.model_dump()})

    return {
        "logo_url": assets.logo_url,
        "logo_hash": assets.logo_hash,
        "signature_url": assets.signature_url,
        "signature_hash": assets.signature_hash,
        "is_configured": _club_assets_ready(club),
    }

@router.post("/{club_id}/assets")
async def update_club_assets(
    club_id: PydanticObjectId,
    logo: UploadFile | None = File(None),
    signature: UploadFile | None = File(None),
    _user: User = Depends(require_club_access),
):
    if not logo and not signature:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Upload logo or signature")

    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")

    assets = club.assets
    club_slug = club.slug or "club"

    if logo:
        logo_bytes = await logo.read()
        assets.logo_hash = hashlib.md5(logo_bytes).hexdigest()
        assets.logo_path = save_logo(logo_bytes, club_slug)
        assets.logo_url = storage_path_to_url(assets.logo_path)

    if signature:
        sig_bytes = await signature.read()
        assets.signature_hash = hashlib.md5(sig_bytes).hexdigest()
        assets.signature_path = process_signature(sig_bytes, club_slug)
        assets.signature_url = storage_path_to_url(assets.signature_path)

    await club.set({"assets": assets.model_dump()})
    await Event.find(Event.club_id == club_id).update_many({"$set": {"assets": assets.model_dump()}})

    return {
        "message": "Club assets updated",
        "assets": {
            "logo_url": assets.logo_url,
            "logo_hash": assets.logo_hash,
            "signature_url": assets.signature_url,
            "signature_hash": assets.signature_hash,
            "is_configured": _club_assets_ready(club),
        },
    }


# ═══ GET /clubs/{club_id}/members ════════════════════════════════════════════

@router.get("/{club_id}/members", response_model=List[UserResponse])
async def club_members(
    club_id: PydanticObjectId,
    _user: User = Depends(require_club_access),
):
    # Only super_admin and club_coordinator of this club can view members
    if _user.role == UserRole.GUEST:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Guests cannot view the member list",
        )

    users = await User.find(User.club_id == club_id).to_list()
    return [_user_response(u) for u in users]


@coordinator_router.get("/stats")
async def coordinator_stats(
    current_user: User = Depends(require_role(UserRole.CLUB_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    club = await Club.get(current_user.club_id) if current_user.club_id else None
    total_events = await Event.find(Event.club_id == current_user.club_id).count()
    total_certs = await Certificate.find({"club_id": current_user.club_id}).count()
    return {
        "club_name": club.name if club else "",
        "total_events": total_events,
        "total_certificates": total_certs,
    }


@coordinator_router.get("/events")
async def coordinator_events(
    current_user: User = Depends(require_role(UserRole.CLUB_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    events = await Event.find(Event.club_id == current_user.club_id).sort("-created_at").to_list()
    return [
        {
            "id": str(e.id),
            "name": e.name,
            "status": e.status.value,
            "event_date": e.event_date,
        }
        for e in events
    ]


# ─── GET /coordinator/memberships/requests ────────────────────────────────────────

@coordinator_router.get("/memberships/requests")
async def list_membership_requests(
    current_user: User = Depends(require_role(UserRole.CLUB_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    """List all pending membership requests for the coordinator's club."""
    if not current_user.club_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No club assigned to this coordinator")

    memberships = await StudentClubMembership.find(
        StudentClubMembership.club_id == current_user.club_id
    ).sort("-applied_at").to_list()

    return [
        {
            "id": str(m.id),
            "student_id": str(m.student_id),
            "student_name": m.student_name or "",
            "student_email": m.student_email or "",
            "status": m.status.value,
            "applied_at": m.applied_at,
            "updated_at": m.updated_at,
            "review_note": m.review_note,
            "office_bearer_role": m.office_bearer_role,
        }
        for m in memberships
    ]


# ─── PUT /coordinator/memberships/{membership_id}/status ──────────────────────

from pydantic import BaseModel as _BaseModel
from datetime import datetime as _datetime
from beanie import PydanticObjectId as _ObjId


class MembershipStatusUpdateBody(_BaseModel):
    status: str  # "approved" or "rejected"
    review_note: str | None = None


@coordinator_router.put("/memberships/{membership_id}/status")
async def update_membership_status(
    membership_id: _ObjId,
    body: MembershipStatusUpdateBody,
    current_user: User = Depends(require_role(UserRole.CLUB_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    """Approve or reject a student's club membership request."""
    new_status_str = (body.status or "").strip().lower()
    if new_status_str not in (MembershipStatus.APPROVED.value, MembershipStatus.REJECTED.value):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "status must be 'approved' or 'rejected'")

    membership = await StudentClubMembership.get(membership_id)
    if not membership:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Membership request not found")

    # Ensure coordinator only manages their own club's memberships (unless super_admin)
    if current_user.role == UserRole.CLUB_COORDINATOR:
        if not current_user.club_id or membership.club_id != current_user.club_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this membership request")

    if membership.status not in (MembershipStatus.PENDING,):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only pending requests can be reviewed")

    membership.status = MembershipStatus(new_status_str)
    membership.reviewed_by = str(current_user.id)
    membership.review_note = (body.review_note or "").strip() or None
    membership.updated_at = _datetime.utcnow()
    await membership.save()

    return {
        "message": f"Membership request {new_status_str}",
        "id": str(membership.id),
        "status": membership.status.value,
    }


# ─── Office Bearers ─────────────────────────────────────────────────────────────

from ...models.club import DEFAULT_OFFICE_BEARER_POSITIONS


async def _get_club_positions(club: Club) -> list[str]:
    """Return the club's office bearer positions, falling back to defaults."""
    positions = getattr(club, "office_bearer_positions", None)
    if positions and len(positions) > 0:
        return list(positions)
    return list(DEFAULT_OFFICE_BEARER_POSITIONS)


class AllocateOfficeBearerBody(_BaseModel):
    position: str
    student_id: str


class AddPositionBody(_BaseModel):
    position: str


@coordinator_router.get("/office-bearers")
async def get_office_bearers(
    current_user: User = Depends(require_role(UserRole.CLUB_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    """Get office bearer allocations and approved members for the coordinator's club."""
    if not current_user.club_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No club assigned to this coordinator")

    club = await Club.get(current_user.club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")

    positions = await _get_club_positions(club)

    approved_memberships = await StudentClubMembership.find({
        "club_id": current_user.club_id,
        "status": MembershipStatus.APPROVED.value,
    }).to_list()

    student_ids = [m.student_id for m in approved_memberships]
    users = await User.find({"_id": {"$in": student_ids}}).to_list() if student_ids else []
    user_map = {str(u.id): u for u in users}

    approved_members = []
    allocations = {pos: None for pos in positions}

    for m in approved_memberships:
        u = user_map.get(str(m.student_id))
        item = {
            "membership_id": str(m.id),
            "student_id": str(m.student_id),
            "name": m.student_name or (u.name if u else ""),
            "email": m.student_email or (u.email if u else ""),
            "registration_number": u.registration_number if u else None,
            "department": u.department if u else None,
            "batch": u.batch if u else None,
            "section": u.section if u else None,
            "office_bearer_role": m.office_bearer_role,
        }
        approved_members.append(item)
        if m.office_bearer_role and m.office_bearer_role in allocations:
            allocations[m.office_bearer_role] = item
        elif m.office_bearer_role and m.office_bearer_role not in allocations:
            # Role exists in membership but position was removed from list – still show it
            allocations[m.office_bearer_role] = item
            if m.office_bearer_role not in positions:
                positions.append(m.office_bearer_role)

    return {
        "positions": positions,
        "allocations": allocations,
        "approved_members": approved_members,
    }


@coordinator_router.post("/office-bearers/positions")
async def add_office_bearer_position(
    body: AddPositionBody,
    current_user: User = Depends(require_role(UserRole.CLUB_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    """Add a new custom office bearer position for the coordinator's club."""
    if not current_user.club_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No club assigned to this coordinator")

    club = await Club.get(current_user.club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")

    new_position = (body.position or "").strip()
    if not new_position:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Position name cannot be empty")

    current_positions = await _get_club_positions(club)
    # Case-insensitive duplicate check
    if any(p.lower() == new_position.lower() for p in current_positions):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Position '{new_position}' already exists",
        )

    current_positions.append(new_position)
    club.office_bearer_positions = current_positions
    await club.save()

    return {
        "message": f"Position '{new_position}' added successfully",
        "positions": current_positions,
    }


@coordinator_router.delete("/office-bearers/positions/{position}")
async def delete_office_bearer_position(
    position: str,
    current_user: User = Depends(require_role(UserRole.CLUB_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    """Remove a custom office bearer position and unassign any holder."""
    if not current_user.club_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No club assigned to this coordinator")

    club = await Club.get(current_user.club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")

    pos_clean = position.strip()
    current_positions = await _get_club_positions(club)

    if pos_clean not in current_positions:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Position '{pos_clean}' not found")

    # Unassign any holder of this position
    holder = await StudentClubMembership.find_one({
        "club_id": current_user.club_id,
        "office_bearer_role": pos_clean,
    })
    if holder:
        holder.office_bearer_role = None
        holder.updated_at = _datetime.utcnow()
        await holder.save()

    current_positions.remove(pos_clean)
    club.office_bearer_positions = current_positions
    await club.save()

    return {
        "message": f"Position '{pos_clean}' removed",
        "positions": current_positions,
    }


@coordinator_router.post("/office-bearers/allocate")
async def allocate_office_bearer(
    body: AllocateOfficeBearerBody,
    current_user: User = Depends(require_role(UserRole.CLUB_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    """Allocate an approved club member to an office bearer position."""
    if not current_user.club_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No club assigned to this coordinator")

    club = await Club.get(current_user.club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")

    position = (body.position or "").strip()
    valid_positions = await _get_club_positions(club)
    if position not in valid_positions:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Invalid position. Must be one of: {', '.join(valid_positions)}",
        )

    try:
        target_student_id = _ObjId(body.student_id)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid student_id")

    # Verify target student is an approved member of this club
    target_membership = await StudentClubMembership.find_one({
        "club_id": current_user.club_id,
        "student_id": target_student_id,
        "status": MembershipStatus.APPROVED.value,
    })
    if not target_membership:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Selected student must be an approved member of this club",
        )

    # Exclusivity Check: Ensure student is NOT an office bearer in ANY club (including another role in this club)
    existing_ob = await StudentClubMembership.find_one({
        "student_id": target_student_id,
        "office_bearer_role": {"$ne": None},
    })
    if existing_ob and (existing_ob.id != target_membership.id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Student {target_membership.student_name or ''} is already an office bearer ({existing_ob.office_bearer_role}) in {existing_ob.club_name or 'another club'}. A student can be an office bearer in at most one club and position.",
        )

    # Clear position if held by another member in this club
    previous_holder = await StudentClubMembership.find_one({
        "club_id": current_user.club_id,
        "office_bearer_role": position,
    })
    if previous_holder and previous_holder.id != target_membership.id:
        previous_holder.office_bearer_role = None
        await previous_holder.save()

    # Assign position to target student
    target_membership.office_bearer_role = position
    target_membership.updated_at = _datetime.utcnow()
    await target_membership.save()

    return {
        "message": f"Successfully allocated {position} to {target_membership.student_name}",
        "position": position,
        "student_id": str(target_student_id),
    }


@coordinator_router.delete("/office-bearers/{position}")
async def remove_office_bearer(
    position: str,
    current_user: User = Depends(require_role(UserRole.CLUB_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    """Remove/unassign an office bearer position for the coordinator's club."""
    if not current_user.club_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No club assigned to this coordinator")

    pos_clean = position.strip()
    holder = await StudentClubMembership.find_one({
        "club_id": current_user.club_id,
        "office_bearer_role": pos_clean,
    })
    if holder:
        holder.office_bearer_role = None
        holder.updated_at = _datetime.utcnow()
        await holder.save()

    return {"message": f"Office bearer position '{pos_clean}' unassigned"}


# ─── Active Members ─────────────────────────────────────────────────────────────

@coordinator_router.get("/active-members")
async def get_active_members(
    current_user: User = Depends(require_role(UserRole.CLUB_COORDINATOR, UserRole.SUPER_ADMIN)),
):
    """List all students with their membership status and cumulative event participation for this club."""
    if not current_user.club_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No club assigned to this coordinator")

    club_id = current_user.club_id

    # 1. Get all events conducted by this club
    all_events = await Event.find(Event.club_id == club_id).to_list()
    total_events = len(all_events)
    event_ids = [ev.id for ev in all_events]

    # 2. Get all approved memberships for this club
    approved_memberships = await StudentClubMembership.find({
        "club_id": club_id,
        "status": MembershipStatus.APPROVED.value,
    }).to_list()
    approved_student_ids = {str(m.student_id) for m in approved_memberships}
    approved_emails = set()
    for m in approved_memberships:
        if m.student_email:
            approved_emails.add(m.student_email.strip().lower())

    # 3. Get all participants for club events
    participants = await Participant.find({
        "event_id": {"$in": event_ids},
    }).to_list() if event_ids else []

    # Build a mapping: student_email -> set of event_ids they participated in
    email_to_events: dict[str, set] = {}
    for p in participants:
        email_key = (p.email or "").strip().lower()
        if email_key:
            email_to_events.setdefault(email_key, set()).add(str(p.event_id))

    # 4. Collect all unique student emails from participants
    all_participant_emails = set(email_to_events.keys())

    # 5. Fetch User records for approved members and participants
    user_query_clauses = []
    if approved_emails:
        user_query_clauses.append({"email": {"$in": list(approved_emails)}})
    if all_participant_emails:
        user_query_clauses.append({"email": {"$in": list(all_participant_emails)}})

    if user_query_clauses:
        users = await User.find({
            "role": UserRole.STUDENT,
            "$or": user_query_clauses,
        }).to_list()
    else:
        users = []

    # Also fetch approved member users by ID if their email wasn't found
    member_user_ids = [m.student_id for m in approved_memberships]
    member_users = await User.find({"_id": {"$in": member_user_ids}}).to_list() if member_user_ids else []

    # Build user map by email and by id
    user_map_by_email: dict[str, User] = {}
    user_map_by_id: dict[str, User] = {}
    for u in users:
        email_key = (u.email or "").strip().lower()
        if email_key:
            user_map_by_email[email_key] = u
        user_map_by_id[str(u.id)] = u
    for u in member_users:
        user_map_by_id[str(u.id)] = u
        email_key = (u.email or "").strip().lower()
        if email_key:
            user_map_by_email[email_key] = u

    # 6. Build the result: include all approved members + any participants who are students
    seen_emails: set[str] = set()
    result = []

    # First add all approved members
    for m in approved_memberships:
        u = user_map_by_id.get(str(m.student_id))
        email_key = ""
        if m.student_email:
            email_key = m.student_email.strip().lower()
        elif u and u.email:
            email_key = u.email.strip().lower()

        if email_key in seen_emails:
            continue
        seen_emails.add(email_key)

        events_set = email_to_events.get(email_key, set())
        events_participated = len(events_set)

        result.append({
            "name": m.student_name or (u.name if u else ""),
            "registration_number": u.registration_number if u else None,
            "department": u.department if u else None,
            "email": email_key or (m.student_email or ""),
            "is_member": True,
            "membership_status": "Yes",
            "events_participated": events_participated,
            "total_events": total_events,
            "participation_ratio": f"{events_participated}/{total_events}",
            "participation_percentage": round((events_participated / total_events * 100), 1) if total_events > 0 else 0,
        })

    # Then add any participants who are students but not approved members
    for email_key, events_set in email_to_events.items():
        if email_key in seen_emails:
            continue
        seen_emails.add(email_key)

        u = user_map_by_email.get(email_key)
        if not u:
            continue  # Not a registered student

        events_participated = len(events_set)

        result.append({
            "name": u.name,
            "registration_number": u.registration_number,
            "department": u.department,
            "email": email_key,
            "is_member": False,
            "membership_status": "No",
            "events_participated": events_participated,
            "total_events": total_events,
            "participation_ratio": f"{events_participated}/{total_events}",
            "participation_percentage": round((events_participated / total_events * 100), 1) if total_events > 0 else 0,
        })

    # Sort by participation descending, then by name
    result.sort(key=lambda r: (-r["events_participated"], r["name"].lower()))

    return {
        "total_events": total_events,
        "total_approved_members": len(approved_memberships),
        "total_students": len(result),
        "members": result,
    }
