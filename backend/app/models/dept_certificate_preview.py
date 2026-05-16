from datetime import datetime
from typing import Optional, Dict

from beanie import Document, PydanticObjectId
from pydantic import Field


class DeptCertificatePreview(Document):
    department: str
    coordinator_user_id: str
    event_id: PydanticObjectId
    template_id: Optional[PydanticObjectId] = None

    cert_number: str
    participant_email: Optional[str] = None
    preview_row: Dict[str, str] = Field(default_factory=dict)
    png_url: str

    approved: bool = False
    approved_at: Optional[datetime] = None
    approved_by_user_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "dept_certificate_previews"
