#!/usr/bin/env python3
import asyncio
from app.database import connect_db, disconnect_db
from app.models.user import User
from app.config import get_settings
from app.core.security import hash_password

async def main():
    await connect_db()
    settings = get_settings()
    
    try:
        existing = await User.find_one(User.username == settings.superadmin_username)
        
        if existing:
            print(f"Resetting password for superadmin '{settings.superadmin_username}'")
            print(f"New password: {settings.superadmin_password}")
            
            existing.password_hash = hash_password(settings.superadmin_password)
            existing.email = settings.superadmin_email
            existing.name = settings.superadmin_name
            await existing.save()
            
            print("✓ Superadmin password reset successfully!")
            print(f"  Username: {existing.username}")
            print(f"  Password: {settings.superadmin_password}")
            print(f"\nNow you can login with these credentials.")
        else:
            print("✗ Superadmin not found!")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await disconnect_db()

if __name__ == "__main__":
    asyncio.run(main())
