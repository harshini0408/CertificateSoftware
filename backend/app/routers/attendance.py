"""
Attendance router — QR-based event attendance for students.

Club flow:
  POST /clubs/{club_id}/events/{event_id}/generate-qr
  → Returns a signed JSON payload string the frontend encodes into a QR image.
  → The nonce is stored server-side for 20 s (hard TTL = 25 s for clock skew).

Student flow:
  POST /student/events/{event_id}/validate-qr   → validates QR scanner scan (must be < 20s), generates secure session token
  GET /student/events/{event_id}/attendance/{token} → fetches event details if token is valid (no timer)
  POST /student/events/{event_id}/attendance/{token}/submit → commits attendance and feedback, marks token as used (no timer)
"""

import json
import time
import uuid
import threading
from datetime import datetime
from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..core.dependencies import get_current_user, require_event_access
from ..models.user import User, UserRole
from ..models.event import Event
from ..models.event_registration import EventRegistration
from ..models.attendance import Attendance
from ..models.attendance_session import AttendanceSession

# ── In-memory nonce store ────────────────────────────────────────────────────
_NONCE_LOCK = threading.Lock()
_ACTIVE_NONCES: dict[str, float] = {}

QR_VALIDITY_SECONDS = 20          # Must-scan-within window is exactly 20 seconds
NONCE_TTL_SECONDS   = 25          # Hard backend clean limit


def _cleanup_expired_nonces() -> None:
    cutoff = time.time() - NONCE_TTL_SECONDS
    with _NONCE_LOCK:
        expired = [n for n, ts in _ACTIVE_NONCES.items() if ts < cutoff]
        for n in expired:
            del _ACTIVE_NONCES[n]


def _store_nonce(nonce: str, issued_at: float) -> None:
    _cleanup_expired_nonces()
    with _NONCE_LOCK:
        _ACTIVE_NONCES[nonce] = issued_at


def _consume_nonce(nonce: str) -> Optional[float]:
    _cleanup_expired_nonces()
    with _NONCE_LOCK:
        return _ACTIVE_NONCES.pop(nonce, None)


# ── Schemas ──────────────────────────────────────────────────────────────────

class GenerateQRResponse(BaseModel):
    payload: str
    issued_at: float
    expires_in: int


class ValidateQRRequest(BaseModel):
    qr_payload: str


class ValidateQRResponse(BaseModel):
    valid: bool
    event_id: str
    token: str


class AttendanceSessionInfoResponse(BaseModel):
    event_id: str
    event_name: str
    club_name: Optional[str] = None
    event_date: Optional[str] = None
    venue: Optional[str] = None
    student_name: str
    student_email: str


class SubmitAttendanceRequest(BaseModel):
    feedback: Optional[str] = None


class SubmitAttendanceResponse(BaseModel):
    success: bool
    message: str
    event_name: str
    marked_at: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_payload(qr_payload: str) -> dict:
    try:
        return json.loads(qr_payload)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid QR code format.")


def _validate_payload_fields(data: dict) -> None:
    for field in ("event_id", "club_id", "nonce", "issued_at"):
        if field not in data:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Missing QR metadata: {field}")


def _check_not_expired(issued_at: float) -> None:
    if time.time() - issued_at > QR_VALIDITY_SECONDS:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "QR code has expired. Please scan a newly generated QR code."
        )


async def _require_student(user: User) -> User:
    if user.role != UserRole.STUDENT:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Student access only.")
    return user


# ── Routers ───────────────────────────────────────────────────────────────────

club_attendance_router = APIRouter(
    prefix="/clubs/{club_id}/events/{event_id}",
    tags=["Attendance"],
)

student_attendance_router = APIRouter(
    prefix="/student/events/{event_id}",
    tags=["Attendance"],
)


# ══ 1. GENERATE QR (Club coordinator) ════════════════════════════════════════

@club_attendance_router.post("/generate-qr", response_model=GenerateQRResponse)
async def generate_attendance_qr(
    club_id: PydanticObjectId,
    event_id: PydanticObjectId,
    current_user: User = Depends(require_event_access),
):
    event = await Event.get(event_id)
    if not event or event.club_id != club_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found.")

    nonce = str(uuid.uuid4())
    issued_at = time.time()

    _store_nonce(nonce, issued_at)

    payload_dict = {
        "event_id": str(event_id),
        "club_id": str(club_id),
        "nonce": nonce,
        "issued_at": issued_at,
    }

    return GenerateQRResponse(
        payload=json.dumps(payload_dict),
        issued_at=issued_at,
        expires_in=QR_VALIDITY_SECONDS,
    )


# ══ 2. VALIDATE QR SCAN & GENERATE SESSION TOKEN (Student) ═════════════════════

@student_attendance_router.post("/validate-qr", response_model=ValidateQRResponse)
async def validate_attendance_qr(
    event_id: PydanticObjectId,
    body: ValidateQRRequest,
    current_user: User = Depends(get_current_user),
):
    await _require_student(current_user)

    data = _parse_payload(body.qr_payload)
    _validate_payload_fields(data)

    # 1. Match event ID
    if data["event_id"] != str(event_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This QR code belongs to a different event.")

    # 2. Expiry check using client-embedded time
    _check_not_expired(float(data["issued_at"]))

    # 3. Consume nonce on the server (ensuring one-time scanning per generation)
    stored_ts = _consume_nonce(data["nonce"])
    if stored_ts is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "QR code has already been scanned or expired.")

    # 4. Expiry check using server-stored time
    if time.time() - stored_ts > QR_VALIDITY_SECONDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "QR code has expired.")

    # 5. Registration validation
    registration = await EventRegistration.find_one(
        EventRegistration.event_id == event_id,
        EventRegistration.student_id == current_user.id,
    )
    if not registration:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not registered for this event.")

    # 6. Duplication check
    already = await Attendance.find_one(
        Attendance.event_id == event_id,
        Attendance.student_id == current_user.id,
    )
    if already:
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already marked attendance for this event.")

    # Generate a secure AttendanceSession token in the database
    token = str(uuid.uuid4())
    session = AttendanceSession(
        token=token,
        event_id=event_id,
        student_id=current_user.id,
    )
    await session.insert()

    return ValidateQRResponse(
        valid=True,
        event_id=str(event_id),
        token=token,
    )


# ══ 3. GET SESSION INFO (Student loads details on their unique URL) ═══════════

@student_attendance_router.get("/attendance/{token}", response_model=AttendanceSessionInfoResponse)
async def get_attendance_session_info(
    event_id: PydanticObjectId,
    token: str,
    current_user: User = Depends(get_current_user),
):
    await _require_student(current_user)

    # 1. Fetch the session
    session = await AttendanceSession.find_one(AttendanceSession.token == token)
    if not session or session.event_id != event_id or session.student_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attendance session not found or invalid.")

    # 2. Check if already used
    if session.used:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This attendance session has already been used.")

    # 3. Check duplicate attendance
    already = await Attendance.find_one(
        Attendance.event_id == event_id,
        Attendance.student_id == current_user.id,
    )
    if already:
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already marked attendance for this event.")

    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found.")

    from ..models.club import Club
    club = await Club.get(event.club_id)

    return AttendanceSessionInfoResponse(
        event_id=str(event_id),
        event_name=event.name,
        club_name=club.name if club else None,
        event_date=str(event.event_date.date()) if event.event_date else None,
        venue=event.venue,
        student_name=current_user.name,
        student_email=current_user.email,
    )


# ══ 4. SUBMIT ATTENDANCE (Student commits feedback with NO time limit) ════════

@student_attendance_router.post("/attendance/{token}/submit", response_model=SubmitAttendanceResponse)
async def submit_attendance(
    event_id: PydanticObjectId,
    token: str,
    body: SubmitAttendanceRequest,
    current_user: User = Depends(get_current_user),
):
    await _require_student(current_user)

    # 1. Retrieve and validate the session
    session = await AttendanceSession.find_one(AttendanceSession.token == token)
    if not session or session.event_id != event_id or session.student_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attendance session not found or invalid.")

    if session.used:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This attendance session has already been used.")

    # 2. Duplicate check
    already = await Attendance.find_one(
        Attendance.event_id == event_id,
        Attendance.student_id == current_user.id,
    )
    if already:
        raise HTTPException(status.HTTP_409_CONFLICT, "You have already marked attendance for this event.")

    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found.")

    # Mark session as used
    await session.set({AttendanceSession.used: True})

    # Create the permanent attendance record
    now = datetime.utcnow()
    attendance = Attendance(
        event_id=event_id,
        club_id=event.club_id,
        student_id=current_user.id,
        student_email=current_user.email,
        student_name=current_user.name,
        registration_number=getattr(current_user, "registration_number", None),
        feedback=body.feedback or None,
        marked_at=now,
    )
    await attendance.insert()

    return SubmitAttendanceResponse(
        success=True,
        message="Attendance recorded successfully!",
        event_name=event.name,
        marked_at=now.strftime("%d %b %Y, %I:%M %p") + " UTC",
    )
