from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ClubCreate(BaseModel):
    name: str
    slug: str = Field(..., pattern=r"^[A-Z0-9_]+$")
    contact_email: Optional[str] = None


class ClubUpdate(BaseModel):
    name: Optional[str] = None
    contact_email: Optional[str] = None
    is_active: Optional[bool] = None


class ClubResponse(BaseModel):
    id: str
    name: str
    slug: str
    contact_email: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
