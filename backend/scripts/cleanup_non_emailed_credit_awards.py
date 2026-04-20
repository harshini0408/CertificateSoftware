"""Clean up legacy student credit entries awarded before certificate email.

This script removes credit_history rows linked to Certificate documents whose
status is not EMAILED, then recomputes total_credits.

By default it runs in dry-run mode.

Run:
  cd backend
  ..\\.venv\\Scripts\\python scripts\\cleanup_non_emailed_credit_awards.py
  ..\\.venv\\Scripts\\python scripts\\cleanup_non_emailed_credit_awards.py --apply
"""

import argparse
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.database import connect_db, disconnect_db
from app.models.certificate import Certificate, CertStatus
from app.models.student_credit import StudentCredit


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Remove non-emailed certificate credit entries")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist cleanup changes. Without this flag, runs as dry-run.",
    )
    return parser.parse_args()


async def _status_map_for_numbers(cert_numbers: list[str]) -> dict[str, str]:
    if not cert_numbers:
        return {}
    certs = await Certificate.find({"cert_number": {"$in": cert_numbers}}).to_list()
    return {c.cert_number: c.status.value for c in certs if c and c.cert_number}


async def main() -> None:
    args = _parse_args()
    apply_mode = bool(args.apply)

    await connect_db()
    try:
        docs = await StudentCredit.find_all().to_list()

        docs_changed = 0
        rows_removed = 0
        points_removed = 0
        total_before = 0
        total_after = 0

        for doc in docs:
            history = list(doc.credit_history or [])
            if not history:
                continue

            total_before += sum(int(e.points_awarded or 0) for e in history)

            cert_numbers = sorted({e.cert_number for e in history if getattr(e, "cert_number", None)})
            status_map = await _status_map_for_numbers(cert_numbers)

            new_history = []
            removed_here = 0
            removed_points_here = 0

            for entry in history:
                cert_number = entry.cert_number
                status_value = (status_map.get(cert_number) or "").lower()

                # Keep manual or unmatched legacy rows; remove only rows that map
                # to a certificate explicitly not EMAILED.
                if not status_value:
                    new_history.append(entry)
                    continue

                if status_value != CertStatus.EMAILED.value:
                    removed_here += 1
                    removed_points_here += int(entry.points_awarded or 0)
                    continue

                new_history.append(entry)

            new_total = sum(int(e.points_awarded or 0) for e in new_history)
            total_after += new_total

            if removed_here == 0 and int(doc.total_credits or 0) == new_total:
                continue

            docs_changed += 1
            rows_removed += removed_here
            points_removed += removed_points_here

            who = doc.registration_number or doc.student_email
            print(
                f"[CLEANUP] {who}: removed_rows={removed_here}, "
                f"removed_points={removed_points_here}, new_total={new_total}"
            )

            if apply_mode:
                await doc.set(
                    {
                        "credit_history": new_history,
                        "total_credits": new_total,
                        "last_updated": datetime.now(timezone.utc),
                    }
                )

        mode = "APPLY" if apply_mode else "DRY-RUN"
        print("\n=== Cleanup Summary ===")
        print(f"Mode: {mode}")
        print(f"Students scanned: {len(docs)}")
        print(f"Students changed: {docs_changed}")
        print(f"Rows removed: {rows_removed}")
        print(f"Points removed: {points_removed}")
        print(f"Aggregate points before (history): {total_before}")
        print(f"Aggregate points after  (history): {total_after}")

    finally:
        await disconnect_db()


if __name__ == "__main__":
    asyncio.run(main())
