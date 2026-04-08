from typing import List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status

from ..core.dependencies import require_event_access
from ..models.user import User
from ..models.event import Event
from ..models.participant import Participant, ParticipantSource
from ..schemas.participant import (
    FieldMappingRequest, ParticipantCreate, ParticipantResponse, UploadResponse,
)
from ..services.excel_service import parse_participants_excel

router = APIRouter(prefix="/clubs/{club_id}/events/{event_id}/participants", tags=["Participants"])


def _resp(p: Participant) -> ParticipantResponse:
    return ParticipantResponse(
        id=str(p.id), event_id=str(p.event_id), club_id=str(p.club_id),
        email=p.email, registration_number=p.registration_number,
        cert_type=p.cert_type, fields=p.fields, field_mapping=p.field_mapping,
        source=p.source.value, verified=p.verified, registered_at=p.registered_at,
    )


@router.get("", response_model=List[ParticipantResponse])
async def list_participants(
    club_id: PydanticObjectId, event_id: PydanticObjectId,
    source: Optional[str] = None, verified: Optional[bool] = None,
    cert_type: Optional[str] = None,
    _user: User = Depends(require_event_access),
):
    query = {"event_id": event_id, "club_id": club_id}
    if source:
        query["source"] = source
    if verified is not None:
        query["verified"] = verified
    if cert_type:
        query["cert_type"] = cert_type
    parts = await Participant.find(query).to_list()
    return [_resp(p) for p in parts]


@router.post("", response_model=ParticipantResponse, status_code=201)
async def create_participant(
    club_id: PydanticObjectId, event_id: PydanticObjectId,
    body: ParticipantCreate, _user: User = Depends(require_event_access),
):
    existing = await Participant.find_one(
        Participant.event_id == event_id, Participant.email == body.email)
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Participant already registered")

    p = Participant(
        event_id=event_id, club_id=club_id, email=body.email,
        registration_number=body.registration_number, cert_type=body.cert_type,
        fields={**body.fields, **({"Name": body.name} if body.name else {})},
        source=ParticipantSource.MANUAL, verified=True,
    )
    await p.insert()
    return _resp(p)


@router.delete("/{participant_id}")
async def delete_participant(
    club_id: PydanticObjectId, event_id: PydanticObjectId,
    participant_id: PydanticObjectId,
    _user: User = Depends(require_event_access),
):
    p = await Participant.get(participant_id)
    if not p or p.event_id != event_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Participant not found")
    await p.delete()
    return {"message": "Participant deleted"}


@router.patch("/{participant_id}/verify")
async def verify_participant(
    club_id: PydanticObjectId, event_id: PydanticObjectId,
    participant_id: PydanticObjectId,
    _user: User = Depends(require_event_access),
):
    p = await Participant.get(participant_id)
    if not p or p.event_id != event_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Participant not found")
    await p.set({"verified": True})
    return {"message": "Participant verified"}


@router.post("/upload", response_model=UploadResponse)
async def upload_participants(
    club_id: PydanticObjectId, event_id: PydanticObjectId,
    file: UploadFile = File(...),
    _user: User = Depends(require_event_access),
):
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    content = await file.read()
    rows, errors = parse_participants_excel(content)

    created = 0
    skipped = 0
    for row in rows:
        email = row.pop("_email", "").strip().lower()
        # Pop the internal cert_type key (not a real column)
        cert_type = row.pop("_cert_type", "participant")

        existing = await Participant.find_one(
            Participant.event_id == event_id, Participant.email == email)
        if existing:
            skipped += 1
            errors.append(f"Duplicate: {email}")
            continue
        p = Participant(
            event_id=event_id, club_id=club_id, email=email,
            registration_number=(
                row.get("Registration Number")
                or row.get("Reg No")
                or row.get("Roll No")
                or ""
            ),
            cert_type=cert_type, fields=row,
            source=ParticipantSource.EXCEL, verified=True,
        )
        await p.insert()
        created += 1

    return UploadResponse(created=created, skipped=skipped, errors=errors)


@router.post("/mapping")
async def apply_field_mapping(
    club_id: PydanticObjectId, event_id: PydanticObjectId,
    body: FieldMappingRequest,
    _user: User = Depends(require_event_access),
):
    participants = await Participant.find(
        Participant.event_id == event_id, Participant.club_id == club_id
    ).to_list()

    count = 0
    for p in participants:
        await p.set({"field_mapping": body.mapping})
        count += 1

    return {"message": f"Mapping applied to {count} participants"}
