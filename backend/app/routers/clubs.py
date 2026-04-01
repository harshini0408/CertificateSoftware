from beanie import PydanticObjectId
from fastapi import APIRouter, Depends

from ..core.dependencies import require_club_access
from ..models.user import User
from ..models.event import Event
from ..models.certificate import Certificate, CertStatus
from ..models.email_log import EmailLog, EmailStatus
from ..schemas.event import DashboardResponse

router = APIRouter(prefix="/clubs", tags=["Clubs"])


@router.get("/{club_id}/dashboard", response_model=DashboardResponse)
async def club_dashboard(
    club_id: PydanticObjectId,
    _user: User = Depends(require_club_access),
):
    event_count = await Event.find(Event.club_id == club_id).count()
    total_certs = await Certificate.find(
        Certificate.club_id == club_id,
        Certificate.status != CertStatus.PENDING,
    ).count()
    pending_emails = await EmailLog.find(
        EmailLog.status.in_([EmailStatus.PENDING, EmailStatus.QUEUED]),
    ).count()

    recent_certs = await Certificate.find(
        Certificate.club_id == club_id
    ).sort(-Certificate.issued_at).limit(10).to_list()

    recent_activity = [
        {"cert_number": c.cert_number, "status": c.status.value,
         "name": c.snapshot.name, "issued_at": c.issued_at}
        for c in recent_certs if c.issued_at
    ]

    return DashboardResponse(
        event_count=event_count,
        total_certs_issued=total_certs,
        pending_emails=pending_emails,
        recent_activity=recent_activity,
    )
