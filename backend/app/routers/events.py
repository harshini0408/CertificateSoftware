import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from beanie import PydanticObjectId
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse

from ..config import get_settings
from ..core.dependencies import require_club_access, require_event_access
from ..models.user import User
from ..models.club import Club
from ..models.event import Event, EventStatus, EventAssets
from ..models.template import Template
from ..models.certificate import Certificate, CertStatus
from ..models.participant import Participant
from ..models.field_position import FieldPosition
from ..schemas.event import EventCreate, EventUpdate, EventResponse
from ..services.signature_service import process_signature, save_logo
from ..services.storage_service import storage_path_to_url
from ..services.excel_service import generate_excel_template, get_active_role_names

router = APIRouter(prefix="/clubs/{club_id}/events", tags=["Events"])
settings = get_settings()


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
    # Primary path: issued certs only (generated/emailed).
    issued_count = await Certificate.find({
        "$or": [{"event_id": oid}, {"event_id": str(event_id)}],
        "status": {"$in": _issued_status_candidates()},
    }).count()
    if issued_count > 0:
        return issued_count

    # Fallback for legacy docs where status serialization differed.
    return await Certificate.find({
        "$or": [{"event_id": oid}, {"event_id": str(event_id)}],
    }).count()


def _assets_complete(assets: EventAssets) -> bool:
    return bool(assets.logo_path and assets.signature_path)


def _assets_files_exist(assets: EventAssets) -> bool:
    return bool(
        assets.logo_path
        and assets.signature_path
        and Path(assets.logo_path).exists()
        and Path(assets.signature_path).exists()
    )


async def _get_latest_event_with_assets(club_id: PydanticObjectId) -> Optional[Event]:
    events = await Event.find(Event.club_id == club_id).sort(-Event.created_at).to_list()
    for ev in events:
        if _assets_complete(ev.assets) and _assets_files_exist(ev.assets):
            return ev
    return None


def _event_response(e: Event, cert_count: int = 0) -> EventResponse:
    return EventResponse(
        id=str(e.id), club_id=str(e.club_id), name=e.name,
        description=e.description, event_date=e.event_date,
        academic_year=e.academic_year,
        status=e.status.value, template_map={k: str(v) if v else None for k, v in e.template_map.items()},
        assets=e.assets.model_dump(),
        mapping_confirmed=e.mapping_confirmed,
        participant_count=e.participant_count,
        cert_count=cert_count,
        created_at=e.created_at,
    )


@router.get("", response_model=List[EventResponse])
async def list_events(club_id: PydanticObjectId, _user: User = Depends(require_club_access)):
    events = await Event.find(Event.club_id == club_id).to_list()
    responses = []
    for e in events:
        cert_count = await _count_event_certificates(e.id)
        responses.append(_event_response(e, cert_count=cert_count))
    return responses


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

    # Backfill club defaults from latest configured event if defaults are empty.
    if not _assets_complete(inherited_assets):
        latest_with_assets = await _get_latest_event_with_assets(club_id)
        if latest_with_assets:
            inherited_assets = latest_with_assets.assets
            await club.set({"assets": inherited_assets.model_dump()})

    event = Event(club_id=club_id, name=body.name,
                  event_date=body.event_date, academic_year=body.academic_year,
                  template_map=tmap, assets=inherited_assets)
    await event.insert()
    return _event_response(event)


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(club_id: PydanticObjectId, event_id: PydanticObjectId,
                    _user: User = Depends(require_event_access)):
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    club = await Club.get(club_id)
    updates = {}

    # Normalize legacy asset URLs from stored paths (e.g. old hardcoded logo.png links).
    normalized_assets = EventAssets(**event.assets.model_dump())
    asset_urls_changed = False
    if normalized_assets.logo_path:
        normalized_logo_url = storage_path_to_url(normalized_assets.logo_path)
        if normalized_logo_url != normalized_assets.logo_url:
            normalized_assets.logo_url = normalized_logo_url
            asset_urls_changed = True
    if normalized_assets.signature_path:
        normalized_sig_url = storage_path_to_url(normalized_assets.signature_path)
        if normalized_sig_url != normalized_assets.signature_url:
            normalized_assets.signature_url = normalized_sig_url
            asset_urls_changed = True
    if asset_urls_changed:
        updates["assets"] = normalized_assets.model_dump()

    # If event assets are missing/broken, auto-apply valid club defaults.
    if club and getattr(club, "assets", None):
        club_assets = EventAssets(**club.assets.model_dump())
        event_assets_ready = _assets_complete(normalized_assets) and _assets_files_exist(normalized_assets)
        club_assets_ready = _assets_complete(club_assets) and _assets_files_exist(club_assets)
        if club_assets_ready and not event_assets_ready:
            updates["assets"] = club_assets.model_dump()

    # Final fallback: if still missing/broken, use latest valid event assets from this club.
    candidate_assets = EventAssets(**updates.get("assets", normalized_assets.model_dump()))
    if not (_assets_complete(candidate_assets) and _assets_files_exist(candidate_assets)):
        latest_with_assets = await _get_latest_event_with_assets(club_id)
        if latest_with_assets:
            updates["assets"] = latest_with_assets.assets.model_dump()

    # If club defaults are empty but this event has assets, backfill defaults.
    if club and getattr(club, "assets", None):
        club_assets = EventAssets(**club.assets.model_dump())
        if (
            not (_assets_complete(club_assets) and _assets_files_exist(club_assets))
            and _assets_complete(normalized_assets)
            and _assets_files_exist(normalized_assets)
        ):
            await club.set({"assets": normalized_assets.model_dump()})

    # Sync participant count on read
    actual_count = await Participant.find(Participant.event_id == event_id).count()
    # Sync mapping_confirmed based on any confirmed field-position record
    mapping_confirmed = (
        await FieldPosition.find(
            FieldPosition.event_id == event_id,
            FieldPosition.confirmed == True,
        ).count()
    ) > 0

    if actual_count != event.participant_count:
        updates["participant_count"] = actual_count
    if mapping_confirmed != event.mapping_confirmed:
        updates["mapping_confirmed"] = mapping_confirmed

    if updates:
        await event.set(updates)
        event = await Event.get(event_id)

    cert_count = await _count_event_certificates(event.id)
    return _event_response(event, cert_count=cert_count)


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
        assets.logo_url = storage_path_to_url(assets.logo_path)

        # First-time default: if club has no default logo, save this as club default.
        if club_assets and not club_assets.logo_path:
            club_assets.logo_hash = assets.logo_hash
            club_assets.logo_path = assets.logo_path
            club_assets.logo_url = assets.logo_url

    if signature:
        sig_bytes = await signature.read()
        assets.signature_hash = hashlib.md5(sig_bytes).hexdigest()
        assets.signature_path = process_signature(sig_bytes, club_slug)
        assets.signature_url = storage_path_to_url(assets.signature_path)

        # First-time default: if club has no default signature, save this as club default.
        if club_assets and not club_assets.signature_path:
            club_assets.signature_hash = assets.signature_hash
            club_assets.signature_path = assets.signature_path
            club_assets.signature_url = assets.signature_url

    await event.set({"assets": assets.model_dump()})

    if club and club_assets:
        await club.set({"assets": club_assets.model_dump()})

    return {"message": "Assets uploaded", "assets": assets.model_dump()}


# ═══ EXCEL TEMPLATE ═════════════════════════════════════════════════════

@router.get("/{event_id}/excel-template")
async def download_excel_template(club_id: PydanticObjectId, event_id: PydanticObjectId,
                                  _user: User = Depends(require_event_access)):
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    roles = await get_active_role_names()
    buf = generate_excel_template(roles=roles)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=certificate_template.xlsx"},
    )
