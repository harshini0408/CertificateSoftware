from datetime import datetime
from enum import Enum
from typing import Optional

from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field


class MembershipStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class StudentClubMembership(Document):
    """Tracks a student's application/membership to a club."""

    student_id: PydanticObjectId          # References User._id (student)
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    club_id: PydanticObjectId             # References Club._id
    club_name: Optional[str] = None       # Denormalized for display
    status: MembershipStatus = MembershipStatus.PENDING
    applied_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_by: Optional[str] = None     # coordinator user id
    review_note: Optional[str] = None
    office_bearer_role: Optional[str] = None  # e.g., "President", "Vice President", "Secretary", "Joint Secretary", "Treasurer"

    class Settings:
        name = "student_club_memberships"
