from datetime import datetime
from enum import Enum
from typing import Optional

from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    PRINCIPAL = "principal"
    HOD = "hod"
    CLUB_COORDINATOR = "club_coordinator"
    DEPT_COORDINATOR = "dept_coordinator"
    TUTOR = "tutor"
    STUDENT = "student"
    GUEST = "guest"


class User(Document):
    """User document — all accounts pre-created by super_admin."""

    username: Indexed(str, unique=True)  # type: ignore[valid-type]
    name: str
    email: Indexed(str, unique=True)  # type: ignore[valid-type]
    password_hash: str

    role: UserRole = UserRole.STUDENT
    first_login_completed: bool = True
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # ── Role-specific fields (null when not applicable) ──────────────
    club_id: Optional[PydanticObjectId] = None        # club_coordinator, guest
    event_id: Optional[PydanticObjectId] = None       # guest only
    department: Optional[str] = None                   # dept_coordinator, student
    registration_number: Optional[str] = None          # student only (unique)
    batch: Optional[str] = None                        # student only  e.g. "2022-2026"
    section: Optional[str] = None                      # student only

    otp_code: Optional[str] = None
    otp_expires_at: Optional[datetime] = None

    class Settings:
        name = "users"
