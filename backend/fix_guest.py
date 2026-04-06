import asyncio
from app.config import get_settings
from app.models.user import User, UserRole
from app.models.event import Event
from app.database import connect_db, disconnect_db

async def fix_guest():
    await connect_db()
    guest = await User.find_one(User.role == UserRole.GUEST)
    if not guest:
        print('No guest user found')
        await disconnect_db()
        return

    event = await Event.find_one()
    if not event:
        print('No events found in DB to assign to guest')
        await disconnect_db()
        return
    
    guest.club_id = event.club_id
    guest.event_id = event.id
    await guest.save()
    print(f'Assigned event to guest {guest.username}')
    await disconnect_db()

if __name__ == "__main__":
    asyncio.run(fix_guest())
