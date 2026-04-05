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


class EventResponse(BaseModel):
    id: str
    club_id: str
    name: str
    description: Optional[str] = None
    event_date: Optional[datetime] = None
    status: str
    template_map: Dict[str, Optional[str]] = Field(default_factory=dict)
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
