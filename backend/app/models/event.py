from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any

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
    session: Optional[str] = None  # "FN" or "AN"
    slot: Optional[str] = None  # "8:45 AM - 10:15 AM", "10:30 AM - 12:00 PM", "1:10 PM - 2:50 PM", "3:05 PM - 4:45 PM"
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
    max_participants: Optional[int] = None
    participant_count: int = 0
    volunteers_required: int = 0
    is_team_event: bool = False
    min_team_size: Optional[int] = 2
    max_team_size: Optional[int] = 4
    max_teams: Optional[int] = None
    team_count: int = 0
    qr_generations_count: int = 0
    registration_stopped: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Guest flow fields have been moved to GuestSession model.

    class Settings:
        name = "events"

