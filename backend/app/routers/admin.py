from datetime import datetime
from typing import List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..core.dependencies import require_role
from ..core.security import hash_password
from ..models.user import User, UserRole
from ..models.club import Club
from ..models.certificate import Certificate, CertStatus
from ..models.scan_log import ScanLog
from ..models.credit_rule import CreditRule
from ..models.student_credit import StudentCredit
from ..schemas.club import ClubCreate, ClubUpdate, ClubResponse
from ..schemas.credit import CreditRuleSchema, CreditRulesUpdateRequest, CreditRuleResponse
from ..schemas.user import UserCreate, UserUpdate

router = APIRouter(prefix="/admin", tags=["Admin"])

_admin = Depends(require_role(UserRole.SUPER_ADMIN))


# ═══ CLUBS ═══════════════════════════════════════════════════════════════

@router.post("/clubs", response_model=ClubResponse)
async def create_club(body: ClubCreate, _user: User = _admin):
    if await Club.find_one(Club.slug == body.slug):
        raise HTTPException(status.HTTP_409_CONFLICT, "Club slug already exists")
    club = Club(name=body.name, slug=body.slug, contact_email=body.contact_email)
    await club.insert()
    return ClubResponse(id=str(club.id), name=club.name, slug=club.slug,
                        contact_email=club.contact_email, is_active=club.is_active,
                        created_at=club.created_at)


@router.get("/clubs", response_model=List[ClubResponse])
async def list_clubs(_user: User = _admin):
    clubs = await Club.find_all().to_list()
    return [ClubResponse(id=str(c.id), name=c.name, slug=c.slug,
                         contact_email=c.contact_email, is_active=c.is_active,
                         created_at=c.created_at) for c in clubs]


@router.patch("/clubs/{club_id}")
async def update_club(club_id: PydanticObjectId, body: ClubUpdate, _user: User = _admin):
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")
    update_data = body.model_dump(exclude_none=True)
    if update_data:
        await club.set(update_data)
    return {"message": "Club updated"}


# ═══ USERS ═══════════════════════════════════════════════════════════════

@router.post("/users", status_code=201)
async def create_user(body: UserCreate, _user: User = _admin):
    if await User.find_one(User.username == body.username):
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already exists")
    if await User.find_one(User.email == body.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already exists")

    new_user = User(
        username=body.username, name=body.name, email=body.email,
        password_hash=hash_password(body.password),
        role=UserRole(body.role),
        club_id=PydanticObjectId(body.club_id) if body.club_id else None,
        event_id=PydanticObjectId(body.event_id) if body.event_id else None,
        department=body.department,
        registration_number=body.registration_number,
        batch=body.batch, section=body.section,
    )
    await new_user.insert()

    if new_user.role == UserRole.STUDENT and body.registration_number:
        await StudentCredit(
            student_email=body.email,
            registration_number=body.registration_number,
            student_name=body.name, department=body.department,
            batch=body.batch, section=body.section,
        ).insert()

    return {"message": "User created", "user_id": str(new_user.id)}


@router.get("/users")
async def list_users(
    role: Optional[UserRole] = None,
    club_id: Optional[str] = None,
    department: Optional[str] = None,
    is_active: Optional[bool] = None,
    _user: User = _admin,
):
    query = {}
    if role:
        query["role"] = role.value
    if club_id:
        query["club_id"] = PydanticObjectId(club_id)
    if department:
        query["department"] = department
    if is_active is not None:
        query["is_active"] = is_active

    users = await User.find(query).to_list()
    return [
        {
            "id": str(u.id), "username": u.username, "name": u.name,
            "email": u.email, "role": u.role.value, "is_active": u.is_active,
            "club_id": str(u.club_id) if u.club_id else None,
            "department": u.department,
            "registration_number": u.registration_number,
            "batch": u.batch, "section": u.section,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.patch("/users/{user_id}")
async def update_user(
    user_id: PydanticObjectId,
    body: UserUpdate,
    _user: User = _admin,
):
    target = await User.get(user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    updates = body.model_dump(exclude_none=True)
    if updates:
        await target.set(updates)
    return {"message": "User updated"}


# ═══ CERTIFICATES ════════════════════════════════════════════════════════

@router.get("/certificates")
async def list_certificates(
    club_id: Optional[str] = None,
    event_id: Optional[str] = None,
    cert_status: Optional[CertStatus] = Query(None, alias="status"),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _user: User = _admin,
):
    query = {}
    if club_id:
        query["club_id"] = PydanticObjectId(club_id)
    if event_id:
        query["event_id"] = PydanticObjectId(event_id)
    if cert_status:
        query["status"] = cert_status.value
    if date_from or date_to:
        date_q = {}
        if date_from:
            date_q["$gte"] = date_from
        if date_to:
            date_q["$lte"] = date_to
        query["issued_at"] = date_q

    skip = (page - 1) * page_size
    certs = await Certificate.find(query).skip(skip).limit(page_size).to_list()
    total = await Certificate.find(query).count()
    return {"total": total, "page": page, "page_size": page_size, "items": [
        {"id": str(c.id), "cert_number": c.cert_number, "status": c.status.value,
         "snapshot": c.snapshot.model_dump(), "issued_at": c.issued_at}
        for c in certs
    ]}


@router.patch("/certificates/{cert_number}/revoke")
async def revoke_certificate(cert_number: str, admin: User = _admin):
    cert = await Certificate.find_one(Certificate.cert_number == cert_number)
    if not cert:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Certificate not found")
    await cert.set({
        "status": CertStatus.REVOKED,
        "revoked_at": datetime.utcnow(),
        "revoked_by": admin.id,
    })
    return {"message": f"Certificate {cert_number} revoked"}


# ═══ SCAN LOGS ═══════════════════════════════════════════════════════════

@router.get("/scan-logs")
async def list_scan_logs(
    cert_number: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _user: User = _admin,
):
    query = {}
    if cert_number:
        query["cert_number"] = cert_number
    if date_from or date_to:
        date_q = {}
        if date_from:
            date_q["$gte"] = date_from
        if date_to:
            date_q["$lte"] = date_to
        query["scanned_at"] = date_q

    skip = (page - 1) * page_size
    logs = await ScanLog.find(query).skip(skip).limit(page_size).to_list()
    total = await ScanLog.find(query).count()
    return {"total": total, "page": page, "items": [
        {"id": str(l.id), "cert_number": l.cert_number, "ip_address": l.ip_address,
         "user_agent": l.user_agent, "scanned_at": l.scanned_at}
        for l in logs
    ]}


# ═══ CREDIT RULES ════════════════════════════════════════════════════════

@router.get("/credit-rules", response_model=List[CreditRuleResponse])
async def get_credit_rules(_user: User = _admin):
    rules = await CreditRule.find_all().to_list()
    return [CreditRuleResponse(id=str(r.id), cert_type=r.cert_type, points=r.points,
                               updated_by=str(r.updated_by) if r.updated_by else None,
                               updated_at=r.updated_at) for r in rules]


@router.put("/credit-rules")
async def upsert_credit_rules(body: CreditRulesUpdateRequest, admin: User = _admin):
    for rule in body.rules:
        existing = await CreditRule.find_one(CreditRule.cert_type == rule.cert_type)
        if existing:
            await existing.set({"points": rule.points, "updated_by": admin.id,
                                "updated_at": datetime.utcnow()})
        else:
            await CreditRule(cert_type=rule.cert_type, points=rule.points,
                             updated_by=admin.id, updated_at=datetime.utcnow()).insert()
    return {"message": f"{len(body.rules)} credit rules upserted"}
