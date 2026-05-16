"""MongoDB model for per-event, per-cert-type field position configurations.

Each event can have multiple FieldPosition documents — one per cert_type
(e.g. 'volunteer', 'winner_1st', 'coordinator').

column_positions structure:
    {
                "Name":              {"x_percent": 52.3, "y_percent": 48.1, "font_size_percent": 3.2},
                "Registration Number": {"x_percent": 60.0, "y_percent": 55.0, "font_size_percent": 3.2},
    }

font_size_percent: font size expressed as a percentage of the image width.
    3.2 means font_size = 0.032 * img_w.
    Default when absent: 3.2.
    Range: 1.0 (tiny) to 8.0 (very large headline).

asset_positions structure (optional — only set if coordinator placed the assets):
    {
        "logo":      {"x_percent": 10.0, "y_percent": 5.0, "width_percent": 12.0},
        "signature": {"x_percent": 15.0, "y_percent": 80.0, "width_percent": 18.0},
    }

x_percent / y_percent are percentages of the rendered image dimensions,
allowing the Pillow generator to scale correctly to any image resolution.
"""

from datetime import datetime
from typing import Dict, Optional

from beanie import Document, PydanticObjectId
from pydantic import Field


class FieldPosition(Document):
    event_id: PydanticObjectId
    cert_type: str                  # e.g. 'volunteer', 'winner_1st', 'coordinator'
    template_filename: str          # e.g. "template_01.png"
    # { "column_header_name": { "x_percent": float, "y_percent": float, "font_size_percent": float } }
    column_positions: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    # { "logo": {...}, "signature": {...} }  — optional, set after asset placement
    asset_positions: Optional[Dict[str, Dict[str, float]]] = None
    display_width: float = 580.0    # CSS pixel width when coordinator clicked
    confirmed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "field_positions"
        # Unique index on (event_id, cert_type)
        indexes = [["event_id", "cert_type"]]
