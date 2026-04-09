import codecs
import re
import os

file_path = r"d:\CertificateSoftware\backend\app\services\png_generator.py"

def update_png_generator():
    with codecs.open(file_path, "r", "utf-8") as f:
        content = f.read()

    # 1. Update imports
    old_imports = """    from PIL import Image, ImageDraw
    from ..models.field_position import FieldPosition"""
    new_imports = """    from PIL import Image, ImageDraw
    from ..models.field_position import FieldPosition
    from ..certificate_config.model import CertificateTemplateConfig"""
    
    if old_imports in content:
        content = content.replace(old_imports, new_imports)

    # 2. Update logic for column_positions and template selection
    # We want to replace the entire step 1 and step 2 logic block
    
    logic_replacement = """    # ── 1. Fetch field positions (either UI-mapped or manual) ──────────────────
    ui_config = await CertificateTemplateConfig.find_one(
        CertificateTemplateConfig.template_name == event.template_filename
    )

    column_positions = {}
    asset_positions = {}
    template_filename = event.template_filename

    if ui_config:
        # UI config uses "x", "y" as percentages (0-100)
        column_positions = {
            f.field_name: {"x_percent": f.x, "y_percent": f.y} 
            for f in ui_config.fields
        }
        # In UI-mapped mode, we don't have asset positions yet, so use empty or default
        asset_positions = {}
        logger.info(f"Using UI-mapped coordinates for {template_filename}")
    else:
        # Fallback to old FieldPosition system
        fp = await FieldPosition.find_one(
            FieldPosition.event_id == event.id,
            FieldPosition.cert_type == cert_type,
        )
        if not fp:
            fp = await FieldPosition.find_one(
                FieldPosition.event_id == event.id,
                FieldPosition.cert_type == "participant",
            )
        
        if not fp:
            raise ValueError(
                f"No field positions found for event {event.id}, cert_type='{cert_type}'. "
                "Please configure fields in the Template Mapper."
            )
            
        column_positions = fp.column_positions
        asset_positions = fp.asset_positions or {}
        template_filename = fp.template_filename

    # ── 2. Load template PNG ────────────────────────────────────────────────
    if not template_filename:
        raise ValueError("No template filename available.")
        
    template_path = _CERT_TMPL_DIR / template_filename
    if not template_path.exists():
        raise FileNotFoundError(
            f"Template PNG not found: {template_path}. "
            f"Expected file: backend/app/static/certificate_templates/{template_filename}"
        )"""

    # Look for the start of step 1 until the end of step 2's error checking
    pattern = r"    # ── 1\. Fetch field positions.*?Expected file: backend/app/static/certificate_templates/\{template_filename\}\"\s+\)"
    
    new_content = re.sub(pattern, logic_replacement, content, flags=re.DOTALL)
    
    # Also update the function call to use our new variables
    new_content = new_content.replace("fp.column_positions", "column_positions")
    new_content = new_content.replace("fp.asset_positions or {}", "asset_positions")

    with codecs.open(file_path, "w", "utf-8") as f:
        f.write(new_content)
    print("Successfully updated png_generator.py")

if __name__ == "__main__":
    update_png_generator()
