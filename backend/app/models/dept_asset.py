from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import Field


class DeptAsset(Document):
    department: str
    logo_path: Optional[str] = None
    logo_hash: Optional[str] = None
    logo_url: Optional[str] = None

    signature1_path: Optional[str] = None
    signature1_hash: Optional[str] = None
    signature1_url: Optional[str] = None

    signature2_path: Optional[str] = None
    signature2_hash: Optional[str] = None
    signature2_url: Optional[str] = None

    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "dept_assets"
