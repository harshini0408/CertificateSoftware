import os
from pathlib import Path

from ..config import get_settings

settings = get_settings()


def storage_path_to_url(path_or_url: str) -> str:
    """Convert a local storage path to a public /storage URL.

    If value is already a /storage URL, it is returned as-is.
    """
    if not path_or_url:
        return path_or_url
    if path_or_url.startswith("/storage/"):
        return path_or_url

    try:
        rel = Path(path_or_url).resolve().relative_to(Path(settings.storage_path).resolve())
        return f"/storage/{rel.as_posix()}"
    except Exception:
        return path_or_url


def storage_url_to_path(url_or_path: str) -> str:
    """Convert a public /storage URL to a local path.

    If value is already a local path, it is returned as-is.
    """
    if not url_or_path:
        return url_or_path
    if url_or_path.startswith("/storage/"):
        rel = url_or_path[len("/storage/"):]
        return str(Path(settings.storage_path).resolve() / Path(rel))
    return url_or_path


def save_cert_png(png_bytes: bytes, club_slug: str, year: int, cert_number: str) -> str:
    """Persist a certificate PNG to disk and return its public URL.

    Path: {STORAGE}/certs/{club_slug}/{year}/{cert_number}.png
    """
    out_dir = Path(settings.certs_dir) / club_slug / str(year)
    out_dir.mkdir(parents=True, exist_ok=True)

    file_path = out_dir / f"{cert_number}.png"
    file_path.write_bytes(png_bytes)
    return storage_path_to_url(str(file_path))


def get_cert_png_path(club_slug: str, year: int, cert_number: str) -> str:
    """Return the expected path for a certificate PNG."""
    return str(Path(settings.certs_dir) / club_slug / str(year) / f"{cert_number}.png")
