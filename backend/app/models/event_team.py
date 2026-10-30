from datetime import datetime
from typing import List, Optional

from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel


class EventTeam(Document):
    event_id: Indexed(PydanticObjectId)  # type: ignore[valid-type]
    creator_student_id: PydanticObjectId
    creator_name: str
    creator_email: str
    team_size: int
    invitee_ids: List[PydanticObjectId] = Field(default_factory=list)
    status: str = "pending"  # pending, registering, registered, declined, cancelled
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "event_teams"


class EventTeamClaim(Document):
    event_id: PydanticObjectId
    student_id: PydanticObjectId
    team_id: Optional[PydanticObjectId] = None
    kind: str = "team"  # team or individual
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "event_team_claims"
        indexes = [
            IndexModel(
                [("event_id", ASCENDING), ("student_id", ASCENDING)],
                unique=True,
            ),
        ]


class EventTeamInvitation(Document):
    event_id: Indexed(PydanticObjectId)  # type: ignore[valid-type]
    team_id: Indexed(PydanticObjectId)  # type: ignore[valid-type]
    inviter_student_id: PydanticObjectId
    inviter_name: str
    inviter_email: str
    invitee_student_id: PydanticObjectId
    invitee_name: str
    invitee_email: str
    status: str = "pending"  # pending, accepted, declined, cancelled, removed, unavailable
    created_at: datetime = Field(default_factory=datetime.utcnow)
    responded_at: Optional[datetime] = None

    class Settings:
        name = "event_team_invitations"
