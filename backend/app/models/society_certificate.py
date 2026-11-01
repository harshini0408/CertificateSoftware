from datetime import datetime
from typing import Any, Dict, Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import BaseModel, Field

from .certificate import CertStatus, CertSnapshot


class SocietyCertificate(Document):
    cert_number: Indexed(str, unique=True)  # type: ignore[valid-type]
    participant_id: PydanticObjectId
    event_id: PydanticObjectId
    template_id: PydanticObjectId
    society_id: PydanticObjectId
    club_id: Optional[PydanticObjectId] = None  # for backward compatibility

    snapshot: CertSnapshot = Field(default_factory=CertSnapshot)
    png_url: Optional[str] = None

    status: CertStatus = CertStatus.PENDING
    issued_at: Optional[datetime] = None

    revoked_at: Optional[datetime] = None
    revoked_by: Optional[PydanticObjectId] = None

    class Settings:
        name = "society_certificates"
