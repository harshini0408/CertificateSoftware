import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import connect_db, get_database

async def fix():
    await connect_db()
    db = get_database()
    
    events = await db.events.find({}).to_list(None)
    import bson
    for ev in events:
        print(f"Checking event {ev.get('_id')} {ev.get('name')}")
        tmap = ev.get('template_map', {})
        if tmap:
            print("tmap:", tmap)
            new_tmap = {}
            changed = False
            for k, v in tmap.items():
                if isinstance(v, str):
                    try:
                        bson.ObjectId(v)
                        new_tmap[k] = v
                    except bson.errors.InvalidId:
                        print("Invalid ObjectId, skipping:", v)
                        changed = True
                else:
                    new_tmap[k] = v
            if changed:
                await db.events.update_one({'_id': ev['_id']}, {'$set': {'template_map': new_tmap}})
                print(f"Updated event {ev.get('_id')}")

if __name__ == "__main__":
    asyncio.run(fix())
