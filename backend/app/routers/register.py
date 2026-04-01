from beanie import PydanticObjectId
from fastapi import APIRouter, HTTPException, status
from jose import JWTError, ExpiredSignatureError

from ..models.event import Event
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

    return {
        "event_name": event.name,
        "event_description": event.description,
        "custom_fields": payload.get("custom_fields", []),
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

    fields = dict(body.custom_fields)
    if body.registration_number:
        fields["Registration Number"] = body.registration_number
    fields["Email"] = body.email

    participant = Participant(
        event_id=event_id, club_id=event.club_id, email=body.email,
        registration_number=body.registration_number, cert_type="participant",
        fields=fields, source=ParticipantSource.QR, verified=False,
    )
    await participant.insert()

    return {"message": "Registration successful", "participant_id": str(participant.id)}
