from datetime import datetime
from typing import Optional

from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field


class DeptCertificate(Document):
    cert_number: Indexed(str, unique=True)  # type: ignore[valid-type]
    department: str
    coordinator_user_id: str
    event_id: Optional[str] = None

    # Reference to DeptAsset used for this certificate (optional for backward compatibility)
    dept_asset_id: Optional[PydanticObjectId] = None

    name: str
    class_name: str
    contribution: str
    participant_email: Optional[str] = None

    png_url: str
    emailed_at: Optional[datetime] = None
    email_error: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "dept_certificates"
