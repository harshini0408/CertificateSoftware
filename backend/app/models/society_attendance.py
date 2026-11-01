from datetime import datetime
from typing import Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field
from pymongo import IndexModel, ASCENDING


class SocietyAttendance(Document):
    """Records a student's confirmed attendance at a professional society event."""

    event_id: Indexed(PydanticObjectId)  # type: ignore[valid-type]
    society_id: PydanticObjectId
    club_id: Optional[PydanticObjectId] = None  # for backward compatibility
    student_id: Indexed(PydanticObjectId)  # type: ignore[valid-type]
    student_email: Indexed(str)  # type: ignore[valid-type]
    student_name: Optional[str] = None
    registration_number: Optional[str] = None
    feedback: Optional[str] = None
    marked_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "society_attendances"
        indexes = [
            IndexModel(
                [("event_id", ASCENDING), ("student_id", ASCENDING)],
                unique=True,
            ),
        ]
