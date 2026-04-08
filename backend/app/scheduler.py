"""Application scheduler — background jobs via APScheduler.

Jobs:
  1. flush_queued_emails   — runs every day at 00:05 UTC
                             Retries EmailLog records stuck in QUEUED status.
  2. retry_failed_certs    — runs every 30 minutes
                             Re-queues Certificate docs with status=FAILED
                             that have been failed for < MAX_CERT_RETRIES times.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from .models.email_log import EmailLog, EmailStatus
from .models.certificate import Certificate, CertStatus
from .models.guest_session import GuestSession
from .services.email_service import send_certificate_email, get_daily_sent_count
from .services.storage_service import storage_url_to_path
from .services.credit_service import award_credits
from .config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_scheduler: Optional[AsyncIOScheduler] = None

# Maximum times we'll try to re-generate a failed certificate automatically.
MAX_CERT_RETRIES = 3


# ── Job 1: flush queued emails ────────────────────────────────────────────

async def _resume_queued_emails() -> None:
    """Pick up all QUEUED EmailLog rows and retry sending.

    Uses the DB-backed daily count (via get_daily_sent_count_db) so the limit
    is correctly enforced even after a mid-day server restart.
    Runs once per day at 00:05 UTC.
    """
    from .services.email_service import get_daily_sent_count_db
    from pathlib import Path

    logger.info("[SCHEDULER] flush_queued_emails: starting")
    logs = await EmailLog.find(EmailLog.status == EmailStatus.QUEUED).to_list()
    logger.info("[SCHEDULER] Found %d queued emails to process", len(logs))

    sent = 0
    failed = 0

    for log in logs:
        # Re-check the effective daily count on each iteration
        db_count = await get_daily_sent_count_db()
        effective = max(get_daily_sent_count(), db_count)
        if effective >= settings.email_daily_limit:
            logger.info("[SCHEDULER] Daily limit reached (%d) — stopping flush", effective)
            break

        try:
            cert = await Certificate.get(log.certificate_id)
            if not cert or cert.status in (CertStatus.EMAILED, CertStatus.REVOKED):
                await log.set({"status": EmailStatus.SENT})
                continue

            if not cert.png_url:
                continue

            local_path = storage_url_to_path(cert.png_url)
            if not Path(local_path).exists():
                continue

            success = await send_certificate_email(
                recipient_email=log.recipient_email,
                recipient_name=cert.snapshot.name,
                cert_number=cert.cert_number,
                event_name=cert.snapshot.event_name,
                club_name=cert.snapshot.club_name,
                png_path=local_path,
            )

            if success:
                await log.set({
                    "status": EmailStatus.SENT,
                    "sent_at": datetime.utcnow(),
                    "attempt_count": log.attempt_count + 1,
                })
                await cert.set({"status": CertStatus.EMAILED})
                await award_credits(cert)
                sent += 1
            else:
                attempt = log.attempt_count + 1
                if attempt >= 3:
                    await log.set({
                        "status": EmailStatus.FAILED,
                        "attempt_count": attempt,
                        "error_msg": "Max retries exceeded",
                    })
                    await cert.set({"status": CertStatus.FAILED})
                    failed += 1
                else:
                    await log.set({"attempt_count": attempt})

            await asyncio.sleep(4)   # rate-limit SMTP sends

        except Exception as exc:
            logger.exception("[SCHEDULER] flush error for log %s: %s", log.id, exc)
            failed += 1

    logger.info(
        "[SCHEDULER] flush_queued_emails: done — sent=%d, failed=%d", sent, failed
    )


# ── Job 2: retry failed certificates ─────────────────────────────────────

async def _retry_failed_certs() -> None:
    """Re-queue certificates stuck in FAILED status for regeneration.

    Only re-queues if the cert has fewer than MAX_CERT_RETRIES EmailLog
    FAILED entries (which act as the retry counter for generation failures).
    Runs every 30 minutes.
    """
    from .routers.certificates import _generate_one_limited  # type: ignore[attr-defined]

    logger.info("[SCHEDULER] retry_failed_certs: starting")

    failed_certs = await Certificate.find(
        Certificate.status == CertStatus.FAILED,
    ).to_list()

    requeued = 0
    skipped = 0

    for cert in failed_certs:
        try:
            # Use EmailLog FAILED count as retry counter
            failure_count = await EmailLog.find(
                EmailLog.certificate_id == cert.id,
                EmailLog.status == EmailStatus.FAILED,
            ).count()

            if failure_count >= MAX_CERT_RETRIES:
                skipped += 1
                continue

            # Reset and re-queue
            await cert.set({
                "status": CertStatus.PENDING,
                "issued_at": None,
                "png_url": None,
            })
            asyncio.create_task(_generate_one_limited(cert.id))
            requeued += 1

        except Exception as exc:
            logger.exception(
                "[SCHEDULER] retry error for cert %s: %s", cert.cert_number, exc
            )

    logger.info(
        "[SCHEDULER] retry_failed_certs: done — requeued=%d, skipped=%d",
        requeued, skipped,
    )


# ── Job 3: cleanup expired guest sessions ────────────────────────────────────

async def _cleanup_expired_guest_sessions() -> None:
    """Permanently delete expired GuestSession documents and their files.

    A session is expired when expires_at <= now (i.e. 15 days have passed).
    Both the certificate PNG files and the template PNG are removed from disk
    before the MongoDB document is deleted.
    Runs once every 24 hours.
    """
    from pathlib import Path as _Path

    now = datetime.utcnow()
    expired = await GuestSession.find(
        GuestSession.expires_at <= now,
    ).to_list()

    logger.info("[SCHEDULER] cleanup_expired_guest_sessions: found %d expired session(s)", len(expired))

    for session in expired:
        # 1. Delete generated certificate PNGs
        for path_str in (session.guest_generated_certs or []):
            p = _Path(path_str)
            if p.exists():
                try:
                    p.unlink()
                except Exception as exc:
                    logger.warning("[SCHEDULER] Could not delete cert file %s: %s", path_str, exc)

        # 2. Delete template PNG
        if session.guest_template_path:
            p = _Path(session.guest_template_path)
            if p.exists():
                try:
                    p.unlink()
                except Exception as exc:
                    logger.warning("[SCHEDULER] Could not delete template %s: %s", session.guest_template_path, exc)

        # 3. Delete DB document
        await session.delete()

    logger.info("[SCHEDULER] cleanup_expired_guest_sessions: cleaned up %d session(s)", len(expired))


# ── Public API ────────────────────────────────────────────────────────────

def start_scheduler() -> None:
    """Start the APScheduler background scheduler.

    Called from the FastAPI lifespan startup.
    """
    global _scheduler

    _scheduler = AsyncIOScheduler(timezone="UTC")

    # Job 1: flush queued emails daily at 00:05 UTC
    _scheduler.add_job(
        _resume_queued_emails,
        trigger="cron",
        hour=0,
        minute=5,
        id="resume_queued_emails",
        name="Flush queued emails",
        replace_existing=True,
        misfire_grace_time=300,
    )

    # Job 2: retry failed certificate generation every 30 minutes
    _scheduler.add_job(
        _retry_failed_certs,
        trigger=IntervalTrigger(minutes=30),
        id="retry_failed_certs",
        name="Retry failed certificate generation",
        replace_existing=True,
        misfire_grace_time=60,
    )

    # Job 3: cleanup expired guest sessions every 24 hours
    _scheduler.add_job(
        _cleanup_expired_guest_sessions,
        trigger=IntervalTrigger(hours=24),
        id="cleanup_expired_guest_sessions",
        name="Cleanup expired guest sessions",
        replace_existing=True,
        misfire_grace_time=300,
    )

    _scheduler.start()
    logger.info("[SCHEDULER] Started with %d job(s)", len(_scheduler.get_jobs()))


def stop_scheduler() -> None:
    """Gracefully stop the scheduler.

    Called from the FastAPI lifespan shutdown.
    """
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[SCHEDULER] Stopped")
    _scheduler = None
