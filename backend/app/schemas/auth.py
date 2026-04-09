from typing import Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    email: Optional[str] = None
    password: str


class LoginResponse(BaseModel):
    role: str
    name: str
    redirect_to: str
    club_id: Optional[str] = None
    event_id: Optional[str] = None
    department: Optional[str] = None
    requires_profile_setup: bool = False


class MeResponse(BaseModel):
    """Returned by GET /auth/me — same shape as LoginResponse."""
    role: str
    name: str
    redirect_to: str
    club_id: Optional[str] = None
    event_id: Optional[str] = None
    department: Optional[str] = None
    requires_profile_setup: bool = False


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class TokenResponse(BaseModel):
    message: str = "ok"


class ForgotPasswordRequest(BaseModel):
    username: str


class ForgotPasswordResponse(BaseModel):
    message: str
    email: str


class VerifyOTPRequest(BaseModel):
    email: str
    otp_code: str = Field(..., min_length=4, max_length=4)


class ResetPasswordRequest(BaseModel):
    email: str
    otp_code: str = Field(..., min_length=4, max_length=4)
    new_password: str = Field(..., min_length=4)
