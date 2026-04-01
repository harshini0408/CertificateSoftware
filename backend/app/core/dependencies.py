from typing import List

from beanie import PydanticObjectId
from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError

from ..models.user import User, UserRole
from ..models.token_blacklist import TokenBlacklist
from ..models.event import Event
from .security import decode_token


# ── Current user from httpOnly cookie ────────────────────────────────────

async def get_current_user(
    access_token: str = Cookie(default=None),
) -> User:
    """Decode JWT from httpOnly cookie, check blacklist, return User doc."""
    if not access_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")

    try:
        payload = decode_token(access_token)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")

    jti = payload.get("jti")
    if jti and await TokenBlacklist.find_one(TokenBlacklist.token_jti == jti):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token has been revoked")

    user = await User.get(PydanticObjectId(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

    return user


# ── Role gate ────────────────────────────────────────────────────────────

def require_role(*roles: UserRole):
    """Dependency factory: 403 if authenticated user's role is not in *roles*."""
    async def _checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return current_user
    return _checker


# ── Club access gate ─────────────────────────────────────────────────────

async def require_club_access(
    club_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the user has permission to operate on *club_id*."""
    if current_user.role == UserRole.SUPER_ADMIN:
        return current_user

    if current_user.role == UserRole.CLUB_COORDINATOR:
        if current_user.club_id != club_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this club")
        return current_user

    if current_user.role == UserRole.GUEST:
        if current_user.club_id != club_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this club")
        return current_user

    raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")


# ── Event access gate ────────────────────────────────────────────────────

async def require_event_access(
    club_id: PydanticObjectId,
    event_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the user has permission to operate on *event_id*."""
    if current_user.role == UserRole.SUPER_ADMIN:
        return current_user

    if current_user.role == UserRole.GUEST:
        if current_user.club_id != club_id or current_user.event_id != event_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this event")
        return current_user

    if current_user.role == UserRole.CLUB_COORDINATOR:
        if current_user.club_id != club_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No access to this event")
        event = await Event.get(event_id)
        if not event or event.club_id != club_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found in this club")
        return current_user

    raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
