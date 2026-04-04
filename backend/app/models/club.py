from datetime import datetime
from typing import Optional

from beanie import Document, Indexed
from pydantic import BaseModel, Field


class ClubAssets(BaseModel):
    logo_path: Optional[str] = None
    logo_hash: Optional[str] = None
    logo_url: Optional[str] = None
    signature_path: Optional[str] = None
    signature_hash: Optional[str] = None
    signature_url: Optional[str] = None


class Club(Document):
    """Club / Organization document."""

    name: str
    slug: Indexed(str, unique=True)  # type: ignore[valid-type]
    contact_email: Optional[str] = None
    assets: ClubAssets = Field(default_factory=ClubAssets)
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "clubs"
