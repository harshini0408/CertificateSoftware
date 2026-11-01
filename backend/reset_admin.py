import asyncio
from app.config import get_settings
from app.database import connect_db, disconnect_db
from app.models.user import User
from app.core.security import hash_password

async def reset_admin():
    settings = get_settings()
    await connect_db()
    
    admin = await User.find_one(User.username == settings.superadmin_username)
    if admin:
        admin.password_hash = hash_password(settings.superadmin_password)
        await admin.save()
        print(f"✅ Password for '{settings.superadmin_username}' reset to '{settings.superadmin_password}'")
    else:
        print(f"❌ User '{settings.superadmin_username}' not found. Seeding new one...")
        from app.models.user import UserRole
        await User(
            username=settings.superadmin_username,
            name=settings.superadmin_name,
            email=settings.superadmin_email,
            password_hash=hash_password(settings.superadmin_password),
            role=UserRole.SUPER_ADMIN,
        ).insert()
        print(f"✅ Super-admin '{settings.superadmin_username}' created")
        
    await disconnect_db()

if __name__ == "__main__":
    asyncio.run(reset_admin())
