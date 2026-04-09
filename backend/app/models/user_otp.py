from datetime import datetime, timedelta
from typing import Optional

from beanie import Document, Indexed
from pydantic import Field


from pymongo import IndexModel, ASCENDING

class OTPRequest(Document):
    """Stores temporary 4-digit OTPs for password reset requests."""

    email: Indexed(str)  # type: ignore[valid-type]
    otp_code: str
    expires_at: datetime
    is_verified: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "otp_requests"
        # TTL index to automatically delete expired OTPs after 10 minutes
        indexes = [
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0)
        ]
