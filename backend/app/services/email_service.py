import base64
import os
from datetime import datetime, date
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email import encoders
from pathlib import Path
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

from ..config import get_settings
from ..database import get_database

settings = get_settings()

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

# ── In-memory daily counter ─────────────────────────────────────────────
_daily_count: int = 0
_daily_date: Optional[date] = None


def _reset_counter_if_new_day() -> None:
    global _daily_count, _daily_date
    today = date.today()
    if _daily_date != today:
        _daily_count = 0
        _daily_date = today


def get_daily_sent_count() -> int:
    _reset_counter_if_new_day()
    return _daily_count


def _increment_counter() -> None:
    global _daily_count
    _reset_counter_if_new_day()
    _daily_count += 1


# ── Gmail API auth ───────────────────────────────────────────────────────

def _get_gmail_service():
    creds = None
    token_path = Path(settings.gmail_token_path)
    creds_path = Path(settings.gmail_credentials_path)

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not creds_path.exists():
                raise RuntimeError(
                    f"Gmail credentials file not found at {creds_path}. "
                    "Please set up OAuth2 credentials."
                )
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
            creds = flow.run_local_server(port=0)
        token_path.write_text(creds.to_json())

    return build("gmail", "v1", credentials=creds)


# ── Send email ───────────────────────────────────────────────────────────

async def send_certificate_email(
    recipient_email: str,
    recipient_name: str,
    cert_number: str,
    event_name: str,
    club_name: str,
    png_path: str,
) -> bool:
    """Send a certificate email with the PNG attached.

    Returns True on success, False on failure.
    Daily cap is enforced — returns False if limit reached.
    """
    _reset_counter_if_new_day()

    if _daily_count >= settings.email_daily_limit:
        return False

    try:
        service = _get_gmail_service()

        msg = MIMEMultipart()
        msg["To"] = recipient_email
        msg["From"] = settings.gmail_sender_email
        msg["Subject"] = f"Your Certificate — {event_name} | {club_name}"

        body = (
            f"Dear {recipient_name},\n\n"
            f"Congratulations! Please find your certificate for "
            f'"{event_name}" (organized by {club_name}) attached.\n\n'
            f"Certificate Number: {cert_number}\n"
            f"You can verify this certificate at: "
            f"{settings.base_url}/verify/{cert_number}\n\n"
            f"Regards,\n{club_name}\nPSG iTech Certificate Platform"
        )
        msg.attach(MIMEText(body, "plain"))

        # Attach PNG
        if Path(png_path).exists():
            with open(png_path, "rb") as f:
                part = MIMEBase("image", "png")
                part.set_payload(f.read())
                encoders.encode_base64(part)
                part.add_header(
                    "Content-Disposition",
                    f'attachment; filename="{cert_number}.png"',
                )
                msg.attach(part)

        raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
        service.users().messages().send(
            userId="me", body={"raw": raw}
        ).execute()

        _increment_counter()
        return True

    except Exception:
        return False
