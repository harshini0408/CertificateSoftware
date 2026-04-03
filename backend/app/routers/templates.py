from typing import List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..core.dependencies import require_club_access, require_event_access
from ..models.user import User
from ..models.template import Template, TemplateType
from ..models.event import Event
from ..schemas.template import TemplateCreate, TemplateResponse, FieldSlotSchema, StaticElementSchema, BackgroundSchema

router = APIRouter(tags=["Templates"])


def _resp(t: Template) -> TemplateResponse:
    return TemplateResponse(
        id=str(t.id), club_id=str(t.club_id) if t.club_id else None,
        name=t.name, cert_type=t.cert_type, type=t.type.value,
        html_content=t.html_content,
        field_slots=[FieldSlotSchema(**s.model_dump()) for s in t.field_slots],
        static_elements=[StaticElementSchema(**s.model_dump()) for s in t.static_elements],
        background=BackgroundSchema(**t.background.model_dump()),
        border_color=t.border_color, font_family=t.font_family, font_color=t.font_color,
        is_preset=t.is_preset, preview_url=t.preview_url, created_at=t.created_at,
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
async def list_templates(club_id: PydanticObjectId, _user: User = Depends(require_club_access)):
    presets = await Template.find(Template.is_preset == True).to_list()
    custom = await Template.find(Template.club_id == club_id).to_list()
    seen_ids = set()
    combined = []
    for t in presets + custom:
        if t.id not in seen_ids:
            seen_ids.add(t.id)
            combined.append(t)
    return [_resp(t) for t in combined]


@router.post("/clubs/{club_id}/templates", response_model=TemplateResponse, status_code=201)
async def create_template(club_id: PydanticObjectId, body: TemplateCreate,
                          _user: User = Depends(require_club_access)):
    from ..models.template import FieldSlot, StaticElement, TemplateBackground
    tpl = Template(
        club_id=club_id, name=body.name, cert_type=body.cert_type,
        type=TemplateType.CUSTOM, html_content=body.html_content,
        field_slots=[FieldSlot(**s.model_dump()) for s in body.field_slots],
        static_elements=[StaticElement(**s.model_dump()) for s in body.static_elements],
        background=TemplateBackground(**body.background.model_dump()),
        border_color=body.border_color, font_family=body.font_family,
        font_color=body.font_color, is_preset=False,
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
