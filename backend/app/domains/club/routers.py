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
