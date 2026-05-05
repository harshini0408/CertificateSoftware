"""Seed role template presets into MongoDB.

Run:
  cd backend
  venv\Scripts\python scripts\seed_role_presets.py
"""

import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import connect_db, disconnect_db
from app.models.role_template_preset import RoleTemplatePreset


def _default_column_positions():
    return {
        "Name": {"x_percent": 35.4, "y_percent": 52.6, "font_size_percent": 2.7},
        "Registration Number": {"x_percent": 14.9, "y_percent": 59.4, "font_size_percent": 2.7},
    
        "Role": {"x_percent": 52.6, "y_percent": 59.4, "font_size_percent": 2.7},
        "Event Name": {"x_percent": 15.9, "y_percent": 65.8, "font_size_percent": 2.7},
        "Event Date": {"x_percent": 65.8, "y_percent": 65.8, "font_size_percent": 2.7},
        "Club Name": {"x_percent": 17.9, "y_percent": 72.8, "font_size_percent": 2.7},
        "Year": {"x_percent": 14.4, "y_percent": 79.0, "font_size_percent": 2.7},
    }


def _default_asset_positions():
    return {
        "logo": {"x_percent": 88.0, "y_percent": 10.0, "width_percent": 15.0},
        "signature": {"x_percent": 17.0, "y_percent": 88.0, "width_percent": 11.0},
    }


async def main() -> None:
    await connect_db()
    try:
        template_dir = BACKEND_DIR / "app" / "static" / "certificate_templates"
        png_files = sorted([p.name for p in template_dir.glob("*.png")])
        if not png_files:
            raise RuntimeError("No PNG templates found in backend/app/static/certificate_templates")

        role_specs = [
            ("student_council_member", "Student Council Member"),
            ("office_bearer", "Office Bearer"),
            ("club_member", "Club Member"),
            ("class_representative", "Class Representative"),
            ("student_volunteer", "Student Volunteer"),
            ("organizer", "Organizer"),
            ("coordinator", "Coordinator"),
            ("technical_talk", "Technical Talk"),
            ("paper_presenter", "Paper Presenter"),
            ("first_place", "First Place"),
            ("second_place", "Second Place"),
            ("third_place", "Third Place"),
            ("technical_participant", "Technical Participant"),
            ("non_technical_participant", "Non-Technical Participant"),
        ]

        created = 0
        updated = 0
        for idx, (role_name, display_label) in enumerate(role_specs):
            template_filename = png_files[idx % len(png_files)]
            payload = {
                "display_label": display_label,
                "template_filename": template_filename,
                "column_positions": _default_column_positions(),
                "asset_positions": _default_asset_positions(),
                "display_width": 1905.0,
                "is_active": True,
            }
            existing = await RoleTemplatePreset.find_one(RoleTemplatePreset.role_name == role_name)
            if existing:
                await existing.set(payload)
                updated += 1
            else:
                await RoleTemplatePreset(role_name=role_name, **payload).insert()
                created += 1

        print(f"Seed complete: created={created}, updated={updated}, total={len(role_specs)}")
    finally:
        await disconnect_db()


if __name__ == "__main__":
    asyncio.run(main())
