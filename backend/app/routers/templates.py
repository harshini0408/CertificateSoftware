from datetime import datetime
from typing import List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from ..core.dependencies import require_club_access, require_event_access
from ..models.template import FieldSlot, FieldSlot as FieldSlotModel, StaticElement, Template, TemplateBackground, TemplateType
from ..models.event import Event
from ..models.user import User
from ..schemas.template import BackgroundSchema, FieldSlotSchema, StaticElementSchema, TemplateCreate, TemplateResponse

router = APIRouter(tags=["Templates"])


# ── Response helper ──────────────────────────────────────────────────────

def _resp(t: Template) -> TemplateResponse:
    return TemplateResponse(
        id=str(t.id),
        club_id=str(t.club_id) if t.club_id else None,
        name=t.name,
        cert_type=t.cert_type,
        type=t.type.value,
        html_content=t.html_content,
        field_slots=[FieldSlotSchema(**s.model_dump()) for s in t.field_slots],
        static_elements=[StaticElementSchema(**s.model_dump()) for s in t.static_elements],
        background=BackgroundSchema(**t.background.model_dump()),
        border_color=t.border_color,
        font_family=t.font_family,
        font_color=t.font_color,
        is_preset=t.is_preset,
        preview_url=t.preview_url,
        created_at=t.created_at,
    )


# ── Preset templates (public browsing) ───────────────────────────────────

@router.get("/templates/presets", response_model=List[TemplateResponse])
async def list_presets():
    """Return all built-in preset templates (no auth required)."""
    presets = await Template.find(Template.is_preset == True).to_list()
    return [_resp(t) for t in presets]


@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: PydanticObjectId):
    """Fetch a single template by ID."""
    tpl = await Template.get(template_id)
    if not tpl:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    return _resp(tpl)


# ── Club-scoped templates ────────────────────────────────────────────────

@router.get("/clubs/{club_id}/templates", response_model=List[TemplateResponse])
async def list_templates(
    club_id: PydanticObjectId,
    _user: User = Depends(require_club_access),
):
    presets = await Template.find(Template.is_preset == True).to_list()
    custom = await Template.find(Template.club_id == club_id).to_list()
    seen_ids: set = set()
    combined = []
    for t in presets + custom:
        if t.id not in seen_ids:
            seen_ids.add(t.id)
            combined.append(t)
    return [_resp(t) for t in combined]


@router.post("/clubs/{club_id}/templates", response_model=TemplateResponse, status_code=201)
async def create_template(
    club_id: PydanticObjectId,
    body: TemplateCreate,
    _user: User = Depends(require_club_access),
):
    tpl = Template(
        club_id=club_id,
        name=body.name,
        cert_type=body.cert_type,
        type=TemplateType.CUSTOM,
        html_content=body.html_content,
        field_slots=[FieldSlot(**s.model_dump()) for s in body.field_slots],
        static_elements=[StaticElement(**s.model_dump()) for s in body.static_elements],
        background=TemplateBackground(**body.background.model_dump()),
        border_color=body.border_color,
        font_family=body.font_family,
        font_color=body.font_color,
        is_preset=False,
    )
    await tpl.insert()
    return _resp(tpl)


# ── Assign preset to event ───────────────────────────────────────────────

@router.post("/clubs/{club_id}/events/{event_id}/templates/assign-preset")
async def assign_preset(
    club_id: PydanticObjectId,
    event_id: PydanticObjectId,
    body: dict,
    _user: User = Depends(require_event_access),
):
    """Assign a preset template to an event's template_map for a given cert_type.

    Body: { "preset_id": "...", "cert_type": "participant" }
    """
    preset_id = body.get("preset_id")
    cert_type = body.get("cert_type", "participant")

    if not preset_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "preset_id is required")

    preset = await Template.get(PydanticObjectId(preset_id))
    if not preset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Preset template not found")

    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    event.template_map[cert_type] = preset.id
    await event.set({"template_map": {k: v for k, v in event.template_map.items()}})

    return {"message": f"Preset '{preset.name}' assigned for {cert_type}"}


# ── Preset slot editor ───────────────────────────────────────────────────

class SlotUpdate(BaseModel):
    """A single slot resize instruction. Only width, height, font_size allowed."""
    slot_id: str
    width: Optional[float] = Field(None, ge=1, le=2480)
    height: Optional[float] = Field(None, ge=1, le=3508)
    font_size: Optional[int] = Field(None, ge=6, le=200)


class PresetSlotPatchRequest(BaseModel):
    """Body for PATCH preset-slots."""
    cert_type: str
    slot_updates: List[SlotUpdate]

    @field_validator("slot_updates")
    @classmethod
    def at_least_one(cls, v: list) -> list:
        if not v:
            raise ValueError("slot_updates must contain at least one entry")
        return v


@router.patch(
    "/clubs/{club_id}/events/{event_id}/templates/preset-slots",
    response_model=TemplateResponse,
)
async def patch_preset_slots(
    club_id: PydanticObjectId,
    event_id: PydanticObjectId,
    body: PresetSlotPatchRequest,
    _user: User = Depends(require_event_access),
):
    """Allow a club coordinator to resize field slots on a preset template
    assigned to their event.  The original preset is never mutated —
    a club-specific copy is created (or reused) transparently.
    """
    # ── 1. Verify event belongs to club ─────────────────────────────────
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    # ── 2. Resolve template_id from event.template_map ──────────────────
    cert_type = body.cert_type
    template_id = event.template_map.get(cert_type)
    if not template_id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"No template assigned to cert_type '{cert_type}' for this event",
        )

    template = await Template.get(template_id)
    if not template:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assigned template not found")

    # ── 3. Copy-on-write for preset templates ────────────────────────────
    if template.is_preset:
        copy_name = f"{template.name} (customised)"

        # Check if a club-specific copy already exists
        existing_copy = await Template.find_one(
            Template.club_id == club_id,
            Template.name == copy_name,
            Template.cert_type == cert_type,
        )

        if existing_copy:
            # Reuse the existing copy
            working_template = existing_copy
        else:
            # Duplicate the preset — deep-copy all embedded sub-documents
            working_template = Template(
                club_id=club_id,
                name=copy_name,
                cert_type=template.cert_type,
                type=TemplateType.CUSTOM,
                html_content=template.html_content,
                field_slots=[
                    FieldSlot(**slot.model_dump()) for slot in template.field_slots
                ],
                static_elements=[
                    StaticElement(**el.model_dump()) for el in template.static_elements
                ],
                background=TemplateBackground(**template.background.model_dump()),
                border_color=template.border_color,
                font_family=template.font_family,
                font_color=template.font_color,
                is_preset=False,
                preview_url=template.preview_url,
                created_at=datetime.utcnow(),
            )
            await working_template.insert()

        # Point event.template_map to the copy
        event.template_map[cert_type] = working_template.id
        await event.set({"template_map": {k: v for k, v in event.template_map.items()}})

    else:
        # Already a custom/copy template — apply directly
        working_template = template

    # ── 4. Build a lookup map of existing slots ──────────────────────────
    slot_map: dict[str, FieldSlot] = {
        s.slot_id: s for s in working_template.field_slots
    }

    # ── 5. Validate all slot_ids exist before applying any changes ───────
    missing = [u.slot_id for u in body.slot_updates if u.slot_id not in slot_map]
    if missing:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"Slot id(s) not found in template: {', '.join(missing)}",
        )

    # ── 6. Apply updates (only width, height, font_size) ─────────────────
    for update in body.slot_updates:
        slot = slot_map[update.slot_id]
        if update.width is not None:
            slot.width = update.width
        if update.height is not None:
            slot.height = update.height
        if update.font_size is not None:
            slot.font_size = update.font_size

    # ── 7. Persist the updated field_slots list ──────────────────────────
    updated_slots = [s.model_dump() for s in working_template.field_slots]
    await working_template.set({"field_slots": updated_slots})

    # Reload to return fresh document
    await working_template.sync()
    return _resp(working_template)
