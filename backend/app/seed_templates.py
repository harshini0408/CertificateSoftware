"""Seed preset certificate templates into MongoDB on application startup.

Reads the 6 HTML template files from app/static/templates/ and inserts
them as Template documents with is_preset=True if they don't already exist.
If they do exist, updates their field_slots and html_content.
"""

import logging
from pathlib import Path

from .models.template import Template, TemplateType, FieldSlot, TemplateBackground

logger = logging.getLogger(__name__)

# ── Per-template field slot definitions ──────────────────────────────────
# All values are in PIXELS on the 2480×3508 canvas.
# The template_renderer.py uses these directly for absolute positioning.

PARTICIPATION_SLOTS = [
    FieldSlot(
        slot_id="name_slot", label="Participant Name",
        x=240, y=800, width=2000, height=150,
        font_size=72, font_weight="bold", text_align="center",
    ),
    FieldSlot(
        slot_id="event_slot", label="Event Name",
        x=400, y=1050, width=1680, height=80,
        font_size=36, font_weight="bold", text_align="center",
    ),
    FieldSlot(
        slot_id="date_slot", label="Event Date",
        x=400, y=1210, width=1680, height=60,
        font_size=28, font_weight="normal", text_align="center",
    ),
    FieldSlot(
        slot_id="dept_slot", label="Department",
        x=400, y=1130, width=1680, height=60,
        font_size=28, font_weight="normal", text_align="center",
    ),
]

COORDINATOR_SLOTS = [
    FieldSlot(
        slot_id="name_slot", label="Coordinator Name",
        x=240, y=800, width=2000, height=150,
        font_size=72, font_weight="bold", text_align="center",
    ),
    FieldSlot(
        slot_id="event_slot", label="Event Name",
        x=400, y=1050, width=1680, height=80,
        font_size=36, font_weight="bold", text_align="center",
    ),
    FieldSlot(
        slot_id="role_slot", label="Role",
        x=400, y=1130, width=1680, height=60,
        font_size=28, font_weight="normal", text_align="center",
    ),
    FieldSlot(
        slot_id="date_slot", label="Event Date",
        x=400, y=1210, width=1680, height=60,
        font_size=28, font_weight="normal", text_align="center",
    ),
]

WINNER_SLOTS = [
    FieldSlot(
        slot_id="name_slot", label="Winner Name",
        x=240, y=820, width=2000, height=150,
        font_size=72, font_weight="bold", text_align="center",
    ),
    FieldSlot(
        slot_id="event_slot", label="Event Name",
        x=400, y=1060, width=1680, height=80,
        font_size=36, font_weight="bold", text_align="center",
    ),
    FieldSlot(
        slot_id="category_slot", label="Category",
        x=400, y=1140, width=1680, height=60,
        font_size=28, font_weight="normal", text_align="center",
    ),
    FieldSlot(
        slot_id="date_slot", label="Event Date",
        x=400, y=1220, width=1680, height=60,
        font_size=28, font_weight="normal", text_align="center",
    ),
    FieldSlot(
        slot_id="dept_slot", label="Department",
        x=400, y=1300, width=1680, height=60,
        font_size=28, font_weight="normal", text_align="center",
    ),
]

APPRECIATION_SLOTS = [
    FieldSlot(
        slot_id="name_slot", label="Recipient Name",
        x=240, y=800, width=2000, height=150,
        font_size=72, font_weight="bold", text_align="center",
    ),
    FieldSlot(
        slot_id="event_slot", label="Event Name",
        x=400, y=1050, width=1680, height=80,
        font_size=36, font_weight="bold", text_align="center",
    ),
    FieldSlot(
        slot_id="contribution_slot", label="Contribution",
        x=400, y=1130, width=1680, height=60,
        font_size=28, font_weight="normal", text_align="center",
    ),
    FieldSlot(
        slot_id="date_slot", label="Event Date",
        x=400, y=1210, width=1680, height=60,
        font_size=28, font_weight="normal", text_align="center",
    ),
]


# ── Template manifest ────────────────────────────────────────────────────

PRESET_MANIFEST = [
    {
        "filename": "participation.html",
        "name": "Classic Participation",
        "cert_type": "participant",
        "border_color": "#1B4D3E",
        "font_color": "#1B4D3E",
        "font_family": "Montserrat, sans-serif",
        "background": {"type": "color", "value": "#FFFDF7"},
        "field_slots": PARTICIPATION_SLOTS,
    },
    {
        "filename": "coordinator.html",
        "name": "Coordinator Recognition",
        "cert_type": "coordinator",
        "border_color": "#1B5E20",
        "font_color": "#1B5E20",
        "font_family": "Raleway, sans-serif",
        "background": {"type": "color", "value": "#F5FFF5"},
        "field_slots": COORDINATOR_SLOTS,
    },
    {
        "filename": "winner_1st.html",
        "name": "Winner — 1st Place",
        "cert_type": "winner_1st",
        "border_color": "#DAA520",
        "font_color": "#8B6914",
        "font_family": "Playfair Display, serif",
        "background": {"type": "gradient", "value": "linear-gradient(135deg, #FFFDF7, #FFF8E1)"},
        "field_slots": [FieldSlot(**s.model_dump()) for s in WINNER_SLOTS],
    },
    {
        "filename": "winner_2nd.html",
        "name": "Winner — 2nd Place",
        "cert_type": "winner_2nd",
        "border_color": "#8C8C8C",
        "font_color": "#333333",
        "font_family": "Playfair Display, serif",
        "background": {"type": "color", "value": "#FAFAFA"},
        "field_slots": [FieldSlot(**s.model_dump()) for s in WINNER_SLOTS],
    },
    {
        "filename": "winner_3rd.html",
        "name": "Winner — 3rd Place",
        "cert_type": "winner_3rd",
        "border_color": "#CD7F32",
        "font_color": "#4A2C0A",
        "font_family": "Playfair Display, serif",
        "background": {"type": "color", "value": "#FFF9F0"},
        "field_slots": [FieldSlot(**s.model_dump()) for s in WINNER_SLOTS],
    },
    {
        "filename": "appreciation.html",
        "name": "Appreciation Award",
        "cert_type": "volunteer",
        "border_color": "#B8860B",
        "font_color": "#8B6914",
        "font_family": "EB Garamond, serif",
        "background": {"type": "gradient", "value": "linear-gradient(135deg, #FFF8F0, #FFF5EB)"},
        "field_slots": APPRECIATION_SLOTS,
    },
]


async def seed_preset_templates() -> None:
    """Idempotent: create or update preset templates from HTML files."""
    templates_dir = Path(__file__).parent / "static" / "templates"

    if not templates_dir.exists():
        logger.warning("Templates directory not found: %s", templates_dir)
        return

    created_count = 0
    updated_count = 0

    for manifest in PRESET_MANIFEST:
        # Read HTML file
        html_path = templates_dir / manifest["filename"]
        if not html_path.exists():
            logger.warning("Template file not found: %s", html_path)
            continue

        html_content = html_path.read_text(encoding="utf-8")

        # Check if preset already exists
        existing = await Template.find_one(
            Template.is_preset == True,
            Template.cert_type == manifest["cert_type"],
        )

        if existing:
            # Update existing preset with latest HTML and slot config
            await existing.set({
                "name": manifest["name"],
                "html_content": html_content,
                "field_slots": [s.model_dump() for s in manifest["field_slots"]],
                "border_color": manifest["border_color"],
                "font_color": manifest["font_color"],
                "font_family": manifest["font_family"],
                "background": {
                    "type": manifest["background"]["type"],
                    "value": manifest["background"]["value"],
                },
            })
            updated_count += 1
            logger.info("[SEED] Updated preset template: %s", manifest["name"])
            continue

        # Create template document
        template = Template(
            club_id=None,
            name=manifest["name"],
            cert_type=manifest["cert_type"],
            type=TemplateType.PRESET,
            html_content=html_content,
            field_slots=list(manifest["field_slots"]),
            background=TemplateBackground(
                type=manifest["background"]["type"],
                value=manifest["background"]["value"],
            ),
            border_color=manifest["border_color"],
            font_family=manifest["font_family"],
            font_color=manifest["font_color"],
            is_preset=True,
        )
        await template.insert()
        created_count += 1
        logger.info("[SEED] Created preset template: %s", manifest["name"])

    if created_count > 0 or updated_count > 0:
        print(f"[SEED] Templates: {created_count} created, {updated_count} updated")
    else:
        logger.info("[SEED] All preset templates already exist")
