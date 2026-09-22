from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


def validate_psgitech_email(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    val = str(v).strip().lower()
    if not val.endswith("@psgitech.ac.in"):
        raise ValueError("Only @psgitech.ac.in email addresses are allowed.")
    return val


class UserCreate(BaseModel):
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9_-]+$",
        description="Letters, numbers, underscores, and hyphens only.",
    )
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: Optional[str] = None

    @field_validator("email")
    @classmethod
    def validate_email_domain(cls, v: EmailStr) -> EmailStr:
        return validate_psgitech_email(v)
    role: Literal[
        "principal", "hod", "student_affairs", "club_coordinator", "dept_coordinator", "tutor", "student", "guest", "faculty"
    ]
    is_active: bool = True

    # Role-conditional fields
    club_id: Optional[str] = None
    event_id: Optional[str] = None
    department: Optional[str] = None
    departments: Optional[List[str]] = None
    registration_number: Optional[str] = None
    batch: Optional[str] = None
    section: Optional[str] = None

    @model_validator(mode="after")
    def validate_role_fields(self):
        role = self.role

        if role != "faculty" and (not self.password or len(self.password) < 8):
            raise ValueError("Password must be at least 8 characters")

        if role == "faculty":
            if not self.department or not str(self.department).strip():
                raise ValueError("Department is required for faculty role")

        elif role == "club_coordinator":
            if not self.club_id:
                raise ValueError("club_id is required for club_coordinator role")

        elif role == "guest":
            pass

        elif role == "dept_coordinator":
            if not self.department:
                raise ValueError("department is required for dept_coordinator role")

        elif role == "hod":
            has_department = bool((self.department or "").strip())
            has_departments = bool(self.departments and len([d for d in self.departments if (d or "").strip()]) > 0)
            if not has_department and not has_departments:
                raise ValueError("At least one department is required for hod role")

        elif role == "tutor":
            missing = []
            if not self.department:
                missing.append("department")
            if not self.batch:
                missing.append("batch")
            if not self.section:
                missing.append("section")
            if missing:
                raise ValueError(
                    f"Missing required fields for tutor role: {', '.join(missing)}"
                )

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
    username: Optional[str] = Field(
        None,
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9_-]+$",
    )
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    department: Optional[str] = None
    departments: Optional[List[str]] = None
    batch: Optional[str] = None
    section: Optional[str] = None
    assigned_classes: Optional[List[dict]] = None

    @field_validator("email")
    @classmethod
    def validate_email_domain(cls, v: Optional[EmailStr]) -> Optional[EmailStr]:
        return validate_psgitech_email(v)


class TutorClassRequest(BaseModel):
    department: str
    batch: str
    section: str
    assign_unassigned_students: bool = True


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
    departments: Optional[List[str]] = None
    registration_number: Optional[str] = None
    batch: Optional[str] = None
    section: Optional[str] = None
    tutor_name: Optional[str] = None
    tutor_email: Optional[str] = None
    tutor_id: Optional[str] = None
    tutor_username: Optional[str] = None
    assigned_classes: Optional[List[dict]] = None

    class Config:
        from_attributes = True

