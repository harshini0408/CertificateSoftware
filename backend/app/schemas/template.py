from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class FieldSlotSchema(BaseModel):
    slot_id: str
    label: str
    x: float
    y: float
    width: float
    height: float
    font_size: int = 24
    font_weight: str = "normal"
    text_align: str = "center"


class StaticElementSchema(BaseModel):
    element_id: str
    type: str
    content: Optional[str] = None
    x: float
    y: float
    width: float
    height: float
    font_size: Optional[int] = None
    font_color: Optional[str] = None
    font_family: Optional[str] = None
    font_weight: Optional[str] = None


class BackgroundSchema(BaseModel):
    type: str = "color"
    value: str = "#FFFFFF"


class TemplateCreate(BaseModel):
    name: str
    cert_type: str
    html_content: str = ""
    field_slots: List[FieldSlotSchema] = Field(default_factory=list)
    static_elements: List[StaticElementSchema] = Field(default_factory=list)
    background: BackgroundSchema = Field(default_factory=BackgroundSchema)
    border_color: Optional[str] = None
    font_family: Optional[str] = None
    font_color: Optional[str] = None


class TemplateResponse(BaseModel):
    id: str
    club_id: Optional[str] = None
    name: str
    cert_type: str
    type: str
    html_content: str = ""
    field_slots: List[FieldSlotSchema] = Field(default_factory=list)
    static_elements: List[StaticElementSchema] = Field(default_factory=list)
    background: BackgroundSchema = Field(default_factory=BackgroundSchema)
    border_color: Optional[str] = None
    font_family: Optional[str] = None
    font_color: Optional[str] = None
    is_preset: bool
    preview_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
