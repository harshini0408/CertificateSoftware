"""MongoDB model for per-event, per-cert-type field position configurations.

Each event can have multiple FieldPosition documents — one per cert_type
(e.g. 'volunteer', 'winner_1st', 'coordinator').

column_positions structure:
    {
        "Name":              {"x_percent": 52.3, "y_percent": 48.1},
        "Registration Number": {"x_percent": 60.0, "y_percent": 55.0},
    }

x_percent / y_percent are percentages of the rendered image dimensions,
allowing the Pillow generator to scale correctly to any image resolution.
"""

from datetime import datetime
from typing import Dict

from beanie import Document, PydanticObjectId
from pydantic import Field


class FieldPosition(Document):
    event_id: PydanticObjectId
    cert_type: str                  # e.g. 'volunteer', 'winner_1st', 'coordinator'
    template_filename: str          # e.g. "template_01.png"
    # { "column_header_name": { "x_percent": float, "y_percent": float } }
    column_positions: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    display_width: float            # CSS pixel width when coordinator clicked
    confirmed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "field_positions"
        # Unique index on (event_id, cert_type)
        indexes = [["event_id", "cert_type"]]
