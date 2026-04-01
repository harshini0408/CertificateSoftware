from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class CertificateResponse(BaseModel):
    id: str
    cert_number: str
    participant_id: str
    event_id: str
    template_id: str
    club_id: str
    snapshot: Dict[str, Any] = Field(default_factory=dict)
    status: str
    issued_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GenerateResponse(BaseModel):
    queued_count: int = 0


class VerifyResponse(BaseModel):
    cert_number: str
    name: str
    event_name: str
    club_name: str
    cert_type: str
    issued_date: Optional[datetime] = None
    status: str
