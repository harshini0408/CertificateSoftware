from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    slug: str = Field(
        ...,
        min_length=2,
        max_length=20,
        pattern=r"^[A-Z0-9]+$",
        description="Uppercase letters and digits only.",
    )


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    slug: Optional[str] = Field(None, min_length=2, max_length=20, pattern=r"^[A-Z0-9]+$")
    is_active: Optional[bool] = None


class DepartmentResponse(BaseModel):
    id: str
    name: str
    slug: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
