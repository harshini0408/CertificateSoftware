"""MongoDB model for pre-baked PNG certificate templates."""

from datetime import datetime

from beanie import Document
from pydantic import Field


class ImageTemplate(Document):
    """Represents a pre-built PNG certificate template shipped with the codebase."""

    filename: str         # e.g. "template_01.png"
    display_name: str     # e.g. "Classic Blue"
    preview_url: str      # served via /static/certificate_templates/{filename}
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "image_templates"
