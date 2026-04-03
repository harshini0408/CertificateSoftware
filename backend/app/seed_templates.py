"""Seed preset certificate templates into MongoDB on application startup.

Reads the 6 HTML template files from app/static/templates/ and inserts
them as Template documents with is_preset=True if they don't already exist.
This makes presets available system-wide for all clubs to assign.
"""

import logging
from pathlib import Path

from .models.template import Template, TemplateType, FieldSlot, TemplateBackground

logger = logging.getLogger(__name__)

# ── Template manifest ────────────────────────────────────────────────────
# Maps filename → (display name, cert_type, border_color, font_color)

PRESET_MANIFEST = [
    {
        "filename": "participation.html",
        "name": "Classic Participation",
        "cert_type": "participant",
        "border_color": "#1B4D3E",
        "font_color": "#1B4D3E",
        "font_family": "Montserrat, sans-serif",
        "background": {"type": "color", "value": "#FFFDF7"},
    },
    {
        "filename": "coordinator.html",
        "name": "Coordinator Gold",
        "cert_type": "coordinator",
        "border_color": "#1E3A5F",
        "font_color": "#1E3A5F",
        "font_family": "Playfair Display, serif",
        "background": {"type": "color", "value": "#FFFEF5"},
    },
    {
        "filename": "appreciation.html",
        "name": "Appreciation Blue",
        "cert_type": "volunteer",
        "border_color": "#1E3A5F",
        "font_color": "#1E3A5F",
        "font_family": "Montserrat, sans-serif",
        "background": {"type": "color", "value": "#F8FAFF"},
    },
    {
        "filename": "winner_1st.html",
        "name": "Winner — 1st Place",
        "cert_type": "winner_1st",
        "border_color": "#C9A84C",
        "font_color": "#1B4D3E",
        "font_family": "Playfair Display, serif",
        "background": {"type": "gradient", "value": "linear-gradient(135deg, #FFFDF7, #FFF8E1)"},
    },
    {
        "filename": "winner_2nd.html",
        "name": "Winner — 2nd Place",
        "cert_type": "winner_2nd",
        "border_color": "#8C8C8C",
        "font_color": "#333333",
        "font_family": "Playfair Display, serif",
        "background": {"type": "color", "value": "#FAFAFA"},
    },
    {
        "filename": "winner_3rd.html",
        "name": "Winner — 3rd Place",
        "cert_type": "winner_3rd",
        "border_color": "#CD7F32",
        "font_color": "#4A2C0A",
        "font_family": "Playfair Display, serif",
        "background": {"type": "color", "value": "#FFF9F0"},
    },
]

# Default field slots common to all preset templates
DEFAULT_FIELD_SLOTS = [
    FieldSlot(
        slot_id="name", label="Participant Name",
        x=240, y=800, width=2000, height=150,
        font_size=72, font_weight="bold", text_align="center",
    ),
    FieldSlot(
        slot_id="event_name", label="Event Name",
        x=400, y=1050, width=1680, height=80,
        font_size=36, font_weight="bold", text_align="center",
    ),
    FieldSlot(
        slot_id="club_name", label="Club Name",
        x=400, y=1130, width=1680, height=80,
        font_size=36, font_weight="bold", text_align="center",
    ),
    FieldSlot(
        slot_id="date", label="Event Date",
        x=400, y=1210, width=1680, height=60,
        font_size=28, font_weight="normal", text_align="center",
    ),
]


async def seed_preset_templates() -> None:
    """Idempotent: create preset templates from HTML files if they don't exist."""
    templates_dir = Path(__file__).parent / "static" / "templates"

    if not templates_dir.exists():
        logger.warning("Templates directory not found: %s", templates_dir)
        return

    created_count = 0
    for manifest in PRESET_MANIFEST:
        # Check if preset already exists
        existing = await Template.find_one(
            Template.is_preset == True,
            Template.name == manifest["name"],
        )
        if existing:
            continue

        # Read HTML file
        html_path = templates_dir / manifest["filename"]
        if not html_path.exists():
            logger.warning("Template file not found: %s", html_path)
            continue

        html_content = html_path.read_text(encoding="utf-8")

        # Create template document
        template = Template(
            club_id=None,
            name=manifest["name"],
            cert_type=manifest["cert_type"],
            type=TemplateType.PRESET,
            html_content=html_content,
            field_slots=DEFAULT_FIELD_SLOTS.copy(),
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

    if created_count > 0:
        print(f"[SEED] {created_count} preset template(s) created")
    else:
        logger.info("[SEED] All preset templates already exist")
