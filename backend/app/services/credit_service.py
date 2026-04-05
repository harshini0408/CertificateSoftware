from datetime import datetime

from ..models.certificate import Certificate
from ..models.credit_rule import CreditRule
from ..models.student_credit import CreditHistoryEntry, StudentCredit


async def award_credits(certificate: Certificate) -> None:
    """Look up the credit rule for this cert_type and award points
    to the student's credit ledger.

    If no rule exists for the cert_type, this is a no-op.
    """
    rule = await CreditRule.find_one(
        CreditRule.cert_type == certificate.snapshot.cert_type
    )
    if not rule or rule.points <= 0:
        return

    email = certificate.snapshot.email
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
