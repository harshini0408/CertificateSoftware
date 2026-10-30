from datetime import datetime
from typing import Optional

from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field


class EventRegistration(Document):
    event_id: Indexed(PydanticObjectId)  # type: ignore[valid-type]
    student_id: Indexed(PydanticObjectId)  # type: ignore[valid-type]
    student_name: str
    student_email: Indexed(str)  # type: ignore[valid-type]
    registration_number: Optional[str] = None
    department: Optional[str] = None
    event_date_str: str  # YYYY-MM-DD for same-day conflict validation
    session: str  # "FN" or "AN"
    slot: Optional[str] = None  # Specific slot e.g. "8:45 AM - 10:15 AM"
    registration_type: str = "participant"
    team_id: Optional[PydanticObjectId] = None
    status: str = "accepted"  # "accepted", "pending", "rejected"
    registered_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "event_registrations"
