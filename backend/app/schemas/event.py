from datetime import datetime
from typing import Any, Dict, List, Optional, Literal

from pydantic import BaseModel, Field, field_validator


class EventCreate(BaseModel):
    name: str
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    event_time: Optional[str] = None
    session: Optional[str] = None
    slot: Optional[str] = None
    venue: Optional[str] = None
    category: Optional[str] = None
    academic_year: Optional[str] = None
    academic_years: List[str] = Field(default_factory=list)
    max_participants: Optional[int] = Field(None, ge=0)
    max_teams: Optional[int] = Field(None, ge=0)
    team_size: Optional[int] = Field(None, ge=2)
    volunteers_required: Optional[int] = 0
    is_team_event: bool = False
    activity_type: Literal["individual", "group"] = "individual"
    min_team_size: Optional[int] = Field(2, ge=2)
    max_team_size: Optional[int] = Field(4, ge=2)
    template_map: Dict[str, Optional[str]] = Field(default_factory=dict)
    is_published: bool = False

    @field_validator("volunteers_required", mode="before")
    @classmethod
    def coerce_volunteers_required(cls, v: Any) -> int:
        if v is None or v == "" or (isinstance(v, float) and v != v):
            return 0
        try:
            return max(0, int(v))
        except (ValueError, TypeError):
            return 0

    @field_validator("max_participants", "max_teams", "team_size", "min_team_size", "max_team_size", mode="before")
    @classmethod
    def coerce_optional_int(cls, v: Any) -> Optional[int]:
        if v is None or v == "" or (isinstance(v, float) and v != v):
            return None
        try:
            return int(v)
        except (ValueError, TypeError):
            return None


class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    event_time: Optional[str] = None
    session: Optional[str] = None
    slot: Optional[str] = None
    venue: Optional[str] = None
    category: Optional[str] = None
    academic_year: Optional[str] = None
    academic_years: Optional[List[str]] = None
    max_participants: Optional[int] = Field(None, ge=0)
    max_teams: Optional[int] = Field(None, ge=0)
    team_size: Optional[int] = Field(None, ge=2)
    volunteers_required: Optional[int] = None
    is_team_event: Optional[bool] = None
    activity_type: Optional[Literal["individual", "group"]] = None
    min_team_size: Optional[int] = Field(None, ge=2)
    max_team_size: Optional[int] = Field(None, ge=2)
    qr_generations_count: Optional[int] = None
    registration_stopped: Optional[bool] = None
    status: Optional[str] = None
    template_map: Optional[Dict[str, Optional[str]]] = None
    mapping_confirmed: Optional[bool] = None
    is_published: Optional[bool] = None

    @field_validator("volunteers_required", mode="before")
    @classmethod
    def coerce_update_volunteers_required(cls, v: Any) -> Optional[int]:
        if v is None or v == "" or (isinstance(v, float) and v != v):
            return None
        try:
            return max(0, int(v))
        except (ValueError, TypeError):
            return None

    @field_validator("max_participants", "max_teams", "team_size", "min_team_size", "max_team_size", mode="before")
    @classmethod
    def coerce_update_optional_int(cls, v: Any) -> Optional[int]:
        if v is None or v == "" or (isinstance(v, float) and v != v):
            return None
        try:
            return int(v)
        except (ValueError, TypeError):
            return None


class EventResponse(BaseModel):
    id: str
    club_id: str
    name: str
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    event_time: Optional[str] = None
    session: Optional[str] = None
    slot: Optional[str] = None
    venue: Optional[str] = None
    category: Optional[str] = None
    academic_year: Optional[str] = None
    academic_years: List[str] = Field(default_factory=list)
    status: str
    activity_type: str = "individual"
    min_team_size: Optional[int] = 2
    max_team_size: Optional[int] = 4
    template_map: Dict[str, Optional[str]] = Field(default_factory=dict)
    assets: dict = Field(default_factory=dict)
    mapping_confirmed: bool = False
    max_participants: Optional[int] = None
    max_teams: Optional[int] = None
    team_size: Optional[int] = None
    teams_count: int = 0
    participant_count: int = 0
    volunteers_required: int = 0
    volunteers_registered: int = 0
    is_team_event: bool = False
    min_team_size: Optional[int] = 2
    max_team_size: Optional[int] = 4
    max_teams: Optional[int] = None
    team_count: int = 0
    cert_count: int = 0
    qr_generations_count: int = 0
    registration_stopped: bool = False
    created_at: datetime
    is_published: bool = False
    poster_url: Optional[str] = None
    report_url: Optional[str] = None
    report_filename: Optional[str] = None
    report_status: Optional[str] = "not_submitted"
    report_rejection_reason: Optional[str] = None
    report_uploaded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    event_count: int = 0
    total_certs_issued: int = 0
    pending_emails: int = 0
    recent_activity: List[dict] = Field(default_factory=list)


class DeptCertificateSendRequest(BaseModel):
    allocateCredits: bool = False
    manualPointsPerCert: Optional[int] = None


class VolunteerStatusUpdate(BaseModel):
    status: Literal["accepted", "rejected", "pending"]


class VolunteerCountUpdate(BaseModel):
    volunteers_required: int = Field(..., ge=0)


class VolunteerRequestResponse(BaseModel):
    id: str
    participant_id: Optional[str] = None
    registration_id: Optional[str] = None
    student_name: str
    student_email: str
    registration_number: Optional[str] = None
    department: Optional[str] = None
    status: str = "pending"
    verified: bool = False
    registered_at: datetime
