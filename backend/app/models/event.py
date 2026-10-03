from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any, Literal

from beanie import Document, PydanticObjectId
from pydantic import BaseModel, Field, field_validator

class EventStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"
    COMPLETED = "completed"


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
    event_time: Optional[str] = None
    venue: Optional[str] = None
    category: Optional[str] = None
    academic_year: Optional[str] = None
    academic_years: List[str] = Field(default_factory=list)
    status: EventStatus = EventStatus.DRAFT

    # Upcoming event publishing
    poster_path: Optional[str] = None
    poster_url: Optional[str] = None
    is_published: bool = False

    # Event report (club events only)
    report_url: Optional[str] = None
    report_path: Optional[str] = None
    report_filename: Optional[str] = None
    report_uploaded_at: Optional[datetime] = None
    report_status: Optional[str] = "not_submitted"  # not_submitted | pending_review | accepted | rejected
    report_rejection_reason: Optional[str] = None
    report_reviewed_at: Optional[datetime] = None
    report_reviewed_by: Optional[str] = None

    template_map: Dict[str, Optional[str]] = Field(default_factory=dict)

    @field_validator("template_map", mode="before")
    @classmethod
    def coerce_template_map(cls, v: Any) -> Dict[str, Optional[str]]:
        if not isinstance(v, dict):
            return {}
        return {key: (str(val) if val is not None else None) for key, val in v.items()}

    template_filename: Optional[str] = None
    assets: EventAssets = Field(default_factory=EventAssets)
    mapping_confirmed: bool = False
    participant_count: int = 0
    volunteers_required: int = 0
    qr_generations_count: int = 0
    registration_stopped: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Guest flow fields have been moved to GuestSession model.

    class Settings:
        name = "events"

