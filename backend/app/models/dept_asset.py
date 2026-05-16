from datetime import datetime
from typing import Optional, Dict

from beanie import Document
from pydantic import BaseModel, Field


class DeptFieldPosition(BaseModel):
    """Position mapping for certificate fields (name, class, contribution)"""
    field_name: str  # "name", "class", "contribution"
    x_percent: float  # X position as percentage (0-100)
    y_percent: float  # Y position as percentage (0-100)
    font_size: int = 24


class DeptAsset(Document):
    department: str
    
    # Logos and signatures
    logo_path: Optional[str] = None
    logo_hash: Optional[str] = None
    logo_url: Optional[str] = None

    signature1_path: Optional[str] = None
    signature1_hash: Optional[str] = None
    signature1_url: Optional[str] = None

    signature2_path: Optional[str] = None
    signature2_hash: Optional[str] = None
    signature2_url: Optional[str] = None

    # Certificate template (static image)
    certificate_template_path: Optional[str] = None  # e.g., "storage/dept_templates/CSE.png"
    certificate_template_url: Optional[str] = None
    
    # Field positions mapping: {field_name -> DeptFieldPosition}
    field_positions: Dict[str, DeptFieldPosition] = Field(default_factory=dict)
    
    # Flag to track if field positions have been configured
    positions_configured: bool = False

    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "dept_assets"
