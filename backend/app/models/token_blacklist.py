from datetime import datetime

from beanie import Document, Indexed
from pydantic import Field
from pymongo import IndexModel, ASCENDING


class TokenBlacklist(Document):
    """Blacklisted refresh-token JTIs.

    MongoDB TTL index on *expires_at* automatically purges
    expired entries so the collection never grows unbounded.
    """

    token_jti: Indexed(str, unique=True)  # type: ignore[valid-type]
    expires_at: datetime

    class Settings:
        name = "token_blacklist"
        indexes = [
            IndexModel(
                [("expires_at", ASCENDING)],
                expireAfterSeconds=0,
            ),
        ]
