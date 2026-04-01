from datetime import datetime
from typing import List, Optional

from beanie import Document
from pydantic import BaseModel, Field
from pymongo import IndexModel, ASCENDING


class CreditHistoryEntry(BaseModel):
    cert_number: str
    event_name: str
    club_name: str
    cert_type: str
    points_awarded: int
    awarded_at: datetime = Field(default_factory=datetime.utcnow)


class StudentCredit(Document):
    student_email: str
    registration_number: str
    student_name: str = ""
    department: Optional[str] = None
    batch: Optional[str] = None
    section: Optional[str] = None

    total_credits: int = 0
    credit_history: List[CreditHistoryEntry] = Field(default_factory=list)
    last_updated: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "student_credits"
        indexes = [
            IndexModel([("student_email", ASCENDING)]),
            IndexModel([("registration_number", ASCENDING)]),
            IndexModel(
                [("student_email", ASCENDING), ("registration_number", ASCENDING)],
                unique=True,
            ),
        ]
