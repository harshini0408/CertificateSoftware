from datetime import datetime
from typing import Dict, Optional
from beanie import Document, PydanticObjectId
from pydantic import Field


class SocietyFieldPosition(Document):
    event_id: PydanticObjectId
    cert_type: str                  # e.g. 'volunteer', 'winner_1st', 'coordinator'
    template_filename: str          # e.g. "template_01.png"
    column_positions: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    asset_positions: Optional[Dict[str, Dict[str, float]]] = None
    display_width: float = 580.0
    confirmed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "society_field_positions"
        indexes = [["event_id", "cert_type"]]
