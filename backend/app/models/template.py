from datetime import datetime
from enum import Enum
from typing import List, Literal, Optional

from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field


# ── Enums ────────────────────────────────────────────────────────────────

class TemplateType(str, Enum):
    PRESET = "preset"
    CUSTOM = "custom"


# ── Embedded sub-models ──────────────────────────────────────────────────

class FieldSlot(BaseModel):
    """A dynamic text slot that gets filled per-participant."""
    slot_id: str
    label: str
    x: float
    y: float
    width: float
    height: float
    font_size: int = 40
    font_weight: str = "normal"
    text_align: str = "center"
    color: Optional[str] = None           # e.g. "#1B4D3E"; None = inherit from template


class StaticElement(BaseModel):
    """A fixed visual element baked into the template."""
    element_id: str
    type: Literal["text", "image", "divider"]
    content: Optional[str] = None
    x: float
    y: float
    width: float
    height: float
    font_size: Optional[int] = None
    font_color: Optional[str] = None
    font_family: Optional[str] = None
    font_weight: Optional[str] = None


class TemplateBackground(BaseModel):
    """Background definition for the certificate template."""
    type: str = "color"          # color | image | gradient
    value: str = "#FFFFFF"       # hex, base64, or CSS gradient


# ── Document ─────────────────────────────────────────────────────────────

class Template(Document):
    """Certificate template document."""

    club_id: Optional[PydanticObjectId] = None   # null → preset
    name: str
    cert_type: str                                # e.g. participant, coordinator
    type: TemplateType = TemplateType.PRESET

    html_content: str = ""                        # Jinja2 HTML source

    field_slots: List[FieldSlot] = Field(default_factory=list)
    static_elements: List[StaticElement] = Field(default_factory=list)
    background: TemplateBackground = Field(default_factory=TemplateBackground)

    border_color: Optional[str] = None
    font_family: Optional[str] = None
    font_color: Optional[str] = None

    is_preset: bool = False
    is_editable: bool = False                             # True only for club-owned forks
    source_preset_id: Optional[PydanticObjectId] = None   # tracks which preset this copy came from
    forked_from: Optional[PydanticObjectId] = None        # points to the source preset _id
    last_edited_at: Optional[datetime] = None             # auto-updated on every PATCH
    preview_url: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "templates"
