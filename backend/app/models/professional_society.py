from datetime import datetime
from typing import List, Optional

from beanie import Document, Indexed
from pydantic import BaseModel, Field


DEFAULT_SOCIETY_OFFICE_BEARER_POSITIONS = [
    "Chairperson",
    "Vice Chairperson",
    "Secretary",
    "Joint Secretary",
    "Treasurer",
]


class SocietyAssets(BaseModel):
    logo_path: Optional[str] = None
    logo_hash: Optional[str] = None
    logo_url: Optional[str] = None
    signature_path: Optional[str] = None
    signature_hash: Optional[str] = None
    signature_url: Optional[str] = None
    signature2_path: Optional[str] = None
    signature2_hash: Optional[str] = None
    signature2_url: Optional[str] = None


class ProfessionalSociety(Document):
    """Professional Society document."""

    name: str
    slug: Indexed(str, unique=True)  # type: ignore[valid-type]
    slug_locked: bool = False  # Becomes True after first slug edit
    contact_email: Optional[str] = None
    assets: SocietyAssets = Field(default_factory=SocietyAssets)
    office_bearer_positions: List[str] = Field(
        default_factory=lambda: list(DEFAULT_SOCIETY_OFFICE_BEARER_POSITIONS)
    )
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "professional_societies"
