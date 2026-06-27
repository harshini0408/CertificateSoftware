"""Update specific role preset settings without overwriting positions.

Run:
    cd backend
    venv\\Scripts\\python scripts\\update_role_presets.py
"""

import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import connect_db, disconnect_db
from app.models.role_template_preset import RoleTemplatePreset


async def _update_logo_width(role_name: str, width_percent: float) -> bool:
    preset = await RoleTemplatePreset.find_one(RoleTemplatePreset.role_name == role_name)
    if not preset:
        print(f"Role preset not found: {role_name}")
        return False

    assets = dict(preset.asset_positions or {})
    logo = dict(assets.get("logo") or {})
    if "x_percent" not in logo or "y_percent" not in logo:
        # Keep the logo centered near the top-right as a safe default.
        logo.setdefault("x_percent", 88.0)
        logo.setdefault("y_percent", 10.0)
    logo["width_percent"] = float(width_percent)
    assets["logo"] = logo

    await preset.set({"asset_positions": assets})
    print(f"Updated logo width for {role_name} -> {width_percent}%")
    return True


async def main() -> None:
    await connect_db()
    try:
        await _update_logo_width("technical_participant", 18.0)
    finally:
        await disconnect_db()


if __name__ == "__main__":
    asyncio.run(main())
