"""
PNG / Image generation service.

Two generation pipelines are supported:

1. **Pillow overlay pipeline** (new, image-based templates):
   Triggered when ``event.template_filename`` is set.
   Loads a pre-built PNG from ``static/certificate_templates/``, then uses
   Pillow to overlay text, logo, signature, and QR code at positions saved
   in the ``field_positions`` collection.

2. **imgkit / wkhtmltoimage pipeline** (legacy, HTML templates):
   Triggered when ``event.template_filename`` is None or empty.
   Converts a rendered HTML string into a 2480 × 3508 px PNG (A4 at 300 DPI).
   Kept so events created before the image-template switch are not broken.

Requirements
------------
* Pillow ≥ 9 (pip install Pillow)
* For legacy pipeline: imgkit + wkhtmltoimage on the host PATH.
"""

import base64
import io
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ── Static paths ──────────────────────────────────────────────────────────────
_STATIC_DIR    = Path(__file__).parent.parent / "static"
_CERT_TMPL_DIR = _STATIC_DIR / "certificate_templates"
_FONTS_DIR     = _STATIC_DIR / "fonts"
_DEFAULT_FONT  = _FONTS_DIR / "Montserrat-Bold.ttf"

# ── A4 @ 300 DPI ──────────────────────────────────────────────────────────────
_A4_W_PX = "2480"
_A4_H_PX = "3508"

# ── imgkit (legacy) ───────────────────────────────────────────────────────────
try:
    import imgkit
    _IMGKIT_AVAILABLE = True
except ImportError:
    _IMGKIT_AVAILABLE = False

_IMGKIT_OPTIONS: dict[str, str] = {
    "format":              "png",
    "width":               _A4_W_PX,
    "height":              _A4_H_PX,
    "disable-smart-width": "",
    "zoom":                "1.0",
    "quality":             "100",
    "enable-local-file-access": "",
    "quiet":               "",
}


# ══════════════════════════════════════════════════════════════════════════════
# LEGACY PIPELINE — imgkit / wkhtmltoimage
# ══════════════════════════════════════════════════════════════════════════════

def generate_png(html: str, output_path: str) -> None:
    """Convert an HTML string to a 2480 × 3508 px PNG (A4 at 300 DPI).

    Parameters
    ----------
    html:
        Fully-rendered HTML string (all assets should be embedded as Base64
        data-URIs, or referenced via absolute ``file://`` paths while the
        ``enable-local-file-access`` option is set).
    output_path:
        Destination file path for the PNG (e.g. ``/storage/certs/abc123.png``).
    """
    if not _IMGKIT_AVAILABLE:
        raise RuntimeError("imgkit is not installed. Run: pip install imgkit")

    try:
        imgkit.from_string(html, output_path, options=_IMGKIT_OPTIONS)
        logger.info("Generated PNG: %s", output_path)
    except Exception as exc:
        logger.error("PNG generation failed for %s: %s", output_path, exc)
        raise


def generate_png_from_file(html_path: str, output_path: str) -> None:
    """Convenience wrapper – convert an HTML *file* to PNG."""
    if not _IMGKIT_AVAILABLE:
        raise RuntimeError("imgkit is not installed. Run: pip install imgkit")
    html_content = Path(html_path).read_text(encoding="utf-8")
    generate_png(html_content, output_path)


# ══════════════════════════════════════════════════════════════════════════════
# PILLOW OVERLAY PIPELINE — PNG image templates
# ══════════════════════════════════════════════════════════════════════════════

def _load_font(size: int):
    """Load Montserrat-Bold if available, else fall back to the default PIL font."""
    try:
        from PIL import ImageFont
        if _DEFAULT_FONT.exists():
            return ImageFont.truetype(str(_DEFAULT_FONT), size)
        # Try system font search path as last resort
        return ImageFont.load_default()
    except Exception:
        from PIL import ImageFont
        return ImageFont.load_default()


def _paste_with_alpha(base_img, overlay_img, xy):
    """Paste *overlay_img* onto *base_img* at *xy*, using alpha channel as mask."""
    from PIL import Image
    if overlay_img.mode == "RGBA":
        mask = overlay_img.split()[3]
    else:
        mask = None
    base_img.paste(overlay_img, xy, mask)


async def generate_certificate_pillow(
    event,
    participant,
    qr_b64: str,
    output_path: str,
    club_slug: str = "default",
) -> None:
    """Overlay text, logo, signature, and QR on a PNG template using Pillow.

    Parameters
    ----------
    event:
        The ``Event`` document (must have ``template_filename`` set).
    participant:
        The ``Participant`` document (``fields`` dict contains column data).
    qr_b64:
        Base64-encoded PNG of the QR code.
    output_path:
        Absolute path where the final certificate PNG should be saved.
    club_slug:
        Used only for log messages.
    """
    from PIL import Image, ImageDraw
    from ..models.field_position import FieldPosition

    # ── 1. Load template PNG ──────────────────────────────────────────────────
    template_path = _CERT_TMPL_DIR / event.template_filename
    if not template_path.exists():
        raise FileNotFoundError(
            f"Template PNG not found: {template_path}. "
            "Place PNG files in backend/app/static/certificate_templates/"
        )

    img = Image.open(str(template_path)).convert("RGBA")
    draw = ImageDraw.Draw(img)
    img_w, img_h = img.size

    # ── 2. Fetch field positions ───────────────────────────────────────────────
    from beanie import PydanticObjectId
    fp = await FieldPosition.find_one(FieldPosition.event_id == event.id)
    if not fp:
        raise ValueError(
            f"No field positions found for event {event.id}. "
            "Coordinator must place fields before generating certificates."
        )

    # ── 3. Draw text for each field ───────────────────────────────────────────
    font_size = int(img_w * 0.022)   # ~55 px on a 2480 px wide image
    font = _load_font(font_size)

    fields: dict = participant.fields or {}

    for col_header, pos in fp.column_positions.items():
        value = str(fields.get(col_header, ""))
        if not value:
            continue
        x = (pos["x_percent"] / 100) * img_w
        y = (pos["y_percent"] / 100) * img_h
        draw.text((x, y), value, font=font, fill=(30, 30, 30, 255), anchor="mm")

    # ── 4. Overlay QR code ────────────────────────────────────────────────────
    try:
        qr_bytes = base64.b64decode(qr_b64)
        qr_img = Image.open(io.BytesIO(qr_bytes)).convert("RGBA")
        qr_img = qr_img.resize((200, 200), Image.LANCZOS)
        qr_x = int(img_w * 0.80)
        qr_y = int(img_h * 0.88)
        _paste_with_alpha(img, qr_img, (qr_x, qr_y))
    except Exception as exc:
        logger.warning("Could not overlay QR code: %s", exc)

    # ── 5. Overlay logo ───────────────────────────────────────────────────────
    assets = getattr(event, "assets", None)
    if assets and getattr(assets, "logo_path", None):
        logo_path = Path(assets.logo_path)
        if logo_path.exists():
            try:
                logo_img = Image.open(str(logo_path)).convert("RGBA")
                logo_img.thumbnail((180, 180), Image.LANCZOS)
                logo_x = int(img_w * 0.05)
                logo_y = int(img_h * 0.04)
                _paste_with_alpha(img, logo_img, (logo_x, logo_y))
            except Exception as exc:
                logger.warning("Could not overlay logo: %s", exc)

    # ── 6. Overlay signature ──────────────────────────────────────────────────
    if assets and getattr(assets, "signature_path", None):
        sig_path = Path(assets.signature_path)
        if sig_path.exists():
            try:
                sig_img = Image.open(str(sig_path)).convert("RGBA")
                sig_img.thumbnail((220, 80), Image.LANCZOS)
                sig_x = int(img_w * 0.08)
                sig_y = int(img_h * 0.82)
                _paste_with_alpha(img, sig_img, (sig_x, sig_y))
            except Exception as exc:
                logger.warning("Could not overlay signature: %s", exc)

    # ── 7. Save final PNG ─────────────────────────────────────────────────────
    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # Convert to RGB for PNG without alpha if needed
    final_img = img.convert("RGB") if img.mode == "RGBA" else img
    final_img.save(str(out_path), format="PNG", optimize=False)
    logger.info("Generated certificate PNG (Pillow): %s", output_path)
