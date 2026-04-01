from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str
    name: str
    email: str
    password: str = Field(..., min_length=8)
    role: str
    club_id: Optional[str] = None
    event_id: Optional[str] = None
    department: Optional[str] = None
    registration_number: Optional[str] = None
    batch: Optional[str] = None
    section: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: str
    username: str
    name: str
    email: str
    role: str
    is_active: bool
    club_id: Optional[str] = None
    event_id: Optional[str] = None
    department: Optional[str] = None
    registration_number: Optional[str] = None
    batch: Optional[str] = None
    section: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
