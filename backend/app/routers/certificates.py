from datetime import datetime
from pathlib import Path
from typing import List

from beanie import PydanticObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from ..config import get_settings
from ..core.dependencies import require_event_access
from ..models.user import User
from ..models.club import Club
from ..models.event import Event
from ..models.participant import Participant
from ..models.template import Template
from ..models.certificate import Certificate, CertStatus, CertSnapshot
from ..models.email_log import EmailLog, EmailStatus
from ..schemas.certificate import CertificateResponse, GenerateResponse
from ..services.cert_number import generate_cert_number
from ..services.qr_service import generate_qr_base64
from ..services.template_renderer import render_certificate
from ..services.png_generator import generate_png
from ..services.storage_service import save_cert_png
from ..services.email_service import send_certificate_email, get_daily_sent_count
from ..services.credit_service import award_credits

router = APIRouter(
    prefix="/clubs/{club_id}/events/{event_id}/certificates", tags=["Certificates"]
)
settings = get_settings()


# ── Background task: generate single certificate + email ─────────────────

async def _generate_and_email_one(cert_id: PydanticObjectId) -> None:
    cert = await Certificate.get(cert_id)
    if not cert:
        return

    try:
        participant = await Participant.get(cert.participant_id)
        template = await Template.get(cert.template_id)
        club = await Club.get(cert.club_id)
        if not participant or not template or not club:
            await cert.set({"status": CertStatus.FAILED})
            return

        event = await Event.get(cert.event_id)
        qr_url = f"{settings.base_url}/verify/{cert.cert_number}"
        qr_b64 = generate_qr_base64(qr_url)

        html = render_certificate(
            participant=participant,
            template=template,
            cert_number=cert.cert_number,
            qr_base64=qr_b64,
            logo_path=event.assets.logo_path if event else None,
            signature_path=event.assets.signature_path if event else None,
        )

        year = datetime.utcnow().year
        tmp_path = str(Path(settings.storage_path) / "tmp" / f"{cert.cert_number}.png")
        Path(tmp_path).parent.mkdir(parents=True, exist_ok=True)
        generate_png(html, tmp_path)

        png_bytes = Path(tmp_path).read_bytes()
        png_url = save_cert_png(png_bytes, club.slug, year, cert.cert_number)
        Path(tmp_path).unlink(missing_ok=True)

        await cert.set({
            "png_url": png_url,
            "qr_data": qr_url,
            "status": CertStatus.GENERATED,
            "issued_at": datetime.utcnow(),
        })

        # Attempt email
        daily_count = get_daily_sent_count()
        if daily_count >= settings.email_daily_limit:
            await EmailLog(
                certificate_id=cert.id, recipient_email=cert.snapshot.email,
                status=EmailStatus.QUEUED, scheduled_for=datetime.utcnow(),
            ).insert()
            return

        sent = await send_certificate_email(
            recipient_email=cert.snapshot.email,
            recipient_name=cert.snapshot.name,
            cert_number=cert.cert_number,
            event_name=cert.snapshot.event_name,
            club_name=cert.snapshot.club_name,
            png_path=png_url,
        )

        if sent:
            await cert.set({"status": CertStatus.EMAILED})
            await EmailLog(
                certificate_id=cert.id, recipient_email=cert.snapshot.email,
                status=EmailStatus.SENT, sent_at=datetime.utcnow(), attempt_count=1,
            ).insert()
            await award_credits(cert)
        else:
            await EmailLog(
                certificate_id=cert.id, recipient_email=cert.snapshot.email,
                status=EmailStatus.QUEUED, attempt_count=1,
            ).insert()

    except Exception as exc:
        await cert.set({"status": CertStatus.FAILED})
        await EmailLog(
            certificate_id=cert.id, recipient_email=cert.snapshot.email,
            status=EmailStatus.FAILED, error_msg=str(exc)[:500], attempt_count=1,
        ).insert()


# ── Endpoints ────────────────────────────────────────────────────────────

@router.post("/generate", response_model=GenerateResponse)
async def generate_certificates(
    club_id: PydanticObjectId, event_id: PydanticObjectId,
    background_tasks: BackgroundTasks,
    _user: User = Depends(require_event_access),
):
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")

    participants = await Participant.find(
        Participant.event_id == event_id, Participant.verified == True
    ).to_list()

    existing_pids = set()
    existing_certs = await Certificate.find(Certificate.event_id == event_id).to_list()
    for c in existing_certs:
        existing_pids.add(c.participant_id)

    queued = 0
    year = datetime.utcnow().year

    for p in participants:
        if p.id in existing_pids:
            continue

        cert_type = p.cert_type
        template_id = event.template_map.get(cert_type)
        if not template_id:
            template_id = event.template_map.get("participant")
        if not template_id:
            continue

        cert_number = await generate_cert_number(club.slug, year)

        snapshot = CertSnapshot(
            name=p.fields.get("Name", p.email),
            email=p.email,
            registration_number=p.registration_number,
            event_name=event.name,
            club_name=club.name,
            cert_type=cert_type,
            issued_date=datetime.utcnow(),
            extra_fields=p.fields,
        )

        cert = Certificate(
            cert_number=cert_number, participant_id=p.id,
            event_id=event_id, template_id=template_id, club_id=club_id,
            snapshot=snapshot, status=CertStatus.PENDING,
        )
        await cert.insert()
        background_tasks.add_task(_generate_and_email_one, cert.id)
        queued += 1

    return GenerateResponse(queued_count=queued)


@router.get("", response_model=List[CertificateResponse])
async def list_certificates(
    club_id: PydanticObjectId, event_id: PydanticObjectId,
    _user: User = Depends(require_event_access),
):
    certs = await Certificate.find(
        Certificate.event_id == event_id, Certificate.club_id == club_id
    ).to_list()
    return [
        CertificateResponse(
            id=str(c.id), cert_number=c.cert_number,
            participant_id=str(c.participant_id), event_id=str(c.event_id),
            template_id=str(c.template_id), club_id=str(c.club_id),
            snapshot=c.snapshot.model_dump(), status=c.status.value,
            issued_at=c.issued_at,
        ) for c in certs
    ]


@router.post("/send-remaining")
async def send_remaining(
    club_id: PydanticObjectId, event_id: PydanticObjectId,
    background_tasks: BackgroundTasks,
    _user: User = Depends(require_event_access),
):
    certs = await Certificate.find(
        Certificate.event_id == event_id,
        Certificate.status == CertStatus.GENERATED,
    ).to_list()

    queued = 0
    for cert in certs:
        log = await EmailLog.find_one(
            EmailLog.certificate_id == cert.id,
            EmailLog.status.in_([EmailStatus.QUEUED, EmailStatus.PENDING]),
        )
        if log or cert.status == CertStatus.GENERATED:
            background_tasks.add_task(_generate_and_email_one, cert.id)
            queued += 1

    return {"message": f"{queued} emails queued for sending"}
