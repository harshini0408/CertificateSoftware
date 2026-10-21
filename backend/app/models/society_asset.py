from datetime import datetime
from typing import Optional, Dict, Any
from beanie import Document, Indexed, PydanticObjectId
from pydantic import BaseModel, Field


class SocietyAsset(Document):
    society_id: Indexed(PydanticObjectId, unique=True)  # type: ignore[valid-type]
    society_slug: Optional[str] = None

    logo_path: Optional[str] = None
    logo_hash: Optional[str] = None
    logo_url: Optional[str] = None

    signature_path: Optional[str] = None
    signature_hash: Optional[str] = None
    signature_url: Optional[str] = None

    signature2_path: Optional[str] = None
    signature2_hash: Optional[str] = None
    signature2_url: Optional[str] = None

    template_path: Optional[str] = None
    template_url: Optional[str] = None

    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "society_assets"
