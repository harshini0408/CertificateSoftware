from datetime import datetime
from enum import Enum
from typing import Optional, Dict, List

from beanie import Document, PydanticObjectId
from pydantic import Field


class DeptEventStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"


class DeptEvent(Document):
    department: str
    created_by_user_id: Optional[str] = None
    name: str
    event_date: Optional[datetime] = None
    semester: str
    status: DeptEventStatus = DeptEventStatus.DRAFT
    template_id: Optional[PydanticObjectId] = None
    selected_fields: List[str] = Field(default_factory=list)
    field_positions: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    mapping_configured: bool = False
    excel_headers: List[str] = Field(default_factory=list)
    excel_rows: List[Dict[str, str]] = Field(default_factory=list)
    excel_preview_row: Dict[str, str] = Field(default_factory=dict)
    excel_file_name: Optional[str] = None
    excel_uploaded_at: Optional[datetime] = None
    preview_certificate_id: Optional[PydanticObjectId] = None
    preview_approved: bool = False
    preview_approved_at: Optional[datetime] = None
    preview_approved_by_user_id: Optional[str] = None
    participant_count: int = 0
    cert_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "dept_events"
