import hashlib
import os
from pathlib import Path
import io

from rembg import remove
from PIL import Image

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
        try:
            cached = Image.open(str(cache_path))
            if cached.mode in ("RGBA", "LA"):
                alpha = cached.getchannel("A")
                if alpha.getbbox() is not None:
                    return str(cache_path)
            else:
                return str(cache_path)
        except Exception:
            pass

    # If user already uploads a transparent PNG signature, keep as-is.
    use_original = False
    try:
        img = Image.open(io.BytesIO(file_bytes))
        if img.mode in ("RGBA", "LA"):
            alpha = img.getchannel("A")
            if alpha.getbbox() is not None:
                use_original = True
    except Exception:
        pass

    result_bytes = file_bytes if use_original else remove(file_bytes)

    # Guard against rembg returning a fully transparent image.
    try:
        out_img = Image.open(io.BytesIO(result_bytes))
        if out_img.mode in ("RGBA", "LA") and out_img.getchannel("A").getbbox() is None:
            result_bytes = file_bytes
    except Exception:
        # If output cannot be parsed, fallback to original upload bytes.
        result_bytes = file_bytes

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
