import secrets
import string
import io
from datetime import datetime
from typing import List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi import File, UploadFile

from ...core.dependencies import require_role
from ...core.security import hash_password
from ...models.user import User, UserRole
from ...models.club import Club
from ...models.event import Event
from ...models.certificate import Certificate, CertStatus
from ...models.email_log import EmailLog, EmailStatus
from ...models.scan_log import ScanLog
from ...models.credit_rule import CreditRule
from ...models.student_credit import StudentCredit
from ...schemas.club import ClubCreate, ClubUpdate, ClubResponse
from ...schemas.credit import CreditRuleSchema, CreditRulesUpdateRequest, CreditRuleResponse
from ...schemas.user import UserCreate, UserUpdate, UserResponse

router = APIRouter(prefix="/admin", tags=["Admin"])

_admin = Depends(require_role(UserRole.SUPER_ADMIN))


# ── Helper: Build UserResponse from User document ────────────────────────────

def _user_response(u: User) -> UserResponse:
    return UserResponse(
        id=str(u.id),
        username=u.username,
        name=u.name,
        email=u.email,
        role=u.role.value,
        is_active=u.is_active,
        created_at=u.created_at,
        club_id=str(u.club_id) if u.club_id else None,
        event_id=str(u.event_id) if u.event_id else None,
        department=u.department,
        registration_number=u.registration_number,
        batch=u.batch,
        section=u.section,
    )


def _club_response(c: Club) -> ClubResponse:
    return ClubResponse(
        id=str(c.id),
        name=c.name,
        slug=c.slug,
        contact_email=c.contact_email or "",
        is_active=c.is_active,
        created_at=c.created_at,
    )


# ═══ CLUBS ═══════════════════════════════════════════════════════════════════


@router.post("/clubs", response_model=ClubResponse, status_code=201)
async def create_club(body: ClubCreate, _user: User = _admin):
    slug_upper = body.slug.upper()
    username = body.coordinator_username.strip()

    if await Club.find_one(Club.slug == slug_upper):
        raise HTTPException(status.HTTP_409_CONFLICT, "Slug already exists")
    if await Club.find_one(Club.contact_email == body.contact_email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already in use")
    if await User.find_one(User.username == username):
        raise HTTPException(status.HTTP_409_CONFLICT, "Coordinator username already taken")
    if await User.find_one(User.email == body.contact_email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Coordinator email already in use")

    club = Club(
        name=body.name,
        slug=slug_upper,
        contact_email=body.contact_email,
    )
    await club.insert()

    coordinator = User(
        username=username,
        name=f"{body.name} Coordinator",
        email=body.contact_email,
        password_hash=hash_password(body.coordinator_password),
        role=UserRole.CLUB_COORDINATOR,
        club_id=club.id,
        is_active=True,
    )
    await coordinator.insert()

    return _club_response(club)


@router.get("/clubs", response_model=List[ClubResponse])
async def list_clubs(
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    _user: User = _admin,
):
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    if search:
        import re
        pattern = re.compile(re.escape(search), re.IGNORECASE)
        query["$or"] = [{"name": pattern}, {"slug": pattern}]

    clubs = await Club.find(query).to_list()
    return [_club_response(c) for c in clubs]


@router.get("/clubs/{club_id}", response_model=ClubResponse)
async def get_club(club_id: PydanticObjectId, _user: User = _admin):
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")
    return _club_response(club)


@router.patch("/clubs/{club_id}", response_model=ClubResponse)
async def update_club(
    club_id: PydanticObjectId,
    body: ClubUpdate,
    _user: User = _admin,
):
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")

    update_data = body.model_dump(exclude_none=True)

    # If deactivating club, cascade to all users belonging to this club
    if update_data.get("is_active") is False and club.is_active is True:
        await User.find(
            User.club_id == club_id,
            User.is_active == True,
        ).update_many({"$set": {"is_active": False}})

    if update_data:
        await club.set(update_data)

    return _club_response(club)


@router.patch("/clubs/{club_id}/toggle-active", response_model=ClubResponse)
async def toggle_club_active(club_id: PydanticObjectId, _user: User = _admin):
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")

    club.is_active = not club.is_active
    if club.is_active is False:
        await User.find(User.club_id == club_id).update_many({"$set": {"is_active": False}})

    await club.save()
    return _club_response(club)


@router.get("/clubs/{club_id}/users", response_model=List[UserResponse])
async def get_club_users(club_id: PydanticObjectId, _user: User = _admin):
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")

    users = await User.find(User.club_id == club_id).to_list()
    return [_user_response(u) for u in users]


# ═══ USERS ═══════════════════════════════════════════════════════════════════


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(body: UserCreate, _user: User = _admin):
    username = body.username.strip()
    email = body.email.strip().lower()
    name = body.name.strip()
    password_input = body.password.strip()

    if len(password_input) < 8:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Password must be at least 8 characters")

    # Uniqueness checks
    if await User.find_one(User.username == username):
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")
    if await User.find_one(User.email == email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already in use")

    # Club validation
    club_oid = None
    if body.club_id and body.role != "guest":
        club_oid = PydanticObjectId(body.club_id)
        club = await Club.get(club_oid)
        if not club or not club.is_active:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                "Club not found or inactive",
            )

    # Event validation
    event_oid = None
    if body.event_id and body.role != "guest":
        event_oid = PydanticObjectId(body.event_id)
        event = await Event.get(event_oid)
        if not event:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
        if club_oid and event.club_id != club_oid:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                "Event does not belong to the specified club",
            )

    # Student registration_number uniqueness
    if body.role == "student" and body.registration_number:
        if await User.find_one(
            User.registration_number == body.registration_number
        ):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                "Registration number already registered",
            )

    new_user = User(
        username=username,
        name=name,
        email=email,
        password_hash=hash_password(password_input),
        role=UserRole(body.role),
        is_active=body.is_active,
        club_id=club_oid,
        event_id=event_oid,
        department=body.department.strip() if body.department and body.role not in ["guest", "club_coordinator"] else None,
        registration_number=body.registration_number.strip() if body.registration_number and body.role not in ["guest", "club_coordinator", "dept_coordinator"] else None,
        batch=body.batch.strip() if body.batch and body.role not in ["guest", "club_coordinator", "dept_coordinator"] else None,
        section=body.section.strip() if body.section and body.role not in ["guest", "club_coordinator", "dept_coordinator"] else None,
    )
    await new_user.insert()

    # Auto-create student_credits doc for students
    if new_user.role == UserRole.STUDENT and body.registration_number:
        existing_credit = await StudentCredit.find_one(
            StudentCredit.student_email == email,
        )
        if not existing_credit:
            await StudentCredit(
                student_email=email,
                registration_number=body.registration_number.strip() if body.registration_number else body.registration_number,
                student_name=name,
                department=body.department.strip() if body.department else body.department,
                batch=body.batch.strip() if body.batch else body.batch,
                section=body.section.strip() if body.section else body.section,
                total_credits=0,
                credit_history=[],
                last_updated=datetime.utcnow(),
            ).insert()

    return _user_response(new_user)


@router.post("/users/bulk-import", status_code=200)
async def bulk_import_students(
    file: UploadFile = File(...),
    _user: User = _admin,
):
    """Import multiple students from an .xlsx file.

    Expected columns (case-insensitive, in any order):
      name, email, username, password, department, registration_number, batch, section

    Returns: { created: int, skipped: int, errors: [ { row: int, reason: str } ] }
    """
    if not file.filename.endswith(".xlsx"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only .xlsx files are accepted")

    import openpyxl
    contents = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
        ws = wb.active
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Could not parse the Excel file. Ensure it is a valid .xlsx.")

    # Read headers from row 1, normalize to lowercase
    header_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), None)
    if not header_row:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Excel file is empty or has no header row")
    headers = [str(h).strip().lower() if h is not None else "" for h in header_row]

    REQUIRED = {"name", "email", "username", "password", "department", "registration_number", "batch", "section"}
    missing = REQUIRED - set(headers)
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Missing required columns: {', '.join(sorted(missing))}. Found: {', '.join(h for h in headers if h)}"
        )

    def col(row_vals, field):
        try:
            idx = headers.index(field)
            v = row_vals[idx]
            return str(v).strip() if v is not None else ""
        except (ValueError, IndexError):
            return ""

    created = 0
    skipped = 0
    errors = []

    for row_idx, row_vals in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        # Skip fully empty rows
        if all(v is None or str(v).strip() == "" for v in row_vals):
            continue

        name      = col(row_vals, "name")
        email     = col(row_vals, "email").lower()
        username  = col(row_vals, "username")
        password  = col(row_vals, "password")
        dept      = col(row_vals, "department")
        reg_no    = col(row_vals, "registration_number")
        batch     = col(row_vals, "batch")
        section   = col(row_vals, "section")

        try:
            # Validate required fields
            missing_fields = [f for f, v in [
                ("name", name), ("email", email), ("username", username),
                ("password", password), ("department", dept),
                ("registration_number", reg_no), ("batch", batch), ("section", section)
            ] if not v]
            if missing_fields:
                raise ValueError(f"Missing: {', '.join(missing_fields)}")

            if len(password) < 8:
                raise ValueError("Password must be at least 8 characters")

            # Uniqueness checks
            if await User.find_one(User.username == username):
                skipped += 1
                errors.append({"row": row_idx, "reason": f"Username '{username}' already exists — skipped"})
                continue
            if await User.find_one(User.email == email):
                skipped += 1
                errors.append({"row": row_idx, "reason": f"Email '{email}' already exists — skipped"})
                continue
            if await User.find_one(User.registration_number == reg_no):
                skipped += 1
                errors.append({"row": row_idx, "reason": f"Registration number '{reg_no}' already exists — skipped"})
                continue

            # Create User
            new_user = User(
                username=username,
                name=name,
                email=email,
                password_hash=hash_password(password),
                role=UserRole.STUDENT,
                is_active=True,
                department=dept,
                registration_number=reg_no,
                batch=batch,
                section=section,
            )
            await new_user.insert()

            # Create StudentCredit doc
            existing_credit = await StudentCredit.find_one(StudentCredit.student_email == email)
            if not existing_credit:
                await StudentCredit(
                    student_email=email,
                    registration_number=reg_no,
                    student_name=name,
                    department=dept,
                    batch=batch,
                    section=section,
                    total_credits=0,
                    credit_history=[],
                    last_updated=datetime.utcnow(),
                ).insert()

            created += 1

        except ValueError as ve:
            errors.append({"row": row_idx, "reason": str(ve)})
        except Exception as exc:
            errors.append({"row": row_idx, "reason": f"Unexpected error: {exc}"})

    return {"created": created, "skipped": skipped, "errors": errors}


@router.get("/users", response_model=List[UserResponse])
async def list_users(
    role: Optional[str] = None,
    club_id: Optional[str] = None,
    department: Optional[str] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    _user: User = _admin,
):
    query = {}
    if role:
        query["role"] = role
    if club_id:
        query["club_id"] = PydanticObjectId(club_id)
    if department:
        query["department"] = department
    if is_active is not None:
        query["is_active"] = is_active
    if search:
        import re
        pattern = re.compile(re.escape(search), re.IGNORECASE)
        query["$or"] = [
            {"name": pattern},
            {"username": pattern},
            {"email": pattern},
        ]

    users = await User.find(query).to_list()
    return [_user_response(u) for u in users]


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: PydanticObjectId, _user: User = _admin):
    target = await User.get(user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return _user_response(target)


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: PydanticObjectId,
    body: UserUpdate,
    _user: User = _admin,
):
    target = await User.get(user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    updates = body.model_dump(exclude_none=True)

    # Username uniqueness check
    if "username" in updates and updates["username"] != target.username:
        if await User.find_one(User.username == updates["username"]):
            raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")

    # Email uniqueness check
    if "email" in updates and updates["email"] != target.email:
        if await User.find_one(User.email == updates["email"]):
            raise HTTPException(status.HTTP_409_CONFLICT, "Email already in use")

    if updates:
        await target.set(updates)

    return _user_response(target)


@router.patch("/users/{user_id}/toggle-active", response_model=UserResponse)
async def toggle_user_active(user_id: PydanticObjectId, _user: User = _admin):
    target = await User.get(user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target.role == UserRole.SUPER_ADMIN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Cannot toggle the super admin account")

    target.is_active = not target.is_active
    await target.save()
    return _user_response(target)


@router.post("/users/{user_id}/reset-password")
async def reset_user_password(user_id: PydanticObjectId, _user: User = _admin):
    target = await User.get(user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    tmp_pw = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
    target.password_hash = hash_password(tmp_pw)
    await target.save()

    return {"message": "Password reset successfully", "temp_password": tmp_pw}


@router.delete("/users/{user_id}")
async def deactivate_user(user_id: PydanticObjectId, _user: User = _admin):
    target = await User.get(user_id)
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if target.role == UserRole.SUPER_ADMIN:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Cannot deactivate the super admin account",
        )

    await target.set({"is_active": False})
    return {"message": "User deactivated successfully"}


# ═══ CERTIFICATES ════════════════════════════════════════════════════════════


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


# ═══ SCAN LOGS ═══════════════════════════════════════════════════════════════


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


@router.get("/activity")
async def recent_activity(_user: User = _admin):
    certs = await Certificate.find_all().sort("-issued_at").limit(20).to_list()

    return [
        {
            "action": "Certificate Issued",
            "actor": cert.snapshot.name if cert.snapshot else "Unknown",
            "target": cert.snapshot.event_name if cert.snapshot else "",
            "cert_number": cert.cert_number,
            "timestamp": cert.issued_at,
            "club_name": cert.snapshot.club_name if cert.snapshot else "",
        }
        for cert in certs
    ]


# ═══ CREDIT RULES ════════════════════════════════════════════════════════════


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


# ═══ PLATFORM STATS ══════════════════════════════════════════════════════════


@router.get("/stats")
async def platform_stats(_user: User = _admin):
    """Return aggregated platform-wide statistics for the admin overview dashboard."""
    from datetime import time as _time

    # Today 00:00:00 UTC — used as the lower bound for "today" counts
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # ── Simple counts ────────────────────────────────────────────────────
    total_clubs = await Club.find(Club.is_active == True).count()
    total_users = await User.find(User.role != UserRole.SUPER_ADMIN).count()
    total_students = await User.find(User.role == UserRole.STUDENT).count()
    total_certificates = await Certificate.find_all().count()

    certificates_today = await Certificate.find(
        {"issued_at": {"$gte": today_start}}
    ).count()

    emails_sent_today = await EmailLog.find(
        {"sent_at": {"$gte": today_start}, "status": EmailStatus.SENT.value}
    ).count()

    # ── Certs per club (aggregation pipeline) ────────────────────────────
    pipeline = [
        {"$group": {"_id": "$club_id", "count": {"$sum": 1}}},
    ]
    raw_groups = await Certificate.aggregate(pipeline).to_list()

    # Build an id → Club lookup to resolve names & slugs
    all_clubs = await Club.find_all().to_list()
    club_map: dict = {str(c.id): c for c in all_clubs}

    certs_per_club = []
    for item in raw_groups:
        club_oid = item.get("_id")
        if not club_oid:
            continue
        club = club_map.get(str(club_oid))
        if club:
            certs_per_club.append(
                {"club_name": club.name, "slug": club.slug, "count": item["count"]}
            )

    # Sort descending by count so the bar chart renders highest bars first
    certs_per_club.sort(key=lambda x: x["count"], reverse=True)

    return {
        "total_clubs": total_clubs,
        "total_users": total_users,
        "total_students": total_students,
        "total_certificates": total_certificates,
        "certificates_today": certificates_today,
        "emails_sent_today": emails_sent_today,
        "certs_per_club": certs_per_club,
    }
