from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from typing import Optional

from .config import get_settings
from .models import ALL_MODELS

_client: Optional[AsyncIOMotorClient] = None


async def connect_db() -> None:
    """Initialise Motor client + Beanie ODM on startup."""
    global _client

    settings = get_settings()
    _client = AsyncIOMotorClient(settings.mongodb_url)
    db = _client[settings.db_name]

    await init_beanie(database=db, document_models=ALL_MODELS)
    print(f"[DB] Connected to MongoDB — database: {settings.db_name}")


async def disconnect_db() -> None:
    """Close Motor client on shutdown."""
    global _client
    if _client:
        _client.close()
        _client = None
        print("[DB] MongoDB disconnected")


def get_client() -> AsyncIOMotorClient:
    """Return the active Motor client (used by cert_number service)."""
    if _client is None:
        raise RuntimeError("Database not connected. Call connect_db() first.")
    return _client


def get_database():
    """Return the active database instance."""
    if _client is None:
        raise RuntimeError("Database not connected. Call connect_db() first.")
    return _client[get_settings().db_name]
