import hashlib
import os
from pathlib import Path

from rembg import remove

from ..config import get_settings

settings = get_settings()


def process_signature(file_bytes: bytes, club_slug: str) -> str:
    """Remove background from signature image using rembg.

    Caches output by MD5 hash so repeated uploads skip processing.
    Returns the absolute file path to the processed PNG.
    """
    md5 = hashlib.md5(file_bytes).hexdigest()
    out_dir = Path(settings.assets_dir) / club_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    cache_path = out_dir / f"sig_{md5}.png"
    if cache_path.exists():
        return str(cache_path)

    result_bytes = remove(file_bytes)
    cache_path.write_bytes(result_bytes)
    return str(cache_path)


def save_logo(file_bytes: bytes, club_slug: str) -> str:
    """Save club logo and return the file path."""
    md5 = hashlib.md5(file_bytes).hexdigest()
    out_dir = Path(settings.assets_dir) / club_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    path = out_dir / f"logo_{md5}.png"
    if not path.exists():
        path.write_bytes(file_bytes)
    return str(path)
