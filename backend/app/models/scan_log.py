from datetime import datetime
from typing import Optional

from beanie import Document, PydanticObjectId
from pydantic import Field


class ScanLog(Document):
    certificate_id: PydanticObjectId
    cert_number: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    scanned_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "scan_logs"
