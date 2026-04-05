from typing import Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    role: str
    name: str
    redirect_to: str
    club_id: Optional[str] = None
    event_id: Optional[str] = None
    department: Optional[str] = None


class MeResponse(BaseModel):
    """Returned by GET /auth/me — same shape as LoginResponse."""
    role: str
    name: str
    redirect_to: str
    club_id: Optional[str] = None
    event_id: Optional[str] = None
    department: Optional[str] = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class TokenResponse(BaseModel):
    message: str = "ok"
