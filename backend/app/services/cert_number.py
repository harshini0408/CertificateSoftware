from ..config import get_settings
from ..database import get_database

settings = get_settings()


async def generate_cert_number(club_slug: str, year: int) -> str:
    """Atomically increment the per-club-per-year counter and return a
    formatted certificate number like ``PSG-ECOCLUB-2025-000001``.

    Uses Motor's ``find_one_and_update`` with ``$inc`` + ``upsert``
    to guarantee uniqueness even under concurrent requests.
    """
    db = get_database()
    collection = db["cert_sequences"]

    doc = await collection.find_one_and_update(
        {"club_slug": club_slug, "year": year},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,           # return the *updated* doc
    )

    seq = doc["seq"]
    return f"PSG-{club_slug}-{year}-{str(seq).zfill(6)}"
