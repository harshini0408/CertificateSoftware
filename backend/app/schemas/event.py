from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class EventCreate(BaseModel):
    name: str
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    template_map: Dict[str, Optional[str]] = Field(default_factory=dict)


class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    status: Optional[str] = None
    template_map: Optional[Dict[str, Optional[str]]] = None
    mapping_confirmed: Optional[bool] = None


class QRGenerateRequest(BaseModel):
    custom_fields: List[str] = Field(default_factory=list)
    duration_hours: int = Field(default=24, ge=1, le=168)

    @field_validator("custom_fields")
    @classmethod
    def validate_max_fields(cls, v):
        if len(v) > 5:
            raise ValueError("Maximum 5 custom fields allowed")
        return v


class QRGenerateResponse(BaseModel):
    token: str
    qr_image_base64: str
    expires_at: datetime


class EventResponse(BaseModel):
    id: str
    club_id: str
    name: str
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    status: str
    template_map: Dict[str, Optional[str]] = Field(default_factory=dict)
    qr_config: dict = Field(default_factory=dict)
    assets: dict = Field(default_factory=dict)
    mapping_confirmed: bool = False
    participant_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class DashboardResponse(BaseModel):
    event_count: int = 0
    total_certs_issued: int = 0
    pending_emails: int = 0
    recent_activity: List[dict] = Field(default_factory=list)
