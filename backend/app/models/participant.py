from datetime import datetime
from enum import Enum
from typing import Dict, Optional

from beanie import Document, PydanticObjectId
from pydantic import Field
from pymongo import IndexModel, ASCENDING


class ParticipantSource(str, Enum):
    EXCEL = "excel"
    MANUAL = "manual"


class Participant(Document):
    event_id: PydanticObjectId
    club_id: PydanticObjectId
    email: str
    registration_number: Optional[str] = None
    cert_type: str = "participant"
    fields: Dict[str, str] = Field(default_factory=dict)
    field_mapping: Dict[str, str] = Field(default_factory=dict)
    source: ParticipantSource = ParticipantSource.MANUAL
    verified: bool = True
    registered_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "participants"
        indexes = [
            IndexModel(
                [("event_id", ASCENDING), ("email", ASCENDING)],
                unique=True,
            ),
        ]
