from datetime import datetime
from typing import Dict, List, Optional, Literal

from pydantic import BaseModel, Field, field_validator


class EventCreate(BaseModel):
    name: str
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    event_time: Optional[str] = None
    venue: Optional[str] = None
    category: Optional[str] = None
    academic_year: Optional[str] = None
    academic_years: List[str] = Field(default_factory=list)
    volunteers_required: int = 0
    template_map: Dict[str, Optional[str]] = Field(default_factory=dict)
    is_published: bool = False


class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    event_time: Optional[str] = None
    venue: Optional[str] = None
    category: Optional[str] = None
    academic_year: Optional[str] = None
    academic_years: Optional[List[str]] = None
    volunteers_required: Optional[int] = None
    qr_generations_count: Optional[int] = None
    registration_stopped: Optional[bool] = None
    status: Optional[str] = None
    template_map: Optional[Dict[str, Optional[str]]] = None
    mapping_confirmed: Optional[bool] = None
    is_published: Optional[bool] = None


class EventResponse(BaseModel):
    id: str
    club_id: str
    name: str
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    event_time: Optional[str] = None
    venue: Optional[str] = None
    category: Optional[str] = None
    academic_year: Optional[str] = None
    academic_years: List[str] = Field(default_factory=list)
    status: str
    template_map: Dict[str, Optional[str]] = Field(default_factory=dict)
    assets: dict = Field(default_factory=dict)
    mapping_confirmed: bool = False
    participant_count: int = 0
    volunteers_required: int = 0
    volunteers_registered: int = 0
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
