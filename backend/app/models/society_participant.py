from datetime import datetime
from typing import Any, Dict, Optional
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field
from .participant import ParticipantSource


class SocietyParticipant(Document):
    event_id: Indexed(PydanticObjectId)  # type: ignore[valid-type]
    society_id: PydanticObjectId
    club_id: Optional[PydanticObjectId] = None  # for backward compatibility
    email: Indexed(str)  # type: ignore[valid-type]
    registration_number: Optional[str] = None
    cert_type: Optional[str] = "participant"

    fields: Dict[str, Any] = Field(default_factory=dict)
    field_mapping: Dict[str, Any] = Field(default_factory=dict)
    source: ParticipantSource = ParticipantSource.MANUAL

    verified: bool = False
    manually_verified: bool = False
    status: Optional[str] = None

    team_id: Optional[str] = None
    team_name: Optional[str] = None
    team_role: Optional[str] = None

    registered_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "society_participants"
