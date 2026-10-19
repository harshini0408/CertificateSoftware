from datetime import datetime
from enum import Enum
from typing import Optional

from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field


class SocietyMembershipStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class StudentSocietyMembership(Document):
    """Tracks a student's application/membership to a professional society."""

    student_id: PydanticObjectId          # References User._id (student)
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    society_id: PydanticObjectId          # References ProfessionalSociety._id
    society_name: Optional[str] = None    # Denormalized for display
    status: SocietyMembershipStatus = SocietyMembershipStatus.PENDING
    applied_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_by: Optional[str] = None     # coordinator user id
    review_note: Optional[str] = None
    office_bearer_role: Optional[str] = None

    class Settings:
        name = "student_society_memberships"
