from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class CreditSemesterState(Document):
    key: str = "current"
    current_semester: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = None

    class Settings:
        name = "credit_semester_state"
        indexes = [
            IndexModel([("key", ASCENDING)], unique=True),
        ]
