from datetime import date, datetime
from enum import Enum
from typing import Optional

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class ManualSubmissionStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class ManualCreditSubmission(Document):
    student_email: str
    student_name: str = ""
    registration_number: Optional[str] = None
    tutor_email: str

    cert_type: str
    event_date: date
    certificate_image_url: str
    semester: Optional[str] = None

    status: ManualSubmissionStatus = ManualSubmissionStatus.PENDING
    points_awarded: int = 0
    review_comment: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None

    submitted_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "manual_credit_submissions"
        indexes = [
            IndexModel([("student_email", ASCENDING)]),
            IndexModel([("tutor_email", ASCENDING), ("status", ASCENDING)]),
            IndexModel([("submitted_at", ASCENDING)]),
        ]
