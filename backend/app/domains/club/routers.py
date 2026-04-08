from typing import List

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ...core.dependencies import get_current_user, require_club_access, require_role
from ...models.user import User, UserRole
from ...models.club import Club
from ...models.event import Event, EventStatus
from ...models.certificate import Certificate, CertStatus
from ...models.email_log import EmailLog, EmailStatus
from ...models.participant import Participant
from ...schemas.club import ClubResponse
from ...schemas.user import UserResponse

router = APIRouter(prefix="/clubs", tags=["Clubs"])
coordinator_router = APIRouter(prefix="/coordinator", tags=["Coordinator"])


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
    total_events = await Event.find(Event.club_id == club_id).count()
    active_events = await Event.find(
        Event.club_id == club_id,
        Event.status == EventStatus.ACTIVE,
    ).count()

    total_certificates_issued = await Certificate.find(
        Certificate.club_id == club_id,
        Certificate.status != CertStatus.PENDING,
    ).count()

    total_participants = await Participant.find(
        Participant.club_id == club_id,
    ).count()

    # EmailLog doesn't have club_id — find via club certificates
    club_cert_ids = [
        c.id
        for c in await Certificate.find(
            Certificate.club_id == club_id,
        ).to_list()
    ]

    pending_emails = 0
    failed_emails = 0
    if club_cert_ids:
        pending_emails = await EmailLog.find(
            {
                "certificate_id": {"$in": club_cert_ids},
                "status": {"$in": [EmailStatus.PENDING.value, EmailStatus.QUEUED.value]},
            },
        ).count()

        failed_emails = await EmailLog.find(
            {"certificate_id": {"$in": club_cert_ids}},
            EmailLog.status == EmailStatus.FAILED,
        ).count()

    # ── Recent events ────────────────────────────────────────────────────────
    recent_events_docs = await Event.find(
        Event.club_id == club_id,
    ).sort(-Event.created_at).limit(5).to_list()

    recent_events = []
    for ev in recent_events_docs:
        p_count = await Participant.find(
            Participant.event_id == ev.id,
        ).count()
        c_count = await Certificate.find(
            Certificate.event_id == ev.id,
            Certificate.status != CertStatus.PENDING,
        ).count()
        recent_events.append({
            "event_id": str(ev.id),
            "name": ev.name,
            "event_date": ev.event_date,
            "status": ev.status.value,
            "participant_count": p_count,
            "cert_count": c_count,
        })

    return {
        "club": _club_response(club),
        "stats": {
            "total_events": total_events,
            "active_events": active_events,
            "total_certificates_issued": total_certificates_issued,
            "total_participants": total_participants,
            "pending_emails": pending_emails,
            "failed_emails": failed_emails,
        },
        "recent_events": recent_events,
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
