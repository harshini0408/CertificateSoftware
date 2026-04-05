import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.certsoftware
    events = await db.events.find({}).to_list(None)
    for ev in events:
        tmap = ev.get('template_map', {})
        new_tmap = {}
        changed = False
        for k, v in tmap.items():
            if isinstance(v, str) and not len(v) == 24:
                changed = True
                print(f'Fixing event {ev.get("_id")} template_map {k}={v}')
                # skip adding bad string to new_tmap
            else:
                new_tmap[k] = v
        if changed:
            await db.events.update_one({'_id': ev['_id']}, {'$set': {'template_map': new_tmap}})
            print(f'Updated event {ev.get("_id")}')

if __name__ == "__main__":
    asyncio.run(fix())
