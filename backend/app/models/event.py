from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any

from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field, field_validator
from typing import Any

class EventStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"
    COMPLETED = "completed"


class QRConfig(BaseModel):
    custom_fields: List[str] = Field(default_factory=list)
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
    logo_path: Optional[str] = None
    logo_hash: Optional[str] = None
    logo_url: Optional[str] = None
    signature_path: Optional[str] = None
    signature_hash: Optional[str] = None
    signature_url: Optional[str] = None


class Event(Document):
    club_id: PydanticObjectId
    name: str
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    status: EventStatus = EventStatus.DRAFT

    template_map: Dict[str, Optional[str]] = Field(default_factory=dict)

    @field_validator("template_map", mode="before")
    @classmethod
    def coerce_template_map(cls, v: Any) -> Dict[str, Optional[str]]:
        if not isinstance(v, dict):
            return {}
        return {key: (str(val) if val is not None else None) for key, val in v.items()}

    template_filename: Optional[str] = None
    qr_config: QRConfig = Field(default_factory=QRConfig)
    assets: EventAssets = Field(default_factory=EventAssets)
    mapping_confirmed: bool = False
    participant_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "events"
