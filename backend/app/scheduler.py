import asyncio
from datetime import datetime
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .models.email_log import EmailLog, EmailStatus
from .models.certificate import Certificate, CertStatus
from .services.email_service import send_certificate_email, get_daily_sent_count
from .services.storage_service import storage_url_to_path
from .services.credit_service import award_credits
from .config import get_settings

settings = get_settings()

_scheduler: Optional[AsyncIOScheduler] = None


async def _resume_queued_emails() -> None:
    """Pick up all queued email_logs and resume sending in batches."""
    logs = await EmailLog.find(
        EmailLog.status == EmailStatus.QUEUED,
    ).to_list()

    print(f"[SCHEDULER] Found {len(logs)} queued emails to process")

    for log in logs:
        daily = get_daily_sent_count()
        if daily >= settings.email_daily_limit:
            print(f"[SCHEDULER] Daily limit reached ({daily}), stopping")
            break

        cert = await Certificate.get(log.certificate_id)
        if not cert or cert.status == CertStatus.EMAILED:
            await log.set({"status": EmailStatus.SENT})
            continue

        sent = await send_certificate_email(
            recipient_email=log.recipient_email,
            recipient_name=cert.snapshot.name,
            cert_number=cert.cert_number,
            event_name=cert.snapshot.event_name,
            club_name=cert.snapshot.club_name,
            png_path=storage_url_to_path(cert.png_url or ""),
        )

        if sent:
            await log.set({"status": EmailStatus.SENT, "sent_at": datetime.utcnow()})
            await cert.set({"status": CertStatus.EMAILED})
            await award_credits(cert)
        else:
            attempt = log.attempt_count + 1
            if attempt >= 3:
                await log.set({
                    "status": EmailStatus.FAILED,
                    "attempt_count": attempt,
                    "error_msg": "Max retries exceeded",
                })
                await cert.set({"status": CertStatus.FAILED})
            else:
                await log.set({"attempt_count": attempt})

        await asyncio.sleep(4)


def start_scheduler() -> None:
    global _scheduler
    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _resume_queued_emails,
        trigger="cron",
        hour=0,
        minute=5,
        id="resume_queued_emails",
        replace_existing=True,
    )
    _scheduler.start()


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
