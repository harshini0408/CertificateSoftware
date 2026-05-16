from datetime import datetime
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


class Department(Document):
    """Department master used by Super Admin for fixed department selection."""

    name: Indexed(str, unique=True)  # type: ignore[valid-type]
    slug: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "departments"
