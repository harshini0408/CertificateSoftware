import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from .model import CertificateTemplateConfig, FieldConfig
from ..core.dependencies import require_role
from ..models.user import UserRole
from ..config import get_settings

router = APIRouter(prefix="/certificate-config", tags=["Certificates Config"])

class SaveConfigRequest(BaseModel):
    template_name: str
    fields: List[FieldConfig]

@router.get("/templates")
async def list_templates(
    current_user=Depends(require_role(UserRole.SUPER_ADMIN))
):
    """Get all certificate templates from static/certificate_templates."""
    settings = get_settings()
    # Path relative to the app root
    templates_dir = os.path.join("app", "static", "certificate_templates")
    if not os.path.exists(templates_dir):
        return []
    
    return [
        f for f in os.listdir(templates_dir) 
        if f.lower().endswith((".png", ".jpg", ".jpeg"))
    ]

@router.get("/config/{template_name}")
async def get_config(
    template_name: str,
    current_user=Depends(require_role(UserRole.SUPER_ADMIN))
):
    """Retrieve configuration for a specific template."""
    config = await CertificateTemplateConfig.find_one(
        CertificateTemplateConfig.template_name == template_name
    )
    if not config:
        return {}
    
    # Return as dict: { "field_name": { "x": val, "y": val }, ... }
    return {f.field_name: {"x": f.x, "y": f.y} for f in config.fields}

@router.post("/save")
async def save_config(
    payload: SaveConfigRequest,
    current_user=Depends(require_role(UserRole.SUPER_ADMIN))
):
    """Save or update configuration for a template."""
    config = await CertificateTemplateConfig.find_one(
        CertificateTemplateConfig.template_name == payload.template_name
    )
    if config:
        config.fields = payload.fields
        await config.save()
    else:
        config = CertificateTemplateConfig(
            template_name=payload.template_name,
            fields=payload.fields
        )
        await config.insert()
    return {"message": "Configuration saved", "fields_count": len(payload.fields)}
