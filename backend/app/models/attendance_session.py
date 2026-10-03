from datetime import datetime
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field


class AttendanceSession(Document):
    """Temporary session generated after a valid QR scan.

    Guarantees the student has scanned a valid QR within the 20-second active window
    and holds a secure unique token to mark attendance with no further time limit.
    """

    token: Indexed(str, unique=True)
    event_id: PydanticObjectId
    student_id: PydanticObjectId
    created_at: datetime = Field(default_factory=datetime.utcnow)
    used: bool = False

    class Settings:
        name = "attendance_sessions"
