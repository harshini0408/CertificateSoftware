from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


class UserCreate(BaseModel):
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9_]+$",
        description="Letters, numbers, and underscores only.",
    )
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: Literal[
        "club_coordinator", "dept_coordinator", "student", "guest"
    ]
    is_active: bool = True

    # Role-conditional fields
    club_id: Optional[str] = None
    event_id: Optional[str] = None
    department: Optional[str] = None
    registration_number: Optional[str] = None
    batch: Optional[str] = None
    section: Optional[str] = None

    @model_validator(mode="after")
    def validate_role_fields(self):
        role = self.role

        if role == "club_coordinator":
            if not self.club_id:
                raise ValueError("club_id is required for club_coordinator role")

        elif role == "guest":
            if not self.club_id:
                raise ValueError("club_id is required for guest role")
            if not self.event_id:
                raise ValueError("event_id is required for guest role")

        elif role == "dept_coordinator":
            if not self.department:
                raise ValueError("department is required for dept_coordinator role")

        elif role == "student":
            missing = []
            if not self.department:
                missing.append("department")
            if not self.registration_number:
                missing.append("registration_number")
            if not self.batch:
                missing.append("batch")
            if not self.section:
                missing.append("section")
            if missing:
                raise ValueError(
                    f"Missing required fields for student role: {', '.join(missing)}"
                )

        return self


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: str
    username: str
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    club_id: Optional[str] = None
    event_id: Optional[str] = None
    department: Optional[str] = None
    registration_number: Optional[str] = None
    batch: Optional[str] = None
    section: Optional[str] = None

    class Config:
        from_attributes = True
