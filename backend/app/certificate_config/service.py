from .model import CertificateTemplateConfig

async def get_template_config(template_name: str) -> dict:
    """
    Fetches the configuration for a template.
    Returns a dict mapping field_name to (x, y) coordinates.
    """
    config = await CertificateTemplateConfig.find_one(
        CertificateTemplateConfig.template_name == template_name
    )
    if not config:
        return {}
    
    return {f.field_name: {"x": f.x, "y": f.y} for f in config.fields}
