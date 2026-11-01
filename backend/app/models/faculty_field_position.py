"""FacultyFieldPosition — field positioning configuration for a faculty certificate session.

Saved in separate collection 'faculty_field_positions'.
"""

from datetime import datetime
from typing import Dict

from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field


class FacultyFieldPosition(Document):
    session_id: Indexed(PydanticObjectId, unique=True)  # type: ignore[valid-type]
    column_positions: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    display_width: float = 580.0
    confirmed: bool = True
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "faculty_field_positions"
