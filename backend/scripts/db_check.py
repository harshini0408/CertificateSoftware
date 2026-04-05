import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.config import get_settings
from app.models import ALL_MODELS, User

async def check():
    settings = get_settings()
    print(f"Testing connection to: {settings.mongodb_url}")
    client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
    
    try:
        # Check if server is reachable
        await client.admin.command('ping')
        print("✅ MongoDB server is reachable!")
        
        db = client[settings.db_name]
        await init_beanie(database=db, document_models=ALL_MODELS)
        print(f"✅ Beanie initialized on database: {settings.db_name}")
        
        # Check for superadmin
        admin = await User.find_one(User.username == settings.superadmin_username)
        if admin:
            print(f"✅ Superadmin '{settings.superadmin_username}' exists!")
        else:
            print(f"❌ Superadmin '{settings.superadmin_username}' NOT found.")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check())
