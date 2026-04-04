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
from ..models.certificate import Certificate, CertStatus, CertSnapshot
from ..models.email_log import EmailLog, EmailStatus
from ..schemas.certificate import CertificateResponse, GenerateResponse
from ..services.cert_number import generate_cert_number
from ..services.qr_service import generate_qr_base64
from ..services.png_generator import generate_certificate_pillow
from ..services.storage_service import save_cert_png, storage_url_to_path, storage_path_to_url
from ..services.email_service import send_certificate_email, get_daily_sent_count
from ..services.credit_service import award_credits

router = APIRouter(
    prefix="/clubs/{club_id}/events/{event_id}/certificates", tags=["Certificates"]
)
settings = get_settings()


# ── Background task: generate single certificate (review-first flow) ───────

async def _generate_one(cert_id: PydanticObjectId) -> None:
    cert = await Certificate.get(cert_id)
    if not cert:
        return

    try:
        participant = await Participant.get(cert.participant_id)
        club = await Club.get(cert.club_id)
        event = await Event.get(cert.event_id)
        if not participant or not club or not event:
            await cert.set({"status": CertStatus.FAILED})
            return

        qr_url = f"{settings.base_url}/verify/{cert.cert_number}"
        qr_b64 = generate_qr_base64(qr_url)

        year = datetime.utcnow().year
        tmp_path = str(Path(settings.storage_path) / "tmp" / f"{cert.cert_number}.png")
        Path(tmp_path).parent.mkdir(parents=True, exist_ok=True)

        # Image-based Pillow pipeline for certificate generation
        await generate_certificate_pillow(
            event=event,
            participant=participant,
            qr_b64=qr_b64,
            output_path=tmp_path,
            club_slug=club.slug,
            cert_type=participant.cert_type or "participant",
        )

        png_bytes = Path(tmp_path).read_bytes()
        png_url = save_cert_png(png_bytes, club.slug, year, cert.cert_number)
        Path(tmp_path).unlink(missing_ok=True)

        await cert.set({
            "png_url": png_url,
            "qr_data": qr_url,
            "status": CertStatus.GENERATED,
            "issued_at": datetime.utcnow(),
        })

    except Exception as exc:
        await cert.set({"status": CertStatus.FAILED})
        await EmailLog(
            certificate_id=cert.id, recipient_email=cert.snapshot.email,
            status=EmailStatus.FAILED, error_msg=str(exc)[:500], attempt_count=1,
        ).insert()


async def _send_email_for_generated(cert_id: PydanticObjectId) -> None:
    """Send email for an already-generated certificate after coordinator approval."""
    cert = await Certificate.get(cert_id)
    if not cert or cert.status not in [CertStatus.GENERATED, CertStatus.FAILED]:
        return

    if not cert.png_url:
        await cert.set({"status": CertStatus.FAILED})
        await EmailLog(
            certificate_id=cert.id,
            recipient_email=cert.snapshot.email,
            status=EmailStatus.FAILED,
            error_msg="PNG not generated for certificate",
            attempt_count=1,
        ).insert()
        return

    local_png_path = storage_url_to_path(cert.png_url)
    if not Path(local_png_path).exists():
        await cert.set({"status": CertStatus.FAILED})
        await EmailLog(
            certificate_id=cert.id,
            recipient_email=cert.snapshot.email,
            status=EmailStatus.FAILED,
            error_msg="Certificate file not found on disk",
            attempt_count=1,
        ).insert()
        return

    try:
        daily_count = get_daily_sent_count()
        if daily_count >= settings.email_daily_limit:
            await EmailLog(
                certificate_id=cert.id,
                recipient_email=cert.snapshot.email,
                status=EmailStatus.QUEUED,
                scheduled_for=datetime.utcnow(),
            ).insert()
            return

        sent = await send_certificate_email(
            recipient_email=cert.snapshot.email,
            recipient_name=cert.snapshot.name,
            cert_number=cert.cert_number,
            event_name=cert.snapshot.event_name,
            club_name=cert.snapshot.club_name,
            png_path=local_png_path,
        )

        if sent:
            await cert.set({"status": CertStatus.EMAILED})
            await EmailLog(
                certificate_id=cert.id,
                recipient_email=cert.snapshot.email,
                status=EmailStatus.SENT,
                sent_at=datetime.utcnow(),
                attempt_count=1,
            ).insert()
            await award_credits(cert)
        else:
            await EmailLog(
                certificate_id=cert.id,
                recipient_email=cert.snapshot.email,
                status=EmailStatus.QUEUED,
                attempt_count=1,
            ).insert()

    except Exception as exc:
        await cert.set({"status": CertStatus.FAILED})
        await EmailLog(
            certificate_id=cert.id,
            recipient_email=cert.snapshot.email,
            status=EmailStatus.FAILED,
            error_msg=str(exc)[:500],
            attempt_count=1,
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
        Participant.event_id == event_id
    ).to_list()

    existing_pids = set()
    existing_certs = await Certificate.find(Certificate.event_id == event_id).to_list()
    for c in existing_certs:
        existing_pids.add(c.participant_id)

    queued = 0
    skipped_existing = 0
    skipped_no_template = 0
    year = datetime.utcnow().year

    for p in participants:
        if p.id in existing_pids:
            skipped_existing += 1
            continue

        cert_type = p.cert_type
        mapped_template = event.template_map.get(cert_type)
        if not mapped_template:
            mapped_template = event.template_map.get("participant")
        if not mapped_template:
            skipped_no_template += 1
            continue

        # Certificates model still requires template_id as ObjectId.
        # For image-template mappings (filename strings), use event.id as a stable placeholder.
        try:
            template_oid = PydanticObjectId(mapped_template)
        except Exception:
            template_oid = event.id

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
            event_id=event_id, template_id=template_oid, club_id=club_id,
            snapshot=snapshot, status=CertStatus.PENDING,
        )
        await cert.insert()
        background_tasks.add_task(_generate_one, cert.id)
        queued += 1

    total = len(participants)
    message = (
        f"Queued {queued} of {total} participant(s). "
        f"Skipped existing: {skipped_existing}. "
        f"Skipped missing template: {skipped_no_template}."
    )
    return GenerateResponse(
        queued_count=queued,
        total=total,
        message=message,
    )


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
            participant_name=c.snapshot.name,
            participant_email=c.snapshot.email,
            cert_type=c.snapshot.cert_type,
            snapshot=c.snapshot.model_dump(), status=c.status.value,
            pdf_url=storage_path_to_url(c.png_url) if c.png_url else None,
            generated_at=c.issued_at,
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
            background_tasks.add_task(_send_email_for_generated, cert.id)
            queued += 1

    return {"queued": queued, "message": f"{queued} emails queued for sending"}


@router.post("/{cert_id}/resend")
async def resend_one_certificate_email(
    club_id: PydanticObjectId,
    event_id: PydanticObjectId,
    cert_id: PydanticObjectId,
    background_tasks: BackgroundTasks,
    _user: User = Depends(require_event_access),
):
    cert = await Certificate.get(cert_id)
    if not cert or cert.club_id != club_id or cert.event_id != event_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificate not found")

    if cert.status not in [CertStatus.GENERATED, CertStatus.FAILED]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only generated/failed certificates can be resent")

    background_tasks.add_task(_send_email_for_generated, cert.id)
    return {"message": "Email re-queued", "queued": 1}
