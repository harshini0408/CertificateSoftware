import hashlib
from datetime import datetime
from typing import List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse

from ..config import get_settings
from ..core.dependencies import require_club_access, require_event_access
from ..models.user import User
from ..models.club import Club
from ..models.event import Event, EventStatus, EventAssets, QRConfig
from ..models.template import Template
from ..models.certificate import Certificate
from ..models.participant import Participant
from ..models.field_position import FieldPosition
from ..schemas.event import EventCreate, EventUpdate, EventResponse, QRGenerateRequest, QRGenerateResponse
from ..services.qr_service import create_event_qr_token, generate_qr_base64
from ..services.signature_service import process_signature, save_logo
from ..services.excel_service import generate_excel_template

router = APIRouter(prefix="/clubs/{club_id}/events", tags=["Events"])
settings = get_settings()


def _event_response(e: Event) -> EventResponse:
    return EventResponse(
        id=str(e.id), club_id=str(e.club_id), name=e.name,
        description=e.description, event_date=e.event_date,
        status=e.status.value, template_map={k: str(v) if v else None for k, v in e.template_map.items()},
        qr_config=e.qr_config.model_dump(), assets=e.assets.model_dump(),
        mapping_confirmed=e.mapping_confirmed,
        participant_count=e.participant_count,
        created_at=e.created_at,
    )


@router.get("", response_model=List[EventResponse])
async def list_events(club_id: PydanticObjectId, _user: User = Depends(require_club_access)):
    events = await Event.find(Event.club_id == club_id).to_list()
    return [_event_response(e) for e in events]


@router.post("", response_model=EventResponse, status_code=201)
async def create_event(club_id: PydanticObjectId, body: EventCreate, _user: User = Depends(require_club_access)):
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")

    tmap = {k: v for k, v in body.template_map.items()}

    # New events inherit club-level default assets automatically.
    inherited_assets = EventAssets()
    if getattr(club, "assets", None):
        inherited_assets.logo_path = club.assets.logo_path
        inherited_assets.logo_hash = club.assets.logo_hash
        inherited_assets.logo_url = club.assets.logo_url
        inherited_assets.signature_path = club.assets.signature_path
        inherited_assets.signature_hash = club.assets.signature_hash
        inherited_assets.signature_url = club.assets.signature_url

    event = Event(club_id=club_id, name=body.name, description=body.description,
                  event_date=body.event_date, template_map=tmap, assets=inherited_assets)
    await event.insert()
    return _event_response(event)


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(club_id: PydanticObjectId, event_id: PydanticObjectId,
                    _user: User = Depends(require_event_access)):
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    # Sync participant count on read
    actual_count = await Participant.find(Participant.event_id == event_id).count()
    # Sync mapping_confirmed based on any confirmed field-position record
    mapping_confirmed = (
        await FieldPosition.find(
            FieldPosition.event_id == event_id,
            FieldPosition.confirmed == True,
        ).count()
    ) > 0

    updates = {}
    if actual_count != event.participant_count:
        updates["participant_count"] = actual_count
    if mapping_confirmed != event.mapping_confirmed:
        updates["mapping_confirmed"] = mapping_confirmed

    if updates:
        await event.set(updates)
        event = await Event.get(event_id)

    return _event_response(event)


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(club_id: PydanticObjectId, event_id: PydanticObjectId,
                       body: EventUpdate, _user: User = Depends(require_event_access)):
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    updates = body.model_dump(exclude_none=True)
    if "template_map" in updates and updates["template_map"]:
        updates["template_map"] = {k: v for k, v in updates["template_map"].items()}
    if "status" in updates:
        updates["status"] = EventStatus(updates["status"])
    if updates:
        await event.set(updates)
        event = await Event.get(event_id)
    return _event_response(event)


@router.delete("/{event_id}")
async def delete_event(club_id: PydanticObjectId, event_id: PydanticObjectId,
                       _user: User = Depends(require_event_access)):
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    if event.status != EventStatus.DRAFT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only draft events can be deleted")
    cert_count = await Certificate.find(Certificate.event_id == event_id).count()
    if cert_count > 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete event with issued certificates")
    await event.delete()
    return {"message": "Event deleted"}


@router.post("/{event_id}/assets")
async def upload_assets(club_id: PydanticObjectId, event_id: PydanticObjectId,
                        logo: Optional[UploadFile] = File(None),
                        signature: Optional[UploadFile] = File(None),
                        _user: User = Depends(require_event_access)):
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    club = await Club.get(club_id)
    club_slug = club.slug if club else "unknown"
    assets = event.assets
    club_assets = club.assets if (club and getattr(club, "assets", None)) else None

    if logo:
        logo_bytes = await logo.read()
        assets.logo_hash = hashlib.md5(logo_bytes).hexdigest()
        assets.logo_path = save_logo(logo_bytes, club_slug)
        assets.logo_url = f"/storage/assets/{club_slug}/logo.png"

        # First-time default: if club has no default logo, save this as club default.
        if club_assets and not club_assets.logo_path:
            club_assets.logo_hash = assets.logo_hash
            club_assets.logo_path = assets.logo_path
            club_assets.logo_url = assets.logo_url

    if signature:
        sig_bytes = await signature.read()
        assets.signature_hash = hashlib.md5(sig_bytes).hexdigest()
        assets.signature_path = process_signature(sig_bytes, club_slug)
        assets.signature_url = f"/storage/assets/{club_slug}/signature.png"

        # First-time default: if club has no default signature, save this as club default.
        if club_assets and not club_assets.signature_path:
            club_assets.signature_hash = assets.signature_hash
            club_assets.signature_path = assets.signature_path
            club_assets.signature_url = assets.signature_url

    await event.set({"assets": assets.model_dump()})

    if club and club_assets:
        await club.set({"assets": club_assets.model_dump()})

    return {"message": "Assets uploaded", "assets": assets.model_dump()}


# ═══ QR ══════════════════════════════════════════════════════════════════

@router.post("/{event_id}/qr/generate", response_model=QRGenerateResponse)
async def generate_qr(club_id: PydanticObjectId, event_id: PydanticObjectId,
                      body: QRGenerateRequest, _user: User = Depends(require_event_access)):
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    token = create_event_qr_token(str(event_id), body.custom_fields, body.duration_hours)
    from datetime import timedelta
    expires_at = datetime.utcnow() + timedelta(hours=body.duration_hours)
    url = f"{settings.base_url}/register/{token}"
    qr_b64 = generate_qr_base64(url)

    qr_config = QRConfig(custom_fields=body.custom_fields, expires_at=expires_at,
                         token=token, is_active=True)
    await event.set({"qr_config": qr_config.model_dump()})

    return QRGenerateResponse(token=token, qr_image_base64=qr_b64, expires_at=expires_at)


@router.delete("/{event_id}/qr/expire")
async def expire_qr(club_id: PydanticObjectId, event_id: PydanticObjectId,
                     _user: User = Depends(require_event_access)):
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    event.qr_config.is_active = False
    await event.set({"qr_config": event.qr_config.model_dump()})
    return {"message": "QR code expired"}


# ═══ EXCEL TEMPLATE ═════════════════════════════════════════════════════

@router.get("/{event_id}/excel-template")
async def download_excel_template(club_id: PydanticObjectId, event_id: PydanticObjectId,
                                  _user: User = Depends(require_event_access)):
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    # Create generic template for image-based system
    buf = generate_excel_template()
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={event.name}_participants.xlsx"},
    )
