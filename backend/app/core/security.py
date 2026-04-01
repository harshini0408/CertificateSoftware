from datetime import datetime, timedelta
from typing import Any, Dict, Optional
from uuid import uuid4

import bcrypt
from jose import JWTError, jwt

from ..config import get_settings

settings = get_settings()

# ── Password hashing (bcrypt rounds=12) ──────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── JWT helpers ──────────────────────────────────────────────────────────

def _build_token(data: Dict[str, Any], expires_delta: timedelta) -> str:
    payload = data.copy()
    jti = uuid4().hex
    payload.update({
        "exp": datetime.utcnow() + expires_delta,
        "iat": datetime.utcnow(),
        "jti": jti,
    })
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    return token


def create_access_token(
    user_id: str,
    role: str,
    club_id: Optional[str] = None,
    event_id: Optional[str] = None,
    department: Optional[str] = None,
) -> str:
    data: Dict[str, Any] = {"sub": user_id, "role": role, "type": "access"}
    if club_id:
        data["club_id"] = club_id
    if event_id:
        data["event_id"] = event_id
    if department:
        data["department"] = department
    return _build_token(data, timedelta(minutes=settings.access_token_expire_minutes))


def create_refresh_token(user_id: str) -> str:
    data = {"sub": user_id, "type": "refresh"}
    return _build_token(data, timedelta(days=settings.refresh_token_expire_days))


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT. Raises JWTError on failure."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])


def get_jti(token: str) -> str:
    """Extract the JTI claim without full validation (for blacklisting)."""
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    return payload["jti"]


def get_token_expiry(token: str) -> datetime:
    """Extract the expiry datetime from a token."""
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    return datetime.utcfromtimestamp(payload["exp"])
