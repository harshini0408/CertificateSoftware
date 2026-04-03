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
    participant_name: Optional[str] = None
    participant_email: Optional[str] = None
    cert_type: Optional[str] = None
    snapshot: Dict[str, Any] = Field(default_factory=dict)
    status: str
    pdf_url: Optional[str] = None
    generated_at: Optional[datetime] = None
    issued_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GenerateResponse(BaseModel):
    queued_count: int = 0
    total: int = 0
    message: str = ""


class VerifyResponse(BaseModel):
    valid: bool = True
    cert_number: str
    name: str = ""
    participant_name: Optional[str] = None
    participant_email: Optional[str] = None
    event_name: str = ""
    club_name: str = ""
    cert_type: str = ""
    event_date: Optional[datetime] = None
    issued_date: Optional[datetime] = None
    issued_at: Optional[datetime] = None
    status: str = ""
    pdf_url: Optional[str] = None
    registration_number: Optional[str] = None
    scan_count: int = 0
    message: Optional[str] = None
