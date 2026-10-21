from datetime import datetime
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field


class SocietyAttendanceSession(Document):
    """Temporary session generated after a valid QR scan for a society event."""

    token: Indexed(str, unique=True)
    event_id: PydanticObjectId
    student_id: PydanticObjectId
    created_at: datetime = Field(default_factory=datetime.utcnow)
    used: bool = False

    class Settings:
        name = "society_attendance_sessions"
