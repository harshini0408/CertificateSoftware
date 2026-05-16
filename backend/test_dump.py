import asyncio
import json
from app.database import connect_db, disconnect_db
from app.models.role_template_preset import RoleTemplatePreset

async def test():
    await connect_db()
    preset = await RoleTemplatePreset.find_one(RoleTemplatePreset.role_name == "first_place")
    if preset:
        print("====== DOCUMENT ======")
        print(preset.model_dump_json(indent=2))
        print("======================")
    else:
        print("NOT FOUND")
    await disconnect_db()

if __name__ == "__main__":
    asyncio.run(test())
