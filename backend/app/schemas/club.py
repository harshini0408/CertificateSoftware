from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


def validate_psgitech_email(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    val = str(v).strip().lower()
    if not val:
        return None
    if not val.endswith("@psgitech.ac.in"):
        raise ValueError("Only @psgitech.ac.in email addresses are allowed.")
    return val


class ClubCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: str = Field(
        ...,
        min_length=2,
        max_length=20,
        pattern=r"^[A-Z0-9]+$",
        description="Uppercase letters and digits only. Used in certificate numbers.",
    )
    contact_email: Optional[EmailStr] = None

    @field_validator("contact_email")
    @classmethod
    def validate_email_domain(cls, v: Optional[EmailStr]) -> Optional[EmailStr]:
        return validate_psgitech_email(v)


class ClubUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    contact_email: Optional[EmailStr] = None
    is_active: Optional[bool] = None

    @field_validator("contact_email")
    @classmethod
    def validate_email_domain(cls, v: Optional[EmailStr]) -> Optional[EmailStr]:
        return validate_psgitech_email(v)


class ClubResponse(BaseModel):
    id: str
    name: str
    slug: str
    contact_email: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
