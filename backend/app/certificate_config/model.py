from typing import List  
from beanie import Document, Indexed  
from pydantic import BaseModel  
  
class FieldConfig(BaseModel):  
    field_name: str  
    x: float  
    y: float  
  
class CertificateTemplateConfig(Document):  
    template_name: Indexed(str, unique=True) # type: ignore[valid-type]  
    fields: List[FieldConfig]  
  
    class Settings:  
        name = "certificate_template_configs" 
