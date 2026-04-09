from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, status
from jose import JWTError

from ..core.dependencies import get_current_user
from ..core.security import decode_token, verify_password, hash_password
from ..models.user import User
from ..models.user import UserRole
from ..models.club import Club
from ..models.dept_asset import DeptAsset
from ..schemas.auth import LoginRequest, LoginResponse, MeResponse, PasswordChangeRequest, TokenResponse
from ..services.auth_service import (
    authenticate_user,
    blacklist_token,
    build_redirect,
    build_tokens,
    is_token_blacklisted,
)
from ..config import get_settings

router = APIRouter(prefix="/auth", tags=["Auth"])
settings = get_settings()

_COOKIE_DEFAULTS = dict(
    httponly=True,
    samesite="lax",
    secure=settings.is_production,
    path="/",
)


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, response: Response):
    user = await authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")

    if user.role == UserRole.CLUB_COORDINATOR and not user.first_login_completed:
        if (body.username or "").strip().lower() != user.username.lower():
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "First login must use faculty ID as username",
            )

        provided_email = (body.email or "").strip().lower()
        if not provided_email:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "First login requires faculty Gmail",
            )
        if provided_email != user.email.lower():
            raise HTTPException(
                status.HTTP_401_UNAUTHORIZED,
                "Faculty Gmail does not match this account",
            )

        user.first_login_completed = True
        await user.save()

    requires_profile_setup = False
    if user.role == UserRole.CLUB_COORDINATOR and user.club_id:
        club = await Club.get(user.club_id)
        if club:
            assets = getattr(club, "assets", None)
            requires_profile_setup = not bool(
                assets and assets.logo_path and assets.signature_path
            )
    if user.role == UserRole.DEPT_COORDINATOR:
        department = (user.department or "General").strip() or "General"
        dept_assets = await DeptAsset.find_one(DeptAsset.department == department)
        requires_profile_setup = not bool(
            dept_assets and dept_assets.logo_path and dept_assets.signature1_path
        )

    access, refresh = build_tokens(user)
    response.set_cookie("access_token", access, max_age=settings.access_token_expire_minutes * 60, **_COOKIE_DEFAULTS)
    response.set_cookie("refresh_token", refresh, max_age=settings.refresh_token_expire_days * 86400, **_COOKIE_DEFAULTS)

    return LoginResponse(
        role=user.role.value,
        name=user.name,
        redirect_to=build_redirect(user),
        club_id=str(user.club_id) if user.club_id else None,
        event_id=str(user.event_id) if user.event_id else None,
        department=user.department,
        requires_profile_setup=requires_profile_setup,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(response: Response, refresh_token: str = Cookie(default=None)):
    if not refresh_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No refresh token")

    try:
        payload = decode_token(refresh_token)
    except JWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token type")

    if await is_token_blacklisted(refresh_token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token has been revoked")

    await blacklist_token(refresh_token)

    from beanie import PydanticObjectId
    user = await User.get(PydanticObjectId(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")

    access, new_refresh = build_tokens(user)
    response.set_cookie("access_token", access, max_age=settings.access_token_expire_minutes * 60, **_COOKIE_DEFAULTS)
    response.set_cookie("refresh_token", new_refresh, max_age=settings.refresh_token_expire_days * 86400, **_COOKIE_DEFAULTS)

    return TokenResponse(message="Tokens refreshed")


@router.post("/logout", response_model=TokenResponse)
async def logout(response: Response, refresh_token: str = Cookie(default=None)):
    if refresh_token:
        try:
            await blacklist_token(refresh_token)
        except Exception:
            pass

    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return TokenResponse(message="Logged out")


@router.patch("/password", response_model=TokenResponse)
async def change_password(
    body: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password is incorrect")

    current_user.password_hash = hash_password(body.new_password)
    await current_user.save()
    return TokenResponse(message="Password updated")


@router.get("/me", response_model=MeResponse)
async def me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile from the access-token cookie.

    Called by the frontend useMe() hook to hydrate the auth store on page reload
    when sessionStorage has been cleared but the httpOnly cookie is still valid.
    """
    from ..services.auth_service import build_redirect
    requires_profile_setup = False
    if current_user.role == UserRole.CLUB_COORDINATOR and current_user.club_id:
        club = await Club.get(current_user.club_id)
        if club:
            assets = getattr(club, "assets", None)
            requires_profile_setup = not bool(
                assets and assets.logo_path and assets.signature_path
            )
    if current_user.role == UserRole.DEPT_COORDINATOR:
        department = (current_user.department or "General").strip() or "General"
        dept_assets = await DeptAsset.find_one(DeptAsset.department == department)
        requires_profile_setup = not bool(
            dept_assets and dept_assets.logo_path and dept_assets.signature1_path
        )

    return MeResponse(
        role=current_user.role.value,
        name=current_user.name,
        redirect_to=build_redirect(current_user),
        club_id=str(current_user.club_id) if current_user.club_id else None,
        event_id=str(current_user.event_id) if current_user.event_id else None,
        department=current_user.department,
        requires_profile_setup=requires_profile_setup,
    )
