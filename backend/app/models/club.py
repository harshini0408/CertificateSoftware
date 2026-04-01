from datetime import datetime
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


class Club(Document):
    """Club / Organization document."""

    name: str
    slug: Indexed(str, unique=True)  # type: ignore[valid-type]
    contact_email: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "clubs"
