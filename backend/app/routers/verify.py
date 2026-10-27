from fastapi import APIRouter, HTTPException, Request, status

from ..models.certificate import Certificate, CertStatus
from ..models.scan_log import ScanLog
from ..schemas.certificate import VerifyResponse

router = APIRouter(tags=["Verify"])


@router.get("/verify/{cert_number}", response_model=VerifyResponse)
async def verify_certificate(cert_number: str, request: Request):
    cert = await Certificate.find_one(Certificate.cert_number == cert_number)
    if not cert:
        from ..models.faculty_certificate import FacultyCertificate
        fc = await FacultyCertificate.find_one(FacultyCertificate.cert_number == cert_number)
        if fc:
            await ScanLog(
                certificate_id=fc.id,
                cert_number=cert_number,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            ).insert()
            scan_count = await ScanLog.find(ScanLog.cert_number == cert_number).count()
            return VerifyResponse(
                valid=fc.status in ("generated", "emailed"),
                cert_number=fc.cert_number,
                name=fc.recipient_name,
                participant_name=fc.recipient_name,
                participant_email=fc.recipient_email,
                event_name=fc.event_name,
                club_name="Faculty Event",
                cert_type=fc.cert_type or "Faculty Certificate",
                issued_at=fc.emailed_at or fc.created_at,
                status=fc.status,
                pdf_url=None,
                registration_number=fc.registration_number,
                scan_count=scan_count,
            )
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificate not found")

    # Record scan
    await ScanLog(
        certificate_id=cert.id,
        cert_number=cert_number,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    ).insert()

    # Count total scans for this cert
    scan_count = await ScanLog.find(ScanLog.cert_number == cert_number).count()

    # Determine validity
    is_valid = cert.status in (CertStatus.GENERATED, CertStatus.EMAILED)

    return VerifyResponse(
        valid=is_valid,
        cert_number=cert.cert_number,
        name=getattr(cert.snapshot, "name", "") if cert.snapshot else "",
        participant_name=getattr(cert.snapshot, "name", None) if cert.snapshot else None,
        participant_email=getattr(cert.snapshot, "email", None) if cert.snapshot else None,
        event_name=getattr(cert.snapshot, "event_name", "") if cert.snapshot else "",
        club_name=getattr(cert.snapshot, "club_name", "") if cert.snapshot else "",
        cert_type=getattr(cert.snapshot, "cert_type", "") if cert.snapshot else "",
        event_date=getattr(cert.snapshot, "event_date", None) if cert.snapshot else None,
        issued_date=getattr(cert.snapshot, "issued_date", None) if cert.snapshot else None,
        issued_at=cert.issued_at if hasattr(cert, "issued_at") else None,
        status=cert.status.value,
        pdf_url=getattr(cert, "pdf_url", None),
        registration_number=getattr(cert.snapshot, "registration_number", None) if cert.snapshot else None,
        scan_count=scan_count,
    )
