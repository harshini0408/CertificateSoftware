from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..core.dependencies import require_role
from ..models.role_template_preset import RoleTemplatePreset
from ..models.user import User, UserRole

router = APIRouter(prefix="/role-presets", tags=["Role Presets"])
_admin = Depends(require_role(UserRole.SUPER_ADMIN))


def _normalize_role_name(value: str) -> str:
    return (value or "").strip().lower().replace(" ", "_").replace("-", "_")


class RolePresetUpsert(BaseModel):
    role_name: str = Field(..., min_length=2, max_length=80)
    display_label: str = Field(..., min_length=2, max_length=120)
    template_filename: str = Field(..., min_length=1)
    column_positions: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    asset_positions: Optional[Dict[str, Dict[str, float]]] = None
    display_width: float = 1905.0
    is_active: bool = True


class RolePresetResponse(BaseModel):
    role_name: str
    display_label: str
    template_filename: str
    column_positions: Dict[str, Dict[str, float]]
    asset_positions: Optional[Dict[str, Dict[str, float]]] = None
    display_width: float
    is_active: bool
    created_at: datetime


class SeedResponse(BaseModel):
    created: int
    updated: int
    total: int


def _to_response(doc: RoleTemplatePreset) -> RolePresetResponse:
    return RolePresetResponse(
        role_name=doc.role_name,
        display_label=doc.display_label,
        template_filename=doc.template_filename,
        column_positions=doc.column_positions,
        asset_positions=doc.asset_positions,
        display_width=doc.display_width,
        is_active=doc.is_active,
        created_at=doc.created_at,
    )


def _default_column_positions() -> Dict[str, Dict[str, float]]:
    return {}


def _default_asset_positions() -> Dict[str, Dict[str, float]]:
    return {
        "logo": {"x_percent": 88.0, "y_percent": 10.0, "width_percent": 15.0},
        "signature": {"x_percent": 17.0, "y_percent": 88.0, "width_percent": 11.0},
    }


@router.get("", response_model=List[RolePresetResponse])
async def list_role_presets(include_inactive: bool = False):
    query = []
    if not include_inactive:
        query.append(RoleTemplatePreset.is_active == True)
    presets = await RoleTemplatePreset.find(*query).to_list()
    return [_to_response(p) for p in presets]


@router.post("/seed", response_model=SeedResponse)
async def seed_role_presets(_user: User = _admin):
    template_dir = Path(__file__).resolve().parents[1] / "static" / "certificate_templates"
    available_pngs = sorted([p.name for p in template_dir.glob("*.png")])
    if not available_pngs:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No PNG templates found in static/certificate_templates")

    role_specs = [
        ("student_council_member", "Student Council Member"),
        ("office_bearer", "Office Bearer"),
        ("club_member", "Club Member"),
        ("class_representative", "Class Representative"),
        ("student_volunteer", "Student Volunteer"),
        ("organizer", "Organizer"),
        ("coordinator", "Coordinator"),
        ("technical_talk", "Technical Talk"),
        ("paper_presenter", "Paper Presenter"),
        ("first_place", "First Place"),
        ("second_place", "Second Place"),
        ("third_place", "Third Place"),
        ("technical_participant", "Technical Participant"),
        ("non_technical_participant", "Non-Technical Participant"),
    ]

    created = 0
    updated = 0
    for idx, (role_name, display_label) in enumerate(role_specs):
        template_filename = available_pngs[idx % len(available_pngs)]

        existing = await RoleTemplatePreset.find_one(RoleTemplatePreset.role_name == role_name)
        payload = {
            "display_label": display_label,
            "template_filename": template_filename,
            "column_positions": _default_column_positions(),
            "asset_positions": _default_asset_positions(),
            "display_width": 1905.0,
            "is_active": True,
        }
        if existing:
            await existing.set(payload)
            updated += 1
        else:
            await RoleTemplatePreset(role_name=role_name, **payload).insert()
            created += 1

    return SeedResponse(created=created, updated=updated, total=len(role_specs))


@router.get("/{role_name}", response_model=RolePresetResponse)
async def get_role_preset(role_name: str):
    normalized = _normalize_role_name(role_name)
    preset = await RoleTemplatePreset.find_one(RoleTemplatePreset.role_name == normalized)
    if not preset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role preset not found")
    return _to_response(preset)


@router.post("", response_model=RolePresetResponse, status_code=201)
async def create_role_preset(body: RolePresetUpsert, _user: User = _admin):
    normalized = _normalize_role_name(body.role_name)
    existing = await RoleTemplatePreset.find_one(RoleTemplatePreset.role_name == normalized)
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Role preset already exists")

    preset = RoleTemplatePreset(
        role_name=normalized,
        display_label=body.display_label,
        template_filename=body.template_filename,
        column_positions=body.column_positions,
        asset_positions=body.asset_positions,
        display_width=body.display_width,
        is_active=body.is_active,
    )
    await preset.insert()
    return _to_response(preset)


@router.put("/{role_name}", response_model=RolePresetResponse)
async def update_role_preset(role_name: str, body: RolePresetUpsert, _user: User = _admin):
    normalized = _normalize_role_name(role_name)
    preset = await RoleTemplatePreset.find_one(RoleTemplatePreset.role_name == normalized)
    if not preset:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role preset not found")

    print("--- UPDATE RECEIVED FOR ROLE:", role_name)
    print("BODY COLUMN POSITIONS:", body.column_positions)
    update_data = {
        "role_name": _normalize_role_name(body.role_name),
        "display_label": body.display_label,
        "template_filename": body.template_filename,
        "column_positions": body.column_positions,
        "asset_positions": body.asset_positions,
        "display_width": body.display_width,
        "is_active": body.is_active,
    }
    await preset.set(update_data)
    preset = await RoleTemplatePreset.get(preset.id)
    return _to_response(preset)
