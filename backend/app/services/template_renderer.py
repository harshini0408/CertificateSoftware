import base64
from pathlib import Path
from typing import Optional

from jinja2 import Template as JinjaTemplate

from ..models.participant import Participant
from ..models.template import Template


def _file_to_base64(path: str) -> str:
    """Read a file and return a base64 data-URI string."""
    if not path or not Path(path).exists():
        return ""
    data = Path(path).read_bytes()
    b64 = base64.b64encode(data).decode()
    return f"data:image/png;base64,{b64}"


def render_certificate(
    participant: Participant,
    template: Template,
    cert_number: str,
    qr_base64: str,
    logo_path: Optional[str] = None,
    signature_path: Optional[str] = None,
) -> str:
    """Render a certificate to an HTML string using Jinja2.

    Dynamic field values are placed at their slot positions via
    inline CSS absolute positioning.  Logo and signature are embedded
    as base64 data URIs so the resulting HTML is fully self-contained.
    """
    logo_b64 = _file_to_base64(logo_path) if logo_path else ""
    sig_b64 = _file_to_base64(signature_path) if signature_path else ""

    # Build slot → value map using field_mapping
    slot_values = {}
    for col_header, slot_id in participant.field_mapping.items():
        slot_values[slot_id] = participant.fields.get(col_header, "")

    # Build positioned HTML blocks for each field slot
    field_html_parts = []
    for slot in template.field_slots:
        value = slot_values.get(slot.slot_id, "")
        # Per-slot colour > template-level colour > black
        colour = slot.color or template.font_color or "#000000"
        style = (
            f"position:absolute; left:{slot.x}px; top:{slot.y}px; "
            f"width:{slot.width}px; height:{slot.height}px; "
            f"font-size:{slot.font_size}px; font-weight:{slot.font_weight}; "
            f"text-align:{slot.text_align}; color:{colour}; "
            f"display:flex; align-items:center; "
            f"justify-content:{slot.text_align};"
        )
        field_html_parts.append(
            f'<div style="{style}">{value}</div>'
        )

    fields_block = "\n".join(field_html_parts)

    # Render Jinja2 template with all variables
    jinja_tpl = JinjaTemplate(template.html_content)
    html = jinja_tpl.render(
        cert_number=cert_number,
        qr_base64=qr_base64,
        logo_base64=logo_b64,
        signature_base64=sig_b64,
        fields_block=fields_block,
        participant_name=participant.fields.get("Name", ""),
        participant_email=participant.email,
        cert_type=participant.cert_type,
        slot_values=slot_values,
    )

    return html
