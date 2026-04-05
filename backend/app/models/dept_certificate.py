from datetime import datetime
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


class DeptCertificate(Document):
    cert_number: Indexed(str, unique=True)  # type: ignore[valid-type]
    department: str
    coordinator_user_id: str

    name: str
    class_name: str
    contribution: str

    png_url: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "dept_certificates"
