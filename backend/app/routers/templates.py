from typing import List

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from ..core.dependencies import require_club_access
from ..models.user import User
from ..models.template import Template, TemplateType
from ..schemas.template import TemplateCreate, TemplateResponse, FieldSlotSchema, StaticElementSchema, BackgroundSchema

router = APIRouter(prefix="/clubs/{club_id}/templates", tags=["Templates"])


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


@router.get("", response_model=List[TemplateResponse])
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


@router.post("", response_model=TemplateResponse, status_code=201)
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
