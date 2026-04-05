from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from beanie import Document, Indexed, PydanticObjectId
from pydantic import BaseModel, Field


class CertStatus(str, Enum):
    PENDING = "pending"
    GENERATED = "generated"
    EMAILED = "emailed"
    FAILED = "failed"
    REVOKED = "revoked"


class CertSnapshot(BaseModel):
    name: str = ""
    email: str = ""
    registration_number: Optional[str] = None
    event_name: str = ""
    club_name: str = ""
    cert_type: str = ""
    issued_date: Optional[datetime] = None
    extra_fields: Dict[str, Any] = Field(default_factory=dict)


class Certificate(Document):
    cert_number: Indexed(str, unique=True)  # type: ignore[valid-type]
    participant_id: PydanticObjectId
    event_id: PydanticObjectId
    template_id: PydanticObjectId
    club_id: PydanticObjectId

    snapshot: CertSnapshot = Field(default_factory=CertSnapshot)
    png_url: Optional[str] = None

    status: CertStatus = CertStatus.PENDING
    issued_at: Optional[datetime] = None

    revoked_at: Optional[datetime] = None
    revoked_by: Optional[PydanticObjectId] = None

    class Settings:
        name = "certificates"
