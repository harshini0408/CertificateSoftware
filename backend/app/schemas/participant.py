from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class ParticipantCreate(BaseModel):
    email: str
    registration_number: Optional[str] = None
    cert_type: str = "participant"
    fields: Dict[str, str] = Field(default_factory=dict)


class ParticipantResponse(BaseModel):
    id: str
    event_id: str
    club_id: str
    email: str
    registration_number: Optional[str] = None
    cert_type: str
    fields: Dict[str, str] = Field(default_factory=dict)
    field_mapping: Dict[str, str] = Field(default_factory=dict)
    source: str
    verified: bool
    registered_at: datetime

    class Config:
        from_attributes = True


class FieldMappingRequest(BaseModel):
    mapping: Dict[str, str]


class UploadResponse(BaseModel):
    created_count: int = 0
    errors: List[str] = Field(default_factory=list)


class QRRegisterRequest(BaseModel):
    email: str
    registration_number: Optional[str] = None
    custom_fields: Dict[str, str] = Field(default_factory=dict)
