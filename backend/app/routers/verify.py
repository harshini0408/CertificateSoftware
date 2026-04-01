from fastapi import APIRouter, HTTPException, Request, status

from ..models.certificate import Certificate, CertStatus
from ..models.scan_log import ScanLog
from ..schemas.certificate import VerifyResponse

router = APIRouter(tags=["Verify"])


@router.get("/verify/{cert_number}", response_model=VerifyResponse)
async def verify_certificate(cert_number: str, request: Request):
    cert = await Certificate.find_one(Certificate.cert_number == cert_number)
    if not cert:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificate not found")

    # Record scan
    await ScanLog(
        certificate_id=cert.id,
        cert_number=cert_number,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    ).insert()

    return VerifyResponse(
        cert_number=cert.cert_number,
        name=cert.snapshot.name,
        event_name=cert.snapshot.event_name,
        club_name=cert.snapshot.club_name,
        cert_type=cert.snapshot.cert_type,
        issued_date=cert.snapshot.issued_date,
        status=cert.status.value,
    )
