import re
from datetime import datetime
from typing import List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from ..core.dependencies import get_current_user, require_club_access, require_event_access
from ..models.template import FieldSlot, StaticElement, Template, TemplateBackground, TemplateType
from ..models.event import Event
from ..models.user import User, UserRole
from ..schemas.template import (
    BackgroundSchema, FieldSlotSchema, StaticElementSchema,
    TemplateCreate, TemplateFieldsUpdate, TemplateHtmlResponse,
    TemplateHtmlUpdate, TemplateResponse,
)

router = APIRouter(tags=["Templates"])


# ── HTML sanitisation ────────────────────────────────────────────────────

_SCRIPT_RE = re.compile(r"<script[\s\S]*?</script>", re.IGNORECASE)
_STYLE_RE  = re.compile(r"<style[\s\S]*?</style>", re.IGNORECASE)
_ONEVENT_RE = re.compile(r"""\s+on\w+\s*=\s*["'][^"']*["']""", re.IGNORECASE)

def _sanitise_html(raw: str) -> str:
    """Strip <script>, <style> blocks and on* event attributes."""
    html = _SCRIPT_RE.sub("", raw)
    html = _STYLE_RE.sub("", html)
    html = _ONEVENT_RE.sub("", html)
    return html


# ── Response helper ──────────────────────────────────────────────────────

async def _resp(t: Template, include_forked_name: bool = False) -> TemplateResponse:
    forked_name = None
    if include_forked_name and t.forked_from:
        source = await Template.get(t.forked_from)
        if source:
            forked_name = source.name
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
        is_editable=t.is_editable,
        source_preset_id=str(t.source_preset_id) if t.source_preset_id else None,
        forked_from=str(t.forked_from) if t.forked_from else None,
        forked_from_name=forked_name,
        last_edited_at=t.last_edited_at,
        preview_url=t.preview_url,
        created_at=t.created_at,
    )


# ══════════════════════════════════════════════════════════════════════════
# Preset templates (public browsing)
# ══════════════════════════════════════════════════════════════════════════

@router.get("/templates/presets", response_model=List[TemplateResponse])
async def list_presets():
    """Return all built-in preset templates (no auth required)."""
    presets = await Template.find(Template.is_preset == True).to_list()
    return [await _resp(t) for t in presets]


@router.get("/templates/club", response_model=List[TemplateResponse])
async def list_club_own_templates(
    user: User = Depends(get_current_user),
):
    """Return all templates owned by the coordinator's club."""
    if user.role == UserRole.SUPER_ADMIN:
        # Super admin sees everything non-preset
        templates = await Template.find(Template.is_preset == False).to_list()
    elif user.role == UserRole.CLUB_COORDINATOR:
        if not user.club_id:
            return []
        templates = await Template.find(Template.club_id == user.club_id).to_list()
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")

    return [await _resp(t, include_forked_name=True) for t in templates]


@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: PydanticObjectId):
    """Fetch a single template by ID."""
    tpl = await Template.get(template_id)
    if not tpl:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")
    return await _resp(tpl, include_forked_name=True)


# ══════════════════════════════════════════════════════════════════════════
# HTML editor endpoints
# ══════════════════════════════════════════════════════════════════════════

@router.get("/templates/{template_id}/html", response_model=TemplateHtmlResponse)
async def get_template_html(
    template_id: PydanticObjectId,
    user: User = Depends(get_current_user),
):
    """Return raw HTML + field_slots for the editor."""
    tpl = await Template.get(template_id)
    if not tpl:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")

    # Presets are publicly readable; club templates require ownership
    if not tpl.is_preset and tpl.club_id:
        if user.role != UserRole.SUPER_ADMIN and user.club_id != tpl.club_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this template")

    return TemplateHtmlResponse(
        template_id=str(tpl.id),
        html_content=tpl.html_content,
        field_slots=[FieldSlotSchema(**s.model_dump()) for s in tpl.field_slots],
    )


@router.patch("/templates/{template_id}/html", response_model=TemplateResponse)
async def update_template_html(
    template_id: PydanticObjectId,
    body: TemplateHtmlUpdate,
    user: User = Depends(get_current_user),
):
    """Update HTML content and field slots for a club-owned editable template."""
    tpl = await Template.get(template_id)
    if not tpl:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")

    if tpl.is_preset or not tpl.is_editable:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot edit preset templates directly. Fork first.")

    if user.role != UserRole.SUPER_ADMIN:
        if user.role != UserRole.CLUB_COORDINATOR or user.club_id != tpl.club_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this template")

    # Sanitise HTML
    clean_html = _sanitise_html(body.html_content)
    new_slots = [FieldSlot(**s.model_dump()) for s in body.field_slots]

    await tpl.set({
        "html_content": clean_html,
        "field_slots": [s.model_dump() for s in new_slots],
        "last_edited_at": datetime.utcnow(),
    })
    await tpl.sync()
    return await _resp(tpl, include_forked_name=True)


@router.patch("/templates/{template_id}/fields", response_model=TemplateResponse)
async def update_template_fields(
    template_id: PydanticObjectId,
    body: TemplateFieldsUpdate,
    user: User = Depends(get_current_user),
):
    """Update only field slot metadata (labels, positions) — no HTML change."""
    tpl = await Template.get(template_id)
    if not tpl:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Template not found")

    if tpl.is_preset:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot edit preset templates")

    if user.role != UserRole.SUPER_ADMIN:
        if user.role != UserRole.CLUB_COORDINATOR or user.club_id != tpl.club_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this template")

    new_slots = [FieldSlot(**s.model_dump()) for s in body.field_slots]
    await tpl.set({
        "field_slots": [s.model_dump() for s in new_slots],
        "last_edited_at": datetime.utcnow(),
    })
    await tpl.sync()
    return await _resp(tpl, include_forked_name=True)


# ══════════════════════════════════════════════════════════════════════════
# Fork endpoint
# ══════════════════════════════════════════════════════════════════════════

@router.post("/templates/{template_id}/fork", response_model=TemplateResponse, status_code=201)
async def fork_template(
    template_id: PydanticObjectId,
    user: User = Depends(get_current_user),
):
    """Fork a preset template into an editable club-owned copy. Idempotent."""
    if user.role != UserRole.CLUB_COORDINATOR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only club coordinators can fork templates")

    club_id = user.club_id
    if not club_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No club assigned to your account")

    source = await Template.get(template_id)
    if not source:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Source template not found")

    # Check for existing fork — idempotent
    existing = await Template.find_one(
        Template.forked_from == template_id,
        Template.club_id == club_id,
    )
    if existing:
        return await _resp(existing, include_forked_name=True)

    # Deep-copy into a new club-owned editable template
    fork = Template(
        club_id=club_id,
        name=f"{source.name} (Custom)",
        cert_type=source.cert_type,
        type=TemplateType.CUSTOM,
        html_content=source.html_content,
        field_slots=[FieldSlot(**s.model_dump()) for s in source.field_slots],
        static_elements=[StaticElement(**el.model_dump()) for el in source.static_elements],
        background=TemplateBackground(**source.background.model_dump()),
        border_color=source.border_color,
        font_family=source.font_family,
        font_color=source.font_color,
        is_preset=False,
        is_editable=True,
        source_preset_id=source.id if source.is_preset else source.source_preset_id,
        forked_from=source.id,
        preview_url=source.preview_url,
        created_at=datetime.utcnow(),
    )
    await fork.insert()
    return await _resp(fork, include_forked_name=True)


# ══════════════════════════════════════════════════════════════════════════
# Club-scoped templates
# ══════════════════════════════════════════════════════════════════════════

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
    return [await _resp(t) for t in combined]


# ── Club-scoped presets (global presets + club copies) ───────────────────

@router.get("/clubs/{club_id}/templates/presets", response_model=List[TemplateResponse])
async def list_club_presets(
    club_id: PydanticObjectId,
    _user: User = Depends(require_club_access),
):
    """Return all 6 global presets plus any club-specific copies."""
    presets = await Template.find(Template.is_preset == True).to_list()
    copies = await Template.find(
        Template.club_id == club_id,
        Template.source_preset_id != None,
    ).to_list()

    seen_ids: set = set()
    combined = []
    for t in presets + copies:
        if t.id not in seen_ids:
            seen_ids.add(t.id)
            combined.append(t)
    return [await _resp(t) for t in combined]



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
    return await _resp(tpl)


# ══════════════════════════════════════════════════════════════════════════
# Assign preset to event
# ══════════════════════════════════════════════════════════════════════════

@router.post("/clubs/{club_id}/events/{event_id}/templates/assign-preset")
async def assign_preset(
    club_id: PydanticObjectId,
    event_id: PydanticObjectId,
    body: dict,
    _user: User = Depends(require_event_access),
):
    """Assign a preset template to an event's template_map for a given cert_type."""
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


# ══════════════════════════════════════════════════════════════════════════
# Preset slot editor (copy-on-write resize)
# ══════════════════════════════════════════════════════════════════════════

class SlotUpdate(BaseModel):
    slot_id: str
    width: Optional[float] = Field(None, ge=1, le=2480)
    height: Optional[float] = Field(None, ge=1, le=3508)
    font_size: Optional[int] = Field(None, ge=6, le=200)


class PresetSlotPatchRequest(BaseModel):
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
    """Resize field slots via copy-on-write."""
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

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

    # Copy-on-write for preset templates
    if template.is_preset:
        copy_name = f"{template.name} (customised)"
        existing_copy = await Template.find_one(
            Template.club_id == club_id,
            Template.source_preset_id == template.id,
            Template.cert_type == cert_type,
        )

        if existing_copy:
            working_template = existing_copy
        else:
            working_template = Template(
                club_id=club_id,
                name=copy_name,
                cert_type=template.cert_type,
                type=TemplateType.PRESET,
                html_content=template.html_content,
                field_slots=[FieldSlot(**slot.model_dump()) for slot in template.field_slots],
                static_elements=[StaticElement(**el.model_dump()) for el in template.static_elements],
                background=TemplateBackground(**template.background.model_dump()),
                border_color=template.border_color,
                font_family=template.font_family,
                font_color=template.font_color,
                is_preset=False,
                source_preset_id=template.id,
                preview_url=template.preview_url,
                created_at=datetime.utcnow(),
            )
            await working_template.insert()

        event.template_map[cert_type] = working_template.id
        await event.set({"template_map": {k: v for k, v in event.template_map.items()}})
    else:
        working_template = template

    slot_map: dict[str, FieldSlot] = {s.slot_id: s for s in working_template.field_slots}

    missing = [u.slot_id for u in body.slot_updates if u.slot_id not in slot_map]
    if missing:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"Slot id(s) not found in template: {', '.join(missing)}",
        )

    for update in body.slot_updates:
        slot = slot_map[update.slot_id]
        if update.width is not None:
            slot.width = update.width
        if update.height is not None:
            slot.height = update.height
        if update.font_size is not None:
            slot.font_size = update.font_size

    updated_slots = [s.model_dump() for s in working_template.field_slots]
    await working_template.set({"field_slots": updated_slots})

    await working_template.sync()
    return await _resp(working_template)
