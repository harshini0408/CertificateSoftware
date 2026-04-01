from beanie import Document
from pydantic import Field
from pymongo import IndexModel, ASCENDING


class CertSequence(Document):
    """Atomic counter for certificate numbering per club per year.

    Used via Motor's find_one_and_update with $inc for atomicity.
    """
    club_slug: str
    year: int
    seq: int = 0

    class Settings:
        name = "cert_sequences"
        indexes = [
            IndexModel(
                [("club_slug", ASCENDING), ("year", ASCENDING)],
                unique=True,
            ),
        ]
