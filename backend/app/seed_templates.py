"""Seed preset certificate templates into MongoDB on application startup.

Reads the 6 HTML template files from app/static/templates/ and inserts
them as Template documents with is_preset=True if they don't already exist.
"""

import logging
from pathlib import Path

from .models.template import Template, TemplateType, FieldSlot, TemplateBackground

logger = logging.getLogger(__name__)

# Base width for x calculations: 2480. Center is 2480/2 - width/2

def _name_slot(y: int) -> FieldSlot:
    # Width 2000, x = (2480-2000)/2 = 240
    return FieldSlot(
        slot_id="name_slot", label="Participant Name",
        x=240, y=y, width=2000, height=150,
        font_size=120, font_weight="bold", text_align="center"
    )

def _default_slot_args(slot_id: str, label: str, y: int, font_size: int = 36) -> FieldSlot:
    # Width 1680, x = (2480-1680)/2 = 400
    return FieldSlot(
        slot_id=slot_id, label=label,
        x=400, y=y, width=1680, height=80,
        font_size=font_size, font_weight="bold", text_align="center"
    )

PRESET_MANIFEST = [
    {
        "filename": "participation.html",
        "name": "Classic Participation",
        "cert_type": "participant",
        "border_color": "#1B4D3E",
        "font_color": "#1B4D3E",
        "font_family": "Montserrat, sans-serif",
        "background": {"type": "color", "value": "#FFFDF7"},
        "slots": [
            _name_slot(920),
            _default_slot_args("event_slot", "Event Name", 1110),
            _default_slot_args("dept_slot", "Department", 1200),
            _default_slot_args("date_slot", "Event Date", 1290, font_size=28),
        ]
    },
    {
        "filename": "coordinator.html",
        "name": "Coordinator Gold",
        "cert_type": "coordinator",
        "border_color": "#1E3A5F",
        "font_color": "#1E3A5F",
        "font_family": "Playfair Display, serif",
        "background": {"type": "color", "value": "#FFFEF5"},
        "slots": [
            _name_slot(820),
            _default_slot_args("event_slot", "Event Name", 1010),
            _default_slot_args("role_slot", "Role", 1100),
            _default_slot_args("date_slot", "Event Date", 1198, font_size=28),
        ]
    },
    {
        "filename": "appreciation.html",
        "name": "Appreciation Blue",
        "cert_type": "appreciation",
        "border_color": "#1E3A5F",
        "font_color": "#1E3A5F",
        "font_family": "Montserrat, sans-serif",
        "background": {"type": "color", "value": "#F8FAFF"},
        "slots": [
            _name_slot(1150),
            _default_slot_args("event_slot", "Event Name", 1350),
            _default_slot_args("contribution_slot", "Contribution", 1450),
            _default_slot_args("date_slot", "Event Date", 1550, font_size=28),
        ]
    },
    {
        "filename": "winner_1st.html",
        "name": "Winner — 1st Place",
        "cert_type": "winner_1st",
        "border_color": "#C9A84C",
        "font_color": "#1B4D3E",
        "font_family": "Playfair Display, serif",
        "background": {"type": "gradient", "value": "linear-gradient(135deg, #FFFDF7, #FFF8E1)"},
        "slots": [
            _name_slot(1020),
            _default_slot_args("event_slot", "Event Name", 1220),
            _default_slot_args("category_slot", "Category", 1320),
            _default_slot_args("dept_slot", "Department", 1420),
            _default_slot_args("date_slot", "Event Date", 1520, font_size=28),
        ]
    },
    {
        "filename": "winner_2nd.html",
        "name": "Winner — 2nd Place",
        "cert_type": "winner_2nd",
        "border_color": "#8C8C8C",
        "font_color": "#333333",
        "font_family": "Playfair Display, serif",
        "background": {"type": "color", "value": "#FAFAFA"},
        "slots": [
            _name_slot(1020),
            _default_slot_args("event_slot", "Event Name", 1220),
            _default_slot_args("category_slot", "Category", 1320),
            _default_slot_args("dept_slot", "Department", 1420),
            _default_slot_args("date_slot", "Event Date", 1520, font_size=28),
        ]
    },
    {
        "filename": "winner_3rd.html",
        "name": "Winner — 3rd Place",
        "cert_type": "winner_3rd",
        "border_color": "#CD7F32",
        "font_color": "#4A2C0A",
        "font_family": "Playfair Display, serif",
        "background": {"type": "color", "value": "#FFF9F0"},
        "slots": [
            _name_slot(1020),
            _default_slot_args("event_slot", "Event Name", 1220),
            _default_slot_args("category_slot", "Category", 1320),
            _default_slot_args("dept_slot", "Department", 1420),
            _default_slot_args("date_slot", "Event Date", 1520, font_size=28),
        ]
    },
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
            # We want to force update slots on startup if they changed.
            await existing.set({"field_slots": [s.model_dump() for s in manifest["slots"]]})
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
            field_slots=manifest["slots"],
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
