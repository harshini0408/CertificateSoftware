"""Student Affairs domain — dashboard analytics, event oversight, and report review."""

from datetime import datetime, timedelta
from typing import Optional

from beanie import PydanticObjectId
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from ...core.dependencies import require_role
from ...models.user import User, UserRole
from ...models.club import Club
from ...models.department import Department
from ...models.event import Event, EventStatus
from ...models.dept_event import DeptEvent
from ...models.dept_certificate import DeptCertificate
from ...models.participant import Participant
from ...models.certificate import Certificate, CertStatus
from ...models.student_credit import StudentCredit
from ...models.credit_rule import CreditRule
from ...models.event_registration import EventRegistration

router = APIRouter(prefix="/affairs", tags=["Student Affairs"])

_affairs = Depends(require_role(UserRole.STUDENT_AFFAIRS, UserRole.SUPER_ADMIN))


# ── Helper ───────────────────────────────────────────────────────────────────


def _issued_status_candidates() -> list[str]:
    return [
        CertStatus.GENERATED.value,
        CertStatus.EMAILED.value,
        "GENERATED",
        "EMAILED",
        "CertStatus.GENERATED",
        "CertStatus.EMAILED",
    ]


async def _club_name_map() -> dict[str, str]:
    """Return a {str(club_id): club_name} mapping for all clubs."""
    clubs = await Club.find().to_list()
    return {str(c.id): c.name for c in clubs}


async def _count_activity_points_for_event(event_id: PydanticObjectId) -> int:
    """Sum activity points awarded for a specific event from StudentCredit history."""
    credits = await StudentCredit.find().to_list()
    total = 0
    event_str = str(event_id)
    for sc in credits:
        for entry in sc.credit_history:
            # Match by cert_number prefix or event_name (best-effort)
            pass
    # More efficient: count from Certificate -> CreditRule mapping
    participants = await Participant.find(Participant.event_id == event_id).to_list()
    cert_types = set()
    for p in participants:
        cert_types.add(p.cert_type or "participant")

    rules = await CreditRule.find().to_list()
    rule_map = {}
    for r in rules:
        rule_map[(r.cert_type or "").strip().lower().replace("-", "_").replace(" ", "_")] = r.points

    total = 0
    for p in participants:
        ct = (p.cert_type or "participant").strip().lower().replace("-", "_").replace(" ", "_")
        total += rule_map.get(ct, 0)
    return total


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Live Statistics
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/stats")
async def get_stats(_user: User = _affairs):
    """Live statistics overview for the Student Affairs dashboard."""
    club_events = await Event.find().to_list()
    dept_events = await DeptEvent.find().to_list()

    total_events = len(club_events) + len(dept_events)

    # Total participants across all club events
    total_participants = sum(e.participant_count for e in club_events)
    total_participants += sum(e.participant_count for e in dept_events)

    # Total activity points: sum all StudentCredit total_credits
    all_credits = await StudentCredit.find().to_list()
    total_activity_points = sum(sc.total_credits for sc in all_credits)

    # Upcoming events (next 7 days)
    now = datetime.utcnow()
    next_week = now + timedelta(days=7)
    upcoming_count = await Event.find(
        Event.is_published == True,
        Event.event_date >= now,
        Event.event_date <= next_week,
    ).count()

    # Reports pending review
    pending_reports = await Event.find(
        Event.report_status == "pending_review",
    ).count()

    return {
        "total_events": total_events,
        "total_club_events": len(club_events),
        "total_dept_events": len(dept_events),
        "total_participants": total_participants,
        "total_activity_points": total_activity_points,
        "upcoming_events": upcoming_count,
        "pending_reports": pending_reports,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Club Events Listing (with filters)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/club-events")
async def list_club_events(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    club_id: Optional[str] = None,
    category: Optional[str] = None,
    report_status: Optional[str] = None,
    _user: User = _affairs,
):
    """List completed club events only (conducted events) with optional filters."""
    query: dict = {"status": EventStatus.COMPLETED.value}

    if start_date:
        query.setdefault("event_date", {})["$gte"] = datetime.fromisoformat(start_date)
    if end_date:
        query.setdefault("event_date", {})["$lte"] = datetime.fromisoformat(end_date + "T23:59:59")
    if club_id:
        query["club_id"] = ObjectId(club_id)
    if category:
        query["category"] = {"$regex": f"^{category}$", "$options": "i"}
    if report_status:
        query["report_status"] = report_status

    events = await Event.find(query).sort(-Event.created_at).to_list()
    club_names = await _club_name_map()

    issued_candidates = set(_issued_status_candidates())
    results = []
    for e in events:
        cert_count = await Certificate.find({
            "$or": [{"event_id": ObjectId(str(e.id))}, {"event_id": str(e.id)}],
        }).count()

        cert_generated = cert_count > 0
        activity_points = await _count_activity_points_for_event(e.id)

        results.append({
            "id": str(e.id),
            "name": e.name,
            "description": e.description,
            "club_id": str(e.club_id),
            "club_name": club_names.get(str(e.club_id), "Unknown"),
            "event_date": e.event_date.isoformat() if e.event_date else None,
            "event_time": e.event_time,
            "venue": e.venue,
            "category": e.category,
            "status": e.status.value,
            "participant_count": e.participant_count,
            "cert_count": cert_count,
            "cert_generated": cert_generated,
            "activity_points": activity_points,
            "is_published": e.is_published,
            "poster_url": e.poster_url,
            "report_status": e.report_status or "not_submitted",
            "report_url": e.report_url,
            "report_filename": e.report_filename,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })

    return results


# ═══════════════════════════════════════════════════════════════════════════════
# 3. Club Event Details
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/club-events/{event_id}")
async def get_club_event_detail(event_id: PydanticObjectId, _user: User = _affairs):
    """Detailed event view with participants, activity points, certificates."""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    club = await Club.get(event.club_id)
    club_name = club.name if club else "Unknown"

    # Participants
    participants = await Participant.find(Participant.event_id == event_id).to_list()

    # Credit rules for points calculation
    rules = await CreditRule.find().to_list()
    rule_map = {}
    for r in rules:
        rule_map[(r.cert_type or "").strip().lower().replace("-", "_").replace(" ", "_")] = r.points

    # Certificates
    certs = await Certificate.find({
        "$or": [{"event_id": ObjectId(str(event_id))}, {"event_id": str(event_id)}],
    }).to_list()
    cert_by_participant = {str(c.participant_id): c for c in certs}

    participant_list = []
    total_activity_points = 0
    for p in participants:
        ct = (p.cert_type or "participant").strip().lower().replace("-", "_").replace(" ", "_")
        points = rule_map.get(ct, 0)
        total_activity_points += points

        cert = cert_by_participant.get(str(p.id))
        cert_status_str = None
        cert_number = None
        if cert:
            cert_status_str = getattr(cert.status, "value", str(cert.status))
            cert_number = cert.cert_number

        name = p.fields.get("Name", p.fields.get("name", p.email))
        reg_no = p.registration_number or p.fields.get("Registration Number", p.fields.get("registration_number", ""))

        participant_list.append({
            "id": str(p.id),
            "name": name,
            "email": p.email,
            "registration_number": reg_no,
            "cert_type": p.cert_type,
            "activity_points": points,
            "verified": p.verified,
            "certificate_status": cert_status_str,
            "certificate_number": cert_number,
        })

    return {
        "id": str(event.id),
        "name": event.name,
        "description": event.description,
        "club_id": str(event.club_id),
        "club_name": club_name,
        "event_date": event.event_date.isoformat() if event.event_date else None,
        "event_time": event.event_time,
        "venue": event.venue,
        "category": event.category,
        "status": event.status.value,
        "academic_year": event.academic_year,
        "participant_count": event.participant_count,
        "total_activity_points": total_activity_points,
        "is_published": event.is_published,
        "poster_url": event.poster_url,
        "report_status": event.report_status or "not_submitted",
        "report_url": event.report_url,
        "report_filename": event.report_filename,
        "report_rejection_reason": event.report_rejection_reason,
        "report_uploaded_at": event.report_uploaded_at.isoformat() if event.report_uploaded_at else None,
        "report_reviewed_at": event.report_reviewed_at.isoformat() if event.report_reviewed_at else None,
        "created_at": event.created_at.isoformat() if event.created_at else None,
        "participants": participant_list,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 4. Report Review (Accept / Reject)
# ═══════════════════════════════════════════════════════════════════════════════


class ReportReviewRequest(BaseModel):
    action: str  # "accept" or "reject"
    rejection_reason: Optional[str] = None


@router.post("/club-events/{event_id}/report/review")
async def review_event_report(
    event_id: PydanticObjectId,
    body: ReportReviewRequest,
    _user: User = _affairs,
):
    """Accept or reject a club event report."""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    if event.report_status != "pending_review":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No report pending review for this event")

    if body.action not in ("accept", "reject"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Action must be 'accept' or 'reject'")

    updates = {
        "report_reviewed_at": datetime.utcnow(),
        "report_reviewed_by": str(_user.id),
    }

    if body.action == "accept":
        updates["report_status"] = "accepted"
        updates["report_rejection_reason"] = None
    else:
        updates["report_status"] = "rejected"
        updates["report_rejection_reason"] = body.rejection_reason or "No reason provided"

    await event.set(updates)
    return {
        "message": f"Report {body.action}ed",
        "report_status": updates["report_status"],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 5. Department Events Listing
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/dept-events")
async def list_dept_events(
    department: Optional[str] = None,
    semester: Optional[str] = None,
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    _user: User = _affairs,
):
    """List department events with optional filters."""
    query: dict = {}
    if department:
        query["department"] = {"$regex": f"^{department}$", "$options": "i"}
    if semester:
        query["semester"] = semester
    if start_date:
        query.setdefault("event_date", {})["$gte"] = datetime.fromisoformat(start_date)
    if end_date:
        query.setdefault("event_date", {})["$lte"] = datetime.fromisoformat(end_date + "T23:59:59")

    events = await DeptEvent.find(query).sort(-DeptEvent.created_at).to_list()
    results = []
    for e in events:
        results.append({
            "id": str(e.id),
            "name": e.name,
            "department": e.department,
            "event_date": e.event_date.isoformat() if e.event_date else None,
            "semester": e.semester,
            "status": e.status.value,
            "participant_count": e.participant_count,
            "cert_count": e.cert_count,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })
    return results


@router.get("/dept-events/{event_id}")
async def get_dept_event_detail(event_id: PydanticObjectId, _user: User = _affairs):
    """Detailed view for a department event with participants list."""
    event = await DeptEvent.get(event_id)
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Department event not found")

    # Fetch issued certificates for this dept event to match students
    certs = await DeptCertificate.find(DeptCertificate.event_id == str(event_id)).to_list()
    cert_map = {}
    for c in certs:
        email_key = (c.participant_email or "").strip().lower()
        if email_key:
            cert_map[email_key] = c
        name_key = (c.name or "").strip().lower()
        if name_key and name_key not in cert_map:
            cert_map[name_key] = c

    # Parse students from excel_rows
    students = []
    for idx, row in enumerate(event.excel_rows):
        email = (row.get("Email") or row.get("email") or row.get("Mail") or "").strip().lower()
        name = row.get("Name") or row.get("name") or row.get("Student Name") or f"Student {idx+1}"
        reg_no = row.get("Registration Number") or row.get("registration_number") or row.get("Reg No") or row.get("Roll No") or ""
        role = row.get("Role") or row.get("role") or row.get("Contribution") or row.get("contribution") or "Participant"
        class_name = row.get("Class") or row.get("class") or row.get("Section") or row.get("section") or ""

        cert = cert_map.get(email) or cert_map.get(name.strip().lower())
        cert_number = cert.cert_number if cert else None
        cert_status = "Issued" if (cert and cert.emailed_at) else ("Generated" if cert else "Pending")

        students.append({
            "id": str(idx),
            "name": name,
            "email": email or "—",
            "registration_number": reg_no or "—",
            "class_name": class_name or "—",
            "role": role,
            "certificate_number": cert_number,
            "certificate_status": cert_status,
        })

    return {
        "id": str(event.id),
        "name": event.name,
        "department": event.department,
        "event_date": event.event_date.isoformat() if event.event_date else None,
        "semester": event.semester,
        "status": event.status.value,
        "participant_count": event.participant_count,
        "cert_count": event.cert_count,
        "allocate_points": event.allocate_points,
        "points_per_cert": event.points_per_cert,
        "excel_file_name": event.excel_file_name,
        "created_at": event.created_at.isoformat() if event.created_at else None,
        "students": students,
    }


@router.get("/departments")
async def list_affairs_departments(_user: User = _affairs):
    """List all departments for filters in Student Affairs."""
    depts = await Department.find(Department.is_active == True).to_list()
    dept_names = set(d.name for d in depts)
    dept_events = await DeptEvent.find().to_list()
    for de in dept_events:
        if de.department:
            dept_names.add(de.department)
    return sorted(list(dept_names))


# ═══════════════════════════════════════════════════════════════════════════════
# 6. Activity Rankings
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/rankings")
async def get_rankings(
    limit: int = Query(3, ge=1, le=10),
    _user: User = _affairs,
):
    """Most active clubs and departments based on participation and activity."""
    club_names = await _club_name_map()
    events = await Event.find().to_list()

    # ── Club rankings ─────────────────────────────────────────────────
    club_stats: dict[str, dict] = {}
    for e in events:
        cid = str(e.club_id)
        if cid not in club_stats:
            club_stats[cid] = {
                "club_id": cid,
                "club_name": club_names.get(cid, "Unknown"),
                "event_count": 0,
                "total_participants": 0,
            }
        club_stats[cid]["event_count"] += 1
        club_stats[cid]["total_participants"] += e.participant_count

    # Sort by total_participants desc, then event_count desc
    top_clubs = sorted(
        club_stats.values(),
        key=lambda x: (x["total_participants"], x["event_count"]),
        reverse=True,
    )[:limit]

    # ── Department rankings ───────────────────────────────────────────
    dept_stats: dict[str, dict] = {}
    for de in await DeptEvent.find().to_list():
        dept = de.department or "Unknown"
        if dept not in dept_stats:
            dept_stats[dept] = {
                "department": dept,
                "event_count": 0,
                "total_participants": 0,
                "total_certs": 0,
            }
        dept_stats[dept]["event_count"] += 1
        dept_stats[dept]["total_participants"] += de.participant_count
        dept_stats[dept]["total_certs"] += de.cert_count

    # Also account for student participation across club events by department
    # from StudentCredit records
    all_credits = await StudentCredit.find().to_list()
    for sc in all_credits:
        dept = sc.department or "Unknown"
        if dept not in dept_stats:
            dept_stats[dept] = {
                "department": dept,
                "event_count": 0,
                "total_participants": 0,
                "total_certs": 0,
            }
        dept_stats[dept]["total_participants"] += 1

    top_departments = sorted(
        dept_stats.values(),
        key=lambda x: (x["total_participants"], x["event_count"]),
        reverse=True,
    )[:limit]

    return {
        "top_clubs": top_clubs,
        "top_departments": top_departments,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 7. Upcoming Events
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/upcoming-events")
async def list_upcoming_events(
    club_id: Optional[str] = None,
    category: Optional[str] = None,
    _user: User = _affairs,
):
    """List active/closed club events (visible in upcoming feed — not draft or completed)."""
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)

    # Auto-complete past active/closed events
    past_active = await Event.find({
        "status": {"$in": [EventStatus.ACTIVE.value, EventStatus.CLOSED.value]},
        "event_date": {"$lt": today_start},
    }).to_list()
    for pe in past_active:
        await pe.set({"status": EventStatus.COMPLETED.value})

    query: dict = {
        "status": {"$in": [EventStatus.ACTIVE.value, EventStatus.CLOSED.value]},
        "event_date": {"$gte": today_start},
    }
    if club_id:
        query["club_id"] = ObjectId(club_id)
    if category:
        query["category"] = {"$regex": f"^{category}$", "$options": "i"}

    events = await Event.find(query).sort(+Event.event_date).to_list()
    club_names = await _club_name_map()

    results = []
    for e in events:
        # Count registrations
        total_reg = await EventRegistration.find({"event_id": e.id}).count()
        vol_reg = await EventRegistration.find({
            "event_id": e.id,
            "registration_type": "volunteer",
            "status": {"$ne": "rejected"},
        }).count()
        results.append({
            "id": str(e.id),
            "name": e.name,
            "description": e.description,
            "club_id": str(e.club_id),
            "club_name": club_names.get(str(e.club_id), "Unknown"),
            "event_date": e.event_date.isoformat() if e.event_date else None,
            "event_time": e.event_time,
            "venue": e.venue,
            "category": e.category,
            "poster_url": e.poster_url,
            "status": e.status.value,
            "volunteers_required": getattr(e, "volunteers_required", 0) or 0,
            "registered_count": total_reg,
            "volunteers_registered": vol_reg,
        })
    return results


# ═══════════════════════════════════════════════════════════════════════════════
# 8. Upcoming Event Registrations Detail
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/upcoming-events/{event_id}/registrations")
async def get_upcoming_event_registrations(
    event_id: PydanticObjectId,
    _user: User = _affairs,
):
    """Return participant and volunteer registrations for an upcoming event."""
    event = await Event.get(event_id)
    if not event:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    regs = await EventRegistration.find({"event_id": event_id}).to_list()

    participants = []
    volunteers = []
    for r in regs:
        entry = {
            "id": str(r.id),
            "student_name": r.student_name,
            "student_email": r.student_email,
            "registration_number": r.registration_number or "—",
            "department": r.department or "—",
            "registered_at": r.registered_at.isoformat() if r.registered_at else None,
            "status": r.status,
            "registration_type": r.registration_type,
        }
        if r.registration_type == "volunteer":
            volunteers.append(entry)
        else:
            participants.append(entry)

    return {
        "event_id": str(event.id),
        "event_name": event.name,
        "event_date": event.event_date.isoformat() if event.event_date else None,
        "venue": event.venue,
        "status": event.status.value,
        "volunteers_required": getattr(event, "volunteers_required", 0) or 0,
        "total_participants": len(participants),
        "total_volunteers": len(volunteers),
        "participants": participants,
        "volunteers": volunteers,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 9. Clubs Summary
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/clubs")
async def list_clubs_summary(
    month: Optional[int] = Query(None, description="Month number 1-12"),
    year: Optional[int] = Query(None, description="Year e.g. 2026"),
    _user: User = _affairs,
):
    """List all clubs with event count metrics per month and current semester."""
    now = datetime.utcnow()
    target_month = month or now.month
    target_year = year or now.year

    # Current semester window (rough: ODD=Jul-Dec, EVEN=Jan-Jun)
    if now.month >= 7:
        sem_start = datetime(now.year, 7, 1)
        sem_end = datetime(now.year, 12, 31, 23, 59, 59)
    else:
        sem_start = datetime(now.year, 1, 1)
        sem_end = datetime(now.year, 6, 30, 23, 59, 59)

    month_start = datetime(target_year, target_month, 1)
    if target_month == 12:
        month_end = datetime(target_year + 1, 1, 1)
    else:
        month_end = datetime(target_year, target_month + 1, 1)

    clubs = await Club.find(Club.is_active == True).to_list()
    all_completed = await Event.find({"status": EventStatus.COMPLETED.value}).to_list()

    results = []
    for club in clubs:
        cid = club.id
        club_events = [e for e in all_completed if e.club_id == cid]

        month_events = [
            e for e in club_events
            if e.event_date and month_start <= e.event_date < month_end
        ]
        sem_events = [
            e for e in club_events
            if e.event_date and sem_start <= e.event_date <= sem_end
        ]

        results.append({
            "club_id": str(cid),
            "club_name": club.name,
            "slug": club.slug,
            "events_this_month": len(month_events),
            "events_this_semester": len(sem_events),
            "total_completed_events": len(club_events),
        })

    return results


@router.get("/clubs/{club_id}/events")
async def list_club_completed_events(
    club_id: PydanticObjectId,
    _user: User = _affairs,
):
    """Return all completed events for a specific club with full details."""
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")

    events = await Event.find({
        "club_id": ObjectId(str(club_id)),
        "status": EventStatus.COMPLETED.value,
    }).sort(-Event.event_date).to_list()

    results = []
    for e in events:
        cert_count = await Certificate.find({
            "$or": [{"event_id": ObjectId(str(e.id))}, {"event_id": str(e.id)}],
        }).count()
        results.append({
            "id": str(e.id),
            "name": e.name,
            "event_date": e.event_date.isoformat() if e.event_date else None,
            "venue": e.venue or "—",
            "category": e.category or "—",
            "participant_count": e.participant_count,
            "cert_count": cert_count,
            "cert_generated": cert_count > 0,
            "report_status": e.report_status or "not_submitted",
            "report_url": e.report_url,
            "report_filename": e.report_filename,
        })

    return {
        "club_id": str(club.id),
        "club_name": club.name,
        "events": results,
    }
