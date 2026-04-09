import asyncio
import json
from app.database import connect_db, disconnect_db
from app.models.role_template_preset import RoleTemplatePreset

async def check():
    await connect_db()
    presets = await RoleTemplatePreset.find_all().to_list()
    has_positions = False
    for p in presets:
        if p.column_positions:
            print(f"FOUND POSITIONS IN {p.role_name}: {p.column_positions}")
            has_positions = True
    if not has_positions:
        print("NO COLUMN POSITIONS FOUND IN ANY PRESET")
    await disconnect_db()

if __name__ == "__main__":
    asyncio.run(check())
