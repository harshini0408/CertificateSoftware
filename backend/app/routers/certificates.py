from datetime import datetime
import asyncio
import os
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
from ..models.field_position import FieldPosition
from ..models.role_template_preset import RoleTemplatePreset
from ..models.certificate import Certificate, CertStatus, CertSnapshot
from ..models.email_log import EmailLog, EmailStatus
from ..schemas.certificate import CertificateResponse, GenerateResponse
from ..services.cert_number import generate_cert_number
from ..services.png_generator import generate_certificate_pillow, generate_certificate_from_role_preset
from ..services.storage_service import save_cert_png, storage_url_to_path, storage_path_to_url
from ..services.email_service import send_certificate_email, get_daily_sent_count
from ..services.credit_service import award_credits

router = APIRouter(
    prefix="/clubs/{club_id}/events/{event_id}/certificates", tags=["Certificates"]
)
settings = get_settings()

# Bounded concurrency to avoid overloading CPU/SMTP while improving throughput.
_GEN_SEMAPHORE = asyncio.Semaphore(max(4, min(12, (os.cpu_count() or 4) * 2)))
_EMAIL_SEMAPHORE = asyncio.Semaphore(3)


async def _generate_one_limited(cert_id: PydanticObjectId) -> None:
    async with _GEN_SEMAPHORE:
        await _generate_one(cert_id)


async def _send_email_limited(cert_id: PydanticObjectId) -> None:
    async with _EMAIL_SEMAPHORE:
        await _send_email_for_generated(cert_id)


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

        year = datetime.utcnow().year
        tmp_path = str(settings.storage_root / "tmp" / f"{cert.cert_number}.png")
        Path(tmp_path).parent.mkdir(parents=True, exist_ok=True)

        role_name = participant.cert_type or "participant"
        normalized_role = role_name.lower().replace(" ", "_").replace("-", "_")
        preset = await RoleTemplatePreset.find_one(
            RoleTemplatePreset.role_name == normalized_role,
            RoleTemplatePreset.is_active == True,
        )

        if preset:
            assets = getattr(event, "assets", None)
            logo_path = None
            sig_path = None
            if assets and getattr(assets, "logo_path", None):
                lp = Path(assets.logo_path)
                if lp.exists():
                    logo_path = str(lp)
            if assets and getattr(assets, "signature_path", None):
                sp = Path(assets.signature_path)
                if sp.exists():
                    sig_path = str(sp)

            await generate_certificate_from_role_preset(
                role_name=role_name,
                participant_fields=participant.fields or {},
                output_path=tmp_path,
                cert_number=cert.cert_number,
                logo_path=logo_path,
                sig_path=sig_path,
            )
        else:
            # Fallback for manually configured per-event field positions.
            await generate_certificate_pillow(
                event=event,
                participant=participant,
                output_path=tmp_path,
                club_slug=club.slug,
                cert_number=cert.cert_number,
                cert_type=role_name,
            )

        png_bytes = Path(tmp_path).read_bytes()
        png_url = save_cert_png(png_bytes, club.slug, year, cert.cert_number)
        Path(tmp_path).unlink(missing_ok=True)

        await cert.set({
            "png_url": png_url,
            "status": CertStatus.GENERATED,
            "issued_at": datetime.utcnow(),
        })
        await award_credits(cert)

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

    existing_certs = await Certificate.find(Certificate.event_id == event_id).to_list()

    # Index existing certificates by participant with active/retry buckets.
    active_by_pid = {}
    retry_by_pid = {}
    for c in existing_certs:
        pid = c.participant_id
        if c.status in {CertStatus.PENDING, CertStatus.GENERATED, CertStatus.EMAILED}:
            active_by_pid[pid] = c
        elif c.status in {CertStatus.FAILED, CertStatus.REVOKED} and pid not in retry_by_pid:
            retry_by_pid[pid] = c

    queued = 0
    skipped_existing = 0
    skipped_no_template = 0
    year = datetime.utcnow().year

    # Support both preset roles and manual field-position templates.
    preset_docs = await RoleTemplatePreset.find(RoleTemplatePreset.is_active == True).to_list()
    preset_roles = {p.role_name for p in preset_docs}

    # Field positions remain the fallback source of truth.
    fp_docs = await FieldPosition.find(FieldPosition.event_id == event_id).to_list()
    fp_types = {fp.cert_type for fp in fp_docs if fp.template_filename}
    has_participant_fallback = "participant" in fp_types

    for p in participants:
        if p.id in active_by_pid:
            skipped_existing += 1
            continue

        cert_type = p.cert_type or "participant"
        normalized_role = cert_type.lower().replace(" ", "_").replace("-", "_")
        has_preset = normalized_role in preset_roles
        has_manual = cert_type in fp_types or has_participant_fallback
        if not has_preset and not has_manual:
            skipped_no_template += 1
            continue

        retry_cert = retry_by_pid.get(p.id)
        if retry_cert:
            await retry_cert.set({
                "status": CertStatus.PENDING,
                "issued_at": None,
                "png_url": None,
            })
            asyncio.create_task(_generate_one_limited(retry_cert.id))
            queued += 1
            continue

        # Certificates model still requires template_id as ObjectId.
        # For image-template mode we use event.id as stable placeholder.
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
        asyncio.create_task(_generate_one_limited(cert.id))
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

    cert_ids = [c.id for c in certs]
    latest_error_by_cert = {}
    if cert_ids:
        logs = await EmailLog.find(
            {"certificate_id": {"$in": cert_ids}}
        ).sort(-EmailLog.id).to_list()
        for log in logs:
            cid = str(log.certificate_id)
            if cid not in latest_error_by_cert and log.error_msg:
                latest_error_by_cert[cid] = log.error_msg

    return [
        CertificateResponse(
            id=str(c.id), cert_number=c.cert_number,
            participant_id=str(c.participant_id), event_id=str(c.event_id),
            template_id=str(c.template_id), club_id=str(c.club_id),
            participant_name=c.snapshot.name,
            participant_email=c.snapshot.email,
            cert_type=c.snapshot.cert_type,
            snapshot=c.snapshot.model_dump(), status=c.status.value,
            failure_reason=latest_error_by_cert.get(str(c.id)),
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
        asyncio.create_task(_send_email_limited(cert.id))
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

    asyncio.create_task(_send_email_limited(cert.id))
    return {"message": "Email re-queued", "queued": 1}
