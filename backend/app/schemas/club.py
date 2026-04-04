from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class ClubCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(
        ...,
        min_length=2,
        max_length=20,
        pattern=r"^[A-Z0-9]+$",
        description="Uppercase letters and digits only. Used in certificate numbers.",
    )
    contact_email: EmailStr
    coordinator_username: str = Field(..., min_length=3, max_length=50)
    coordinator_password: str = Field(..., min_length=6, max_length=128)


class ClubUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    contact_email: Optional[EmailStr] = None
    is_active: Optional[bool] = None


class ClubResponse(BaseModel):
    id: str
    name: str
    slug: str
    contact_email: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
