from datetime import datetime
from typing import Optional

from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field


class CreditRule(Document):
    cert_type: Indexed(str, unique=True)  # type: ignore[valid-type]
    points: int = 0
    updated_by: Optional[PydanticObjectId] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "credit_rules"
