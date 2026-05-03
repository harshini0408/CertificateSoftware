"""Email service — SMTP-based email delivery for certificate dispatch.

Supports multiple providers via configuration:
  - gmail_smtp : Gmail with App Password (no OAuth popups)
  - brevo      : Brevo (Sendinblue) SMTP relay
  - console    : Prints emails to stdout (development)
"""

import asyncio
import base64
import logging
import smtplib
from abc import ABC, abstractmethod
from datetime import date
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional

from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


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


async def get_daily_sent_count_db() -> int:
    """Count emails actually sent today by querying EmailLog.

    This is the authoritative count — it survives server restarts.
    Use max(in-memory, db) so the cap is never exceeded even after a crash.
    """
    from datetime import datetime
    from ..models.email_log import EmailLog, EmailStatus

    today_start = datetime.combine(date.today(), datetime.min.time())
    try:
        db_count = await EmailLog.find(
            EmailLog.status == EmailStatus.SENT,
            EmailLog.sent_at >= today_start,
        ).count()
        return db_count
    except Exception:
        return 0


def _increment_counter() -> None:
    global _daily_count
    _reset_counter_if_new_day()
    _daily_count += 1


# ── Abstract provider ───────────────────────────────────────────────────

class EmailProvider(ABC):
    """Abstract email provider interface."""

    @abstractmethod
    def send(self, msg: MIMEMultipart) -> bool:
        """Send a MIME message. Returns True on success."""
        ...


class SMTPProvider(EmailProvider):
    """Generic SMTP sender (works for Gmail App Password, Brevo, etc.)."""

    def __init__(self, host: str, port: int, user: str, password: str, use_tls: bool = True):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.use_tls = use_tls

    def send(self, msg: MIMEMultipart) -> bool:
        try:
            with smtplib.SMTP(self.host, self.port, timeout=30) as server:
                if self.use_tls:
                    server.starttls()
                if self.user and self.password:
                    server.login(self.user, self.password)
                server.send_message(msg)
            return True
        except Exception as exc:
            logger.error("SMTP send failed: %s", exc)
            return False


class ConsoleProvider(EmailProvider):
    """Development-only provider that logs emails to console."""

    def send(self, msg: MIMEMultipart) -> bool:
        logger.info(
            "[EMAIL-DEV] To=%s | Subject=%s | Attachments=%d",
            msg["To"],
            msg["Subject"],
            sum(1 for p in msg.walk() if p.get_content_disposition() == "attachment"),
        )
        print(f"  📧 DEV EMAIL → {msg['To']}: {msg['Subject']}")
        return True


# ── Provider factory ─────────────────────────────────────────────────────

_provider_instance: Optional[EmailProvider] = None


def get_email_provider() -> EmailProvider:
    """Return the configured email provider singleton."""
    global _provider_instance
    if _provider_instance is not None:
        return _provider_instance

    provider = settings.email_provider

    if provider == "gmail_smtp":
        _provider_instance = SMTPProvider(
            host="smtp.gmail.com",
            port=587,
            user=settings.smtp_user,
            password=settings.smtp_password,
        )
    elif provider == "brevo":
        _provider_instance = SMTPProvider(
            host="smtp-relay.brevo.com",
            port=587,
            user=settings.smtp_user,
            password=settings.smtp_password,
        )
    elif provider == "console":
        _provider_instance = ConsoleProvider()
    else:
        # Fallback: use generic SMTP settings from config
        _provider_instance = SMTPProvider(
            host=settings.smtp_host,
            port=settings.smtp_port,
            user=settings.smtp_user,
            password=settings.smtp_password,
        )

    logger.info("Email provider initialized: %s", provider)
    return _provider_instance


# ── Build email message ──────────────────────────────────────────────────

def _build_certificate_email(
    recipient_email: str,
    recipient_name: str,
    cert_number: str,
    event_name: str,
    club_name: str,
    png_path: str,
) -> MIMEMultipart:
    """Construct a MIME message with certificate PNG attachment."""
    msg = MIMEMultipart()
    msg["To"] = recipient_email
    msg["From"] = f"{settings.email_sender_name} <{settings.email_sender}>"
    msg["Subject"] = f"Your Certificate for {event_name}"

    body = (
        "Please find the attached certificate.\n"
        "Thank you.\n"
        "With regards,\n"
        "PSG iTech"
    )
    msg.attach(MIMEText(body, "plain"))

    # Attach PNG certificate image
    png = Path(png_path)
    if png.exists():
        with open(png, "rb") as f:
            part = MIMEBase("image", "png")
            part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f'attachment; filename="{cert_number}.png"',
            )
            # Also embed inline so email clients can preview it
            part.add_header("Content-ID", f"<certificate_{cert_number}>")
            msg.attach(part)
        logger.info("Attached certificate PNG: %s", png_path)
    else:
        logger.error(
            "Certificate PNG not found for attachment — cert: %s, path: %s",
            cert_number, png_path,
        )

    return msg


# ── Public API ───────────────────────────────────────────────────────────

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
    Daily cap is enforced using the MAX of the in-memory counter and the
    DB-backed count so the limit holds even after server restarts.
    """
    global _daily_count
    _reset_counter_if_new_day()

    # Use the higher of in-memory vs DB count to survive restarts
    in_mem = _daily_count
    db_count = await get_daily_sent_count_db()
    effective_count = max(in_mem, db_count)
    # Sync in-memory if DB is ahead (post-restart)
    if db_count > _daily_count:
        _daily_count = db_count

    if effective_count >= settings.email_daily_limit:
        logger.warning("Daily email limit (%d) reached", settings.email_daily_limit)
        return False

    try:
        msg = _build_certificate_email(
            recipient_email, recipient_name, cert_number,
            event_name, club_name, png_path,
        )
        provider = get_email_provider()
        # Run blocking SMTP in a thread so it doesn't block the event loop
        loop = asyncio.get_event_loop()
        success = await loop.run_in_executor(None, provider.send, msg)

        if success:
            _increment_counter()

        return success

    except Exception as exc:
        logger.error("send_certificate_email failed: %s", exc)
        return False


async def send_otp_email(recipient_email: str, otp_code: str) -> bool:
    """Send password-reset OTP email."""
    try:
        msg = MIMEMultipart()
        msg["To"] = recipient_email
        msg["From"] = f"{settings.email_sender_name} <{settings.email_sender}>"
        msg["Subject"] = "Password Reset OTP"

        body = (
            f"Your OTP for password reset is: {otp_code}\n"
            "This code will expire in 10 minutes.\n"
            "If you did not request this, please ignore this email."
        )
        msg.attach(MIMEText(body, "plain"))

        provider = get_email_provider()
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, provider.send, msg)
    except Exception as exc:
        logger.error("send_otp_email failed: %s", exc)
        return False


async def send_department_password_otp_email(recipient_email: str, otp_code: str) -> bool:
    """Send department password-change OTP email."""
    try:
        msg = MIMEMultipart()
        msg["To"] = recipient_email
        msg["From"] = f"{settings.email_sender_name} <{settings.email_sender}>"
        msg["Subject"] = "Department Password Change OTP"

        body = (
            f"Your OTP for department password change is: {otp_code}\n"
            "This code will expire in 10 minutes.\n"
            "If you did not request this, please ignore this email."
        )
        msg.attach(MIMEText(body, "plain"))

        provider = get_email_provider()
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, provider.send, msg)
    except Exception as exc:
        logger.error("send_department_password_otp_email failed: %s", exc)
        return False
