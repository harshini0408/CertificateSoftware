#!/usr/bin/env python3
import asyncio

from app.database import connect_db, disconnect_db, get_database


async def main():
    try:
        await connect_db()
        db = get_database()
        pong = await db.command("ping")
        print("[TEST] ping response:", pong)
    except Exception as e:
        print("[TEST] Connection failed:", repr(e))
    finally:
        await disconnect_db()


if __name__ == "__main__":
    asyncio.run(main())
