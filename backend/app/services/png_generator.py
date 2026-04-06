"""
PNG / Image generation service.

This module uses the Pillow overlay pipeline for image-based templates.
It loads a pre-built PNG from ``static/certificate_templates/`` and overlays
text, logo, and signature at positions saved in the ``field_positions``
collection.

Requirements
------------
* Pillow ≥ 9 (pip install Pillow)
"""

import logging
import asyncio
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ── Static paths ──────────────────────────────────────────────────────────────
_STATIC_DIR    = Path(__file__).parent.parent / "static"
_CERT_TMPL_DIR = _STATIC_DIR / "certificate_templates"
_FONTS_DIR     = _STATIC_DIR / "fonts"
_DEFAULT_FONT  = _FONTS_DIR / "PlayfairDisplay.ttf"

# ══════════════════════════════════════════════════════════════════════════════
# PILLOW OVERLAY PIPELINE — PNG image templates
# ══════════════════════════════════════════════════════════════════════════════

def _load_font(size: int):
    """Load PlayfairDisplay if available, else fall back to the default PIL font."""
    try:
        from PIL import ImageFont
        if _DEFAULT_FONT.exists():
            return ImageFont.truetype(str(_DEFAULT_FONT), size)
        else:
            logger.warning("Font missing: %s. Using default PIL font (very small fallback).", _DEFAULT_FONT)
        return ImageFont.load_default()
    except Exception as exc:
        logger.warning("Error loading font %s: %s", _DEFAULT_FONT, exc)
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
    output_path: str,
    club_slug: str = "default",
    cert_number: str = "",
    cert_type: str = "participant",
) -> None:
    """Overlay text, logo, and signature on a PNG template using Pillow.

    Parameters
    ----------
    event:
        The ``Event`` document (must have ``template_filename`` set).
    participant:
        The ``Participant`` document (``fields`` dict contains column data).
    output_path:
        Absolute path where the final certificate PNG should be saved.
    club_slug:
        Used only for log messages.
    """
    from PIL import Image, ImageDraw
    from ..models.field_position import FieldPosition

    # ── 1. Fetch field positions for this specific cert_type ──────────────────
    fp = await FieldPosition.find_one(
        FieldPosition.event_id == event.id,
        FieldPosition.cert_type == cert_type,
    )
    if not fp:
        # Fallback: try "participant" positions if this cert_type has none
        fp = await FieldPosition.find_one(
            FieldPosition.event_id == event.id,
            FieldPosition.cert_type == "participant",
        )
    if not fp:
        raise ValueError(
            f"No field positions found for event {event.id}, cert_type='{cert_type}'. "
            "Coordinator must configure field positions in the Template Selector before generating."
        )

    # ── 2. Load template PNG from FieldPosition (per cert_type) ──────────────
    template_filename = fp.template_filename
    if not template_filename:
        raise ValueError(
            f"No template_filename in FieldPosition for cert_type='{cert_type}'. "
            "Go to Template Selector and save field positions."
        )
    template_path = _CERT_TMPL_DIR / template_filename
    if not template_path.exists():
        raise FileNotFoundError(
            f"Template PNG not found: {template_path}. "
            f"Expected file: backend/app/static/certificate_templates/{template_filename}"
        )

    # Resolve asset paths once and render in a worker thread because Pillow
    # operations are CPU-bound and block the event loop under load.
    assets = getattr(event, "assets", None)
    logo_path = None
    sig_path = None
    if assets and getattr(assets, "logo_path", None):
        lp = Path(assets.logo_path)
        if lp.exists():
            logo_path = str(lp)
    if assets and getattr(assets, "signature_path", None):
        sp = Path(assets.signature_path)
        if sp.exists():
            sig_path = str(sp)

    await asyncio.to_thread(
        _render_certificate_pillow,
        template_path,
        participant.fields or {},
        fp.column_positions,
        fp.asset_positions or {},
        logo_path,
        sig_path,
        output_path,
        cert_number,
    )


def _render_certificate_pillow(
    template_path: Path,
    fields: dict,
    column_positions: dict,
    asset_positions: dict,
    logo_path: Optional[str],
    sig_path: Optional[str],
    output_path: str,
    cert_number: str,
) -> None:
    from PIL import Image, ImageDraw

    img = Image.open(str(template_path)).convert("RGBA")
    draw = ImageDraw.Draw(img)
    img_w, img_h = img.size

    # DEFAULT_FONT_PERCENT: slightly smaller than the body text for safer first-pass rendering.
    # Override per-field via font_size_percent in column_positions.
    DEFAULT_FONT_PERCENT = 2.7

    for col_header, pos in (column_positions or {}).items():
        value = str((fields or {}).get(col_header, ""))
        if not value:
            continue

        # Per-field font size — coordinator can set this in the UI.
        # Falls back to DEFAULT_FONT_PERCENT if not stored (backward-compatible).
        fsp = float(pos.get("font_size_percent") or DEFAULT_FONT_PERCENT)
        fsp = max(1.0, min(fsp, 8.0))
        field_font_size = max(20, int(img_w * fsp / 100))
        field_font = _load_font(field_font_size)

        x = (pos["x_percent"] / 100) * img_w
        y = (pos["y_percent"] / 100) * img_h
        draw.text((x, y), value, font=field_font, fill=(30, 30, 30, 255), anchor="mm")

    # Certificate number — slightly smaller than body text.
    if cert_number:
        cert_font = _load_font(max(20, int(img_w * 0.025)))
        cert_x = int(img_w * 0.83)
        cert_y = int(img_h * 0.048)
        draw.text((cert_x, cert_y), cert_number, font=cert_font, fill=(44, 61, 127, 255), anchor="lm")

    # ── Assets (placed positions if present) ─────────────────────────────
    def _place_asset(path: str, key: str, fallback_wh: tuple[int, int], fallback_xy: tuple[float, float]):
        try:
            a_img = Image.open(path).convert("RGBA")
            pos = (asset_positions or {}).get(key)
            if pos:
                width_percent = float(pos.get("width_percent", 0) or 0)
                target_w = int((img_w * width_percent / 100.0)) if width_percent > 0 else fallback_wh[0]
                target_w = max(16, target_w)
                ratio = target_w / max(1, a_img.width)
                target_h = max(16, int(a_img.height * ratio))
                a_img = a_img.resize((target_w, target_h), Image.LANCZOS)
                cx = int((float(pos.get("x_percent", 50.0)) / 100.0) * img_w)
                cy = int((float(pos.get("y_percent", 50.0)) / 100.0) * img_h)
                x = cx - (a_img.width // 2)
                y = cy - (a_img.height // 2)
            else:
                a_img.thumbnail(fallback_wh, Image.LANCZOS)
                x = int(img_w * fallback_xy[0])
                y = int(img_h * fallback_xy[1])
            _paste_with_alpha(img, a_img, (x, y))
        except Exception as exc:
            logger.warning("Could not overlay %s: %s", key, exc)

    if logo_path:
        _place_asset(logo_path, "logo", (180, 180), (0.05, 0.04))
    if sig_path:
        _place_asset(sig_path, "signature", (220, 80), (0.08, 0.82))

    # ── Save ──────────────────────────────────────────────────────────────
    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if img.mode == "RGBA":
        background = Image.new("RGB", img.size, "white")
        background.paste(img, mask=img.split()[3])
        final_img = background
    elif img.mode != "RGB":
        final_img = img.convert("RGB")
    else:
        final_img = img
    final_img.save(str(out_path), format="PNG", optimize=False)
    logger.info("Generated certificate PNG (Pillow): %s", output_path)
