from typing import Optional
import re

from beanie import PydanticObjectId

from ..core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_jti,
    get_token_expiry,
    hash_password,
    verify_password,
)
from ..models.token_blacklist import TokenBlacklist
from ..models.user import User, UserRole


async def authenticate_user(username: str, password: str) -> Optional[User]:
    """Look up user by username/email and verify password. Returns User or None."""
    identifier = (username or "").strip()
    if not identifier or not password:
        return None
    escaped = re.escape(identifier)

    # Allow login via username or email (case-insensitive) for better UX.
    user = await User.find_one({
        "$or": [
            {"username": {"$regex": f"^{escaped}$", "$options": "i"}},
            {"email": {"$regex": f"^{escaped}$", "$options": "i"}},
        ]
    })
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def build_tokens(user: User) -> tuple[str, str]:
    """Create an (access_token, refresh_token) pair for the given user."""
    access = create_access_token(
        user_id=str(user.id),
        role=user.role.value,
        club_id=str(user.club_id) if user.club_id else None,
        event_id=str(user.event_id) if user.event_id else None,
        department=user.department,
    )
    refresh = create_refresh_token(user_id=str(user.id))
    return access, refresh


def build_redirect(user: User) -> str:
    """Return the frontend redirect path based on user role."""
    if user.role == UserRole.SUPER_ADMIN:
        return "/admin"
    if user.role == UserRole.CLUB_COORDINATOR:
        return f"/club/{user.club_id}"
    if user.role == UserRole.DEPT_COORDINATOR:
        return "/dept"
    if user.role == UserRole.TUTOR:
        return "/tutor"
    if user.role == UserRole.STUDENT:
        return "/student"
    if user.role == UserRole.GUEST:
        return f"/club/{user.club_id}/events/{user.event_id}"
    return "/"


async def blacklist_token(token: str) -> None:
    """Add a token's JTI to the blacklist collection."""
    jti = get_jti(token)
    exp = get_token_expiry(token)
    existing = await TokenBlacklist.find_one(TokenBlacklist.token_jti == jti)
    if not existing:
        await TokenBlacklist(token_jti=jti, expires_at=exp).insert()


async def is_token_blacklisted(token: str) -> bool:
    """Check whether a token's JTI has been blacklisted."""
    jti = get_jti(token)
    return await TokenBlacklist.find_one(TokenBlacklist.token_jti == jti) is not None
