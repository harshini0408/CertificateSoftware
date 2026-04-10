from datetime import datetime
import re

from ..models.certificate import Certificate
from ..models.credit_rule import CreditRule
from ..models.student_credit import CreditHistoryEntry, StudentCredit


async def award_credits(certificate: Certificate) -> None:
    """Look up the credit rule for this cert_type and award points
    to the student's credit ledger.

    If no rule exists for the cert_type, this is a no-op.
    """
    cert_type_raw = (certificate.snapshot.cert_type or "").strip()
    cert_type_normalized = cert_type_raw.lower().replace("-", "_").replace(" ", "_")
    cert_type_spaced = cert_type_normalized.replace("_", " ")
    cert_type_display = cert_type_normalized.replace("_", " ").title() if cert_type_normalized else cert_type_raw

    rule = await CreditRule.find_one({
        "$or": [
            {"cert_type": {"$in": [
                cert_type_raw,
                cert_type_normalized,
                cert_type_spaced,
                cert_type_display,
            ]}},
            {"cert_type": {"$regex": f"^{re.escape(cert_type_raw)}$", "$options": "i"}},
            {"cert_type": {"$regex": f"^{re.escape(cert_type_normalized)}$", "$options": "i"}},
            {"cert_type": {"$regex": f"^{re.escape(cert_type_spaced)}$", "$options": "i"}},
        ]
    })
    if not rule or rule.points <= 0:
        return

    email = (certificate.snapshot.email or "").strip().lower()
    if not email:
        return

    credit_doc = await StudentCredit.find_one(
        StudentCredit.student_email == email,
    )

    entry = CreditHistoryEntry(
        cert_number=certificate.cert_number,
        event_name=certificate.snapshot.event_name,
        club_name=certificate.snapshot.club_name,
        cert_type=certificate.snapshot.cert_type,
        points_awarded=rule.points,
        awarded_at=datetime.utcnow(),
    )

    if credit_doc:
        if any(h.cert_number == certificate.cert_number for h in credit_doc.credit_history):
            return
        credit_doc.total_credits += rule.points
        credit_doc.credit_history.append(entry)
        credit_doc.last_updated = datetime.utcnow()
        await credit_doc.save()
    else:
        await StudentCredit(
            student_email=email,
            registration_number=certificate.snapshot.registration_number or None,
            student_name=certificate.snapshot.name,
            department=None,
            batch=None,
            section=None,
            total_credits=rule.points,
            credit_history=[entry],
            last_updated=datetime.utcnow(),
        ).insert()
