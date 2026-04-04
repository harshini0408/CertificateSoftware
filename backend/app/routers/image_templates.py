"""Router for image-based certificate templates and per-event, per-cert-type field positions."""

from datetime import datetime
from typing import Dict, List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..core.dependencies import require_event_access
from ..models.image_template import ImageTemplate
from ..models.field_position import FieldPosition
from ..models.event import Event
from ..models.user import User

router = APIRouter(tags=["Image Templates"])


# ──────────────────────────────────────────────────────────────────────────────
# GET /image-templates  — public, no auth
# Returns the gallery of available PNG certificate templates.
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/image-templates")
async def list_image_templates():
    """Return all active pre-built PNG certificate templates."""
    templates = await ImageTemplate.find(ImageTemplate.is_active == True).to_list()
    return [
        {
            "id": str(t.id),
            "filename": t.filename,
            "display_name": t.display_name,
            "preview_url": t.preview_url,
            "is_active": t.is_active,
            "created_at": t.created_at,
        }
        for t in templates
    ]


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic schemas for field-position requests
# ──────────────────────────────────────────────────────────────────────────────

class ColumnPosition(BaseModel):
    x_percent: float
    y_percent: float


class AssetPosition(BaseModel):
    x_percent: float
    y_percent: float
    width_percent: float = 15.0   # default rendered width as % of certificate width


class FieldPositionRequest(BaseModel):
    cert_type: str                              # e.g. 'volunteer', 'winner_1st'
    template_filename: str                       # e.g. 'template_01.png'
    column_positions: Dict[str, ColumnPosition]  # column header → {x_percent, y_percent}
    asset_positions: Optional[Dict[str, AssetPosition]] = None  # 'logo' / 'signature'
    display_width: float = 580.0
    confirmed: bool = False


# ──────────────────────────────────────────────────────────────────────────────
# Club-scoped field-position routes
# Prefix: /clubs/{club_id}/events/{event_id}
# ──────────────────────────────────────────────────────────────────────────────

_fp_router = APIRouter(
    prefix="/clubs/{club_id}/events/{event_id}",
    tags=["Field Positions"],
)


def _fp_dict(fp: FieldPosition) -> dict:
    return {
        "id": str(fp.id),
        "event_id": str(fp.event_id),
        "cert_type": fp.cert_type,
        "template_filename": fp.template_filename,
        "column_positions": fp.column_positions,
        "asset_positions": fp.asset_positions,
        "display_width": fp.display_width,
        "confirmed": fp.confirmed,
        "created_at": fp.created_at,
    }


@_fp_router.post("/field-positions")
async def save_field_positions(
    club_id: PydanticObjectId,
    event_id: PydanticObjectId,
    body: FieldPositionRequest,
    _user: User = Depends(require_event_access),
):
    """Upsert the FieldPosition document for this event + cert_type combination.

    One FieldPosition document is stored per (event_id, cert_type).
    Also records the chosen template_filename on the event document
    inside template_map so the generation engine can resolve it.
    """
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    col_positions_dict: Dict[str, Dict[str, float]] = {
        col: {"x_percent": pos.x_percent, "y_percent": pos.y_percent}
        for col, pos in body.column_positions.items()
    }
    asset_pos_dict = {
        key: {"x_percent": p.x_percent, "y_percent": p.y_percent, "width_percent": p.width_percent}
        for key, p in (body.asset_positions or {}).items()
    } or None

    # Upsert FieldPosition by (event_id, cert_type)
    existing = await FieldPosition.find_one(
        FieldPosition.event_id == event_id,
        FieldPosition.cert_type == body.cert_type,
    )

    if existing:
        await existing.set({
            "template_filename": body.template_filename,
            "column_positions": col_positions_dict,
            "asset_positions": asset_pos_dict,
            "display_width": body.display_width,
            "confirmed": body.confirmed,
        })
        fp = await FieldPosition.get(existing.id)
    else:
        fp = FieldPosition(
            event_id=event_id,
            cert_type=body.cert_type,
            template_filename=body.template_filename,
            column_positions=col_positions_dict,
            asset_positions=asset_pos_dict,
            display_width=body.display_width,
            confirmed=body.confirmed,
            created_at=datetime.utcnow(),
        )
        await fp.insert()

    # Record the chosen template_filename on the event so the generation
    # engine always knows the latest active template for this event.
    await event.set({"template_filename": body.template_filename})

    return _fp_dict(fp)


@_fp_router.get("/field-positions")
async def list_field_positions(
    club_id: PydanticObjectId,
    event_id: PydanticObjectId,
    _user: User = Depends(require_event_access),
):
    """Return ALL FieldPosition documents for this event (one per cert_type)."""
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    positions = await FieldPosition.find(FieldPosition.event_id == event_id).to_list()
    return [_fp_dict(fp) for fp in positions]


@_fp_router.get("/field-positions/{cert_type}")
async def get_field_positions_for_cert_type(
    club_id: PydanticObjectId,
    event_id: PydanticObjectId,
    cert_type: str,
    _user: User = Depends(require_event_access),
):
    """Return the FieldPosition document for a specific cert_type, or 404."""
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    fp = await FieldPosition.find_one(
        FieldPosition.event_id == event_id,
        FieldPosition.cert_type == cert_type,
    )
    if not fp:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"No field positions saved for cert_type='{cert_type}' in this event",
        )
    return _fp_dict(fp)


router.include_router(_fp_router)
