from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field


# ── Enums ────────────────────────────────────────────────────────────────

class EventStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"


# ── Embedded sub-models ──────────────────────────────────────────────────

class QRConfig(BaseModel):
    """QR-based registration configuration embedded in an Event."""
    custom_fields: List[str] = Field(default_factory=list)   # max 3 labels
    expires_at: Optional[datetime] = None
    token: Optional[str] = None
    is_active: bool = False


class EventAssets(BaseModel):
    """Uploaded logo + signature paths/hashes embedded in an Event."""
    logo_path: Optional[str] = None
    logo_hash: Optional[str] = None
    signature_path: Optional[str] = None
    signature_hash: Optional[str] = None


# ── Document ─────────────────────────────────────────────────────────────

class Event(Document):
    """Event document — belongs to a club."""

    club_id: PydanticObjectId
    name: str
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    status: EventStatus = EventStatus.DRAFT

    # Maps cert_type label → template ObjectId
    template_map: Dict[str, Optional[PydanticObjectId]] = Field(default_factory=dict)

    qr_config: QRConfig = Field(default_factory=QRConfig)
    assets: EventAssets = Field(default_factory=EventAssets)

    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "events"
