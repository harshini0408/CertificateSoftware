from typing import Optional

from pydantic import BaseModel, Field, field_validator


def validate_psgitech_email(v: str) -> str:
    val = str(v).strip().lower()
    if not val.endswith("@psgitech.ac.in"):
        raise ValueError("Only @psgitech.ac.in email addresses are allowed.")
    return val


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
    otp_code: str = Field(..., min_length=4, max_length=4)


class PasswordOtpVerifyRequest(BaseModel):
    otp_code: str = Field(..., min_length=4, max_length=4)


class DepartmentPasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    otp_code: str = Field(..., min_length=4, max_length=4)


class DepartmentPasswordVerifyRequest(BaseModel):
    otp_code: str = Field(..., min_length=4, max_length=4)


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

    @field_validator("email")
    @classmethod
    def validate_email_domain(cls, v: str) -> str:
        return validate_psgitech_email(v)


class ResetPasswordRequest(BaseModel):
    email: str
    otp_code: str = Field(..., min_length=4, max_length=4)
    new_password: str = Field(..., min_length=4)

    @field_validator("email")
    @classmethod
    def validate_email_domain(cls, v: str) -> str:
        return validate_psgitech_email(v)
