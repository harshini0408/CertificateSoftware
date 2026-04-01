from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CreditRuleSchema(BaseModel):
    cert_type: str
    points: int


class CreditRulesUpdateRequest(BaseModel):
    rules: List[CreditRuleSchema]


class CreditRuleResponse(BaseModel):
    id: str
    cert_type: str
    points: int
    updated_by: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class CreditHistoryEntrySchema(BaseModel):
    cert_number: str
    event_name: str
    club_name: str
    cert_type: str
    points_awarded: int
    awarded_at: datetime


class StudentCreditResponse(BaseModel):
    id: str
    student_email: str
    registration_number: str
    student_name: str
    department: Optional[str] = None
    batch: Optional[str] = None
    section: Optional[str] = None
    total_credits: int
    credit_history: List[CreditHistoryEntrySchema] = Field(default_factory=list)
    last_updated: datetime

    class Config:
        from_attributes = True


class StudentExportRow(BaseModel):
    name: str
    registration_number: str
    section: Optional[str] = None
    batch: Optional[str] = None
    total_credits: int = 0
    last_activity: Optional[datetime] = None
