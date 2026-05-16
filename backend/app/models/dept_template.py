from datetime import datetime
from typing import Optional

from beanie import Document, PydanticObjectId
from pydantic import Field


class DeptTemplate(Document):
    department: str
    event_id: PydanticObjectId
    original_filename: str
    template_path: str
    template_url: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    uploaded_by_user_id: Optional[str] = None

    class Settings:
        name = "dept_templates"
