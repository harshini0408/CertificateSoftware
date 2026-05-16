from datetime import datetime
from typing import Dict, Optional

from beanie import Document, Indexed
from pydantic import Field


class RoleTemplatePreset(Document):
    """Maps a normalized role to template filename and fixed field positions."""

    role_name: Indexed(str, unique=True)  # type: ignore[valid-type]
    display_label: str
    template_filename: str
    column_positions: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    asset_positions: Optional[Dict[str, Dict[str, float]]] = None
    display_width: float = 1905.0
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "role_template_presets"
