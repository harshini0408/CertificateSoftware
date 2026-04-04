from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field, field_validator
from typing import Any

# ── Enums ────────────────────────────────────────────────────────────────

class EventStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"
    COMPLETED = "completed"


# ── Embedded sub-models ──────────────────────────────────────────────────

class QRConfig(BaseModel):
    """QR-based registration configuration embedded in an Event."""
    custom_fields: List[str] = Field(default_factory=list)   # max 5 labels
    expires_at: Optional[datetime] = None
    token: Optional[str] = None
    is_active: bool = False

    @field_validator("custom_fields")
    @classmethod
    def validate_custom_fields(cls, v):
        if len(v) > 5:
            raise ValueError("QR custom fields limited to 5")
        return v


class EventAssets(BaseModel):
    """Uploaded logo + signature paths/hashes embedded in an Event."""
    logo_path: Optional[str] = None
    logo_hash: Optional[str] = None
    logo_url: Optional[str] = None
    signature_path: Optional[str] = None
    signature_hash: Optional[str] = None
    signature_url: Optional[str] = None


# ── Document ─────────────────────────────────────────────────────────────

class Event(Document):
    """Event document — belongs to a club."""

    club_id: PydanticObjectId
    name: str
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    status: EventStatus = EventStatus.DRAFT

    template_map: Dict[str, Any] = Field(default_factory=dict)

    # PNG image template filename (new image-based system)
    # e.g. "template_01.png" — if set, Pillow overlay pipeline is used instead of imgkit
    template_filename: Optional[str] = None

    qr_config: QRConfig = Field(default_factory=QRConfig)
    assets: EventAssets = Field(default_factory=EventAssets)

    mapping_confirmed: bool = False
    participant_count: int = 0

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "events"
