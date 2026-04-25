from datetime import datetime, timedelta
import random
import re

from fastapi import APIRouter, Depends, HTTPException, Response, Cookie, status
from jose import JWTError

from ..core.dependencies import get_current_user
from ..core.security import decode_token, verify_password, hash_password
from ..models.user import User
from ..models.user import UserRole
from ..models.club import Club
from ..models.dept_asset import DeptAsset
from ..models.user_otp import OTPRequest
from ..schemas.auth import (
    LoginRequest,
    LoginResponse,
    MeResponse,
    PasswordChangeRequest,
    TokenResponse,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    VerifyOTPRequest,
    ResetPasswordRequest,
)
from ..services.email_service import send_otp_email
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


def _club_assets_configured(club: Club) -> bool:
    assets = getattr(club, "assets", None)
    if not assets:
        return False
    has_logo = bool(getattr(assets, "logo_path", None) or getattr(assets, "logo_url", None))
    has_signature = bool(getattr(assets, "signature_path", None) or getattr(assets, "signature_url", None))
    return has_logo and has_signature


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, response: Response):
    user = await authenticate_user(body.username, body.password)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")

    if user.role == UserRole.CLUB_COORDINATOR and not user.first_login_completed:
        user.first_login_completed = True
        await user.save()

    requires_profile_setup = False
    if user.role == UserRole.CLUB_COORDINATOR and user.club_id:
        club = await Club.get(user.club_id)
        if club:
            requires_profile_setup = not _club_assets_configured(club)
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
            requires_profile_setup = not _club_assets_configured(club)
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


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(body: ForgotPasswordRequest):
    identifier = (body.username or "").strip()
    if not identifier:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Username or Faculty ID is required")

    escaped = re.escape(identifier)
    user = await User.find_one({
        "$or": [
            {"username": {"$regex": f"^{escaped}$", "$options": "i"}},
            {"email": {"$regex": f"^{escaped}$", "$options": "i"}},
        ]
    })

    if not user or not user.email:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found or no registered email.")

    email = user.email.strip().lower()
    otp = f"{random.randint(1000, 9999)}"
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    await OTPRequest.find(OTPRequest.email == email).delete()

    await OTPRequest(
        email=email,
        otp_code=otp,
        expires_at=expires_at,
    ).insert()

    success = await send_otp_email(email, otp)
    if not success:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Failed to send OTP email")

    parts = email.split("@")
    name = parts[0]
    domain = parts[1]
    if len(name) > 2:
        masked_name = name[0] + "*" * (len(name) - 2) + name[-1]
    else:
        masked_name = name[0] + "*"
    masked_email = f"{masked_name}@{domain}"

    return ForgotPasswordResponse(
        message=f"OTP sent to your registered email: {masked_email}",
        email=email,
    )


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(body: VerifyOTPRequest):
    now = datetime.utcnow()
    otp_req = await OTPRequest.find_one(
        OTPRequest.email == body.email.strip().lower(),
        OTPRequest.otp_code == body.otp_code.strip(),
        OTPRequest.expires_at > now,
    )
    if not otp_req:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired OTP")

    otp_req.is_verified = True
    await otp_req.save()
    return TokenResponse(message="OTP verified successfully")


@router.post("/reset-password", response_model=TokenResponse)
async def reset_password(body: ResetPasswordRequest):
    now = datetime.utcnow()
    otp_req = await OTPRequest.find_one(
        OTPRequest.email == body.email.strip().lower(),
        OTPRequest.otp_code == body.otp_code.strip(),
        OTPRequest.expires_at > now,
        OTPRequest.is_verified == True,
    )
    if not otp_req:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "OTP verification required or session expired")

    user = await User.find_one(User.email == body.email.strip().lower())
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    user.password_hash = hash_password(body.new_password)
    await user.save()

    await otp_req.delete()
    return TokenResponse(message="Password reset successfully")
