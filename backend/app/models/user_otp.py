from datetime import datetime

from beanie import Document, Indexed
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class OTPRequest(Document):
    """Stores temporary 4-digit OTPs for password reset requests."""

    email: Indexed(str)  # type: ignore[valid-type]
    otp_code: str
    expires_at: datetime
    is_verified: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "otp_requests"
        indexes = [
            # Expired OTPs are auto-deleted by MongoDB TTL monitor.
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
