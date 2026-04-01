import base64
from datetime import datetime, timedelta
from io import BytesIO
from typing import Any, Dict, List

import qrcode
from jose import jwt

from ..config import get_settings

settings = get_settings()


def generate_qr_base64(data: str) -> str:
    """Create a QR code PNG and return it as a base64-encoded data URI string."""
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


def create_event_qr_token(
    event_id: str,
    custom_fields: List[str],
    duration_hours: int = 24,
) -> str:
    """Create a signed JWT for QR-based event registration."""
    payload: Dict[str, Any] = {
        "event_id": event_id,
        "custom_fields": custom_fields,
        "exp": datetime.utcnow() + timedelta(hours=duration_hours),
        "iat": datetime.utcnow(),
        "type": "qr_register",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_qr_token(token: str) -> Dict[str, Any]:
    """Decode a QR registration token. Raises on expiry / invalid."""
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
