from datetime import datetime
from typing import Optional

from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field
from pymongo import IndexModel, ASCENDING


class Attendance(Document):
    """Records a student's confirmed attendance at a club event."""

    event_id: Indexed(PydanticObjectId)  # type: ignore[valid-type]
    club_id: PydanticObjectId
    student_id: Indexed(PydanticObjectId)  # type: ignore[valid-type]
    student_email: Indexed(str)  # type: ignore[valid-type]
    student_name: Optional[str] = None
    registration_number: Optional[str] = None
    feedback: Optional[str] = None
    marked_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "attendances"
        indexes = [
            # Unique: one attendance record per (event, student)
            IndexModel(
                [("event_id", ASCENDING), ("student_id", ASCENDING)],
                unique=True,
            ),
        ]
