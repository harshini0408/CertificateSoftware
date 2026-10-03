from datetime import datetime
from typing import List, Optional

from beanie import Document, Indexed
from pydantic import BaseModel, Field


DEFAULT_OFFICE_BEARER_POSITIONS = [
    "President",
    "Vice President",
    "Secretary",
    "Joint Secretary",
    "Treasurer",
]


class ClubAssets(BaseModel):
    logo_path: Optional[str] = None
    logo_hash: Optional[str] = None
    logo_url: Optional[str] = None
    signature_path: Optional[str] = None
    signature_hash: Optional[str] = None
    signature_url: Optional[str] = None
    signature2_path: Optional[str] = None
    signature2_hash: Optional[str] = None
    signature2_url: Optional[str] = None


class Club(Document):
    """Club / Organization document."""

    name: str
    slug: Indexed(str, unique=True)  # type: ignore[valid-type]
    contact_email: Optional[str] = None
    assets: ClubAssets = Field(default_factory=ClubAssets)
    office_bearer_positions: List[str] = Field(default_factory=lambda: list(DEFAULT_OFFICE_BEARER_POSITIONS))
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "clubs"
