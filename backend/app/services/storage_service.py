import os
from pathlib import Path

from ..config import get_settings

settings = get_settings()


def save_cert_png(png_bytes: bytes, club_slug: str, year: int, cert_number: str) -> str:
    """Persist a certificate PNG to disk and return the file path.

    Path: {STORAGE}/certs/{club_slug}/{year}/{cert_number}.png
    """
    out_dir = Path(settings.certs_dir) / club_slug / str(year)
    out_dir.mkdir(parents=True, exist_ok=True)

    file_path = out_dir / f"{cert_number}.png"
    file_path.write_bytes(png_bytes)
    return str(file_path)


def get_cert_png_path(club_slug: str, year: int, cert_number: str) -> str:
    """Return the expected path for a certificate PNG."""
    return str(Path(settings.certs_dir) / club_slug / str(year) / f"{cert_number}.png")
