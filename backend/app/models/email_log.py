from datetime import datetime
from enum import Enum
from typing import Optional

from beanie import Document, PydanticObjectId
from pydantic import Field


class EmailStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    QUEUED = "queued"


class EmailLog(Document):
    certificate_id: PydanticObjectId
    recipient_email: str
    status: EmailStatus = EmailStatus.PENDING
    attempt_count: int = 0
    error_msg: Optional[str] = None
    scheduled_for: Optional[datetime] = None
    sent_at: Optional[datetime] = None

    class Settings:
        name = "email_logs"
