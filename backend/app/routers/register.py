from beanie import PydanticObjectId
from fastapi import APIRouter, HTTPException, status
from jose import JWTError, ExpiredSignatureError

from ..models.event import Event
from ..models.club import Club
from ..models.participant import Participant, ParticipantSource
from ..schemas.participant import QRRegisterRequest
from ..services.qr_service import decode_qr_token

router = APIRouter(tags=["Register"])


@router.get("/register/{token}")
async def get_registration_form(token: str):
    try:
        payload = decode_qr_token(token)
    except ExpiredSignatureError:
        raise HTTPException(status.HTTP_410_GONE, "Registration link has expired")
    except JWTError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid registration link")

    event_id = payload.get("event_id")
    event = await Event.get(PydanticObjectId(event_id))
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    if not event.qr_config.is_active:
        raise HTTPException(status.HTTP_410_GONE, "Registration is no longer active")

    # Fetch club name for display
    club = await Club.get(event.club_id)
    club_name = club.name if club else "Unknown Club"

    # Build custom field defs for the frontend form
    custom_field_defs = [
        {"name": f"custom_{i}", "label": label, "required": True}
        for i, label in enumerate(payload.get("custom_fields", []))
    ]

    return {
        "event_name": event.name,
        "event_description": event.description,
        "event_date": event.event_date.isoformat() if event.event_date else None,
        "club_name": club_name,
        "expires_at": event.qr_config.expires_at.isoformat() if event.qr_config.expires_at else None,
        "custom_fields": custom_field_defs,
    }


@router.post("/register/{token}", status_code=201)
async def submit_registration(token: str, body: QRRegisterRequest):
    try:
        payload = decode_qr_token(token)
    except ExpiredSignatureError:
        raise HTTPException(status.HTTP_410_GONE, "Registration link has expired")
    except JWTError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid registration link")

    event_id = PydanticObjectId(payload["event_id"])
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    if not event.qr_config.is_active:
        raise HTTPException(status.HTTP_410_GONE, "Registration is no longer active")

    existing = await Participant.find_one(
        Participant.event_id == event_id, Participant.email == body.email)
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already registered for this event")

    fields = dict(body.custom_fields) if body.custom_fields else {}
    if body.registration_number:
        fields["Registration Number"] = body.registration_number
    fields["Email"] = body.email

    participant = Participant(
        event_id=event_id, club_id=event.club_id, email=body.email,
        registration_number=body.registration_number, cert_type="participant",
        fields=fields, source=ParticipantSource.QR, verified=False,
    )
    await participant.insert()

    # Increment event participant count
    event.participant_count = (event.participant_count or 0) + 1
    await event.set({"participant_count": event.participant_count})

    # Fetch club name for response
    club = await Club.get(event.club_id)

    return {
        "message": "Registration successful",
        "participant_id": str(participant.id),
        "participant_name": fields.get("Name", body.email.split("@")[0]),
    }
