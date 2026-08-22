from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


def validate_psgitech_email(v: str) -> str:
    val = str(v).strip().lower()
    if not val.endswith("@psgitech.ac.in"):
        raise ValueError("Only @psgitech.ac.in email addresses are allowed.")
    return val


class ParticipantCreate(BaseModel):
    name: str = ""
    email: str
    registration_number: Optional[str] = None
    cert_type: str = "participant"
    fields: Dict[str, str] = Field(default_factory=dict)

    @field_validator("email")
    @classmethod
    def validate_email_domain(cls, v: str) -> str:
        return validate_psgitech_email(v)


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
    created: int = 0          # number of participants successfully imported
    skipped: int = 0          # number skipped (duplicates)
    errors: List[str] = Field(default_factory=list)
