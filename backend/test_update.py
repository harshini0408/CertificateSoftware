import asyncio
from app.database import connect_db, disconnect_db
from app.models.role_template_preset import RoleTemplatePreset

async def test_update():
    await connect_db()
    preset = await RoleTemplatePreset.find_one(RoleTemplatePreset.role_name == "first_place")
    print("BEFORE:", preset.column_positions)
    update_data = {
        "column_positions": {"Name": {"x_percent": 12.3, "y_percent": 45.6}}
    }
    await preset.set(update_data)
    
    preset2 = await RoleTemplatePreset.find_one(RoleTemplatePreset.role_name == "first_place")
    print("AFTER:", preset2.column_positions)
    await disconnect_db()

if __name__ == "__main__":
    asyncio.run(test_update())
