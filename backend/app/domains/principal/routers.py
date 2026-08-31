import re
from datetime import datetime
from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from ...core.dependencies import require_role
from ...models.user import User, UserRole
from ...models.student_credit import StudentCredit
from ...models.certificate import Certificate, CertStatus
from ...models.club import Club
from ...models.department import Department
from ...models.event import Event, EventStatus
from ...models.dept_event import DeptEvent
from ...models.dept_certificate import DeptCertificate
from ...models.credit_rule import CreditRule
from ...models.manual_credit_submission import ManualCreditSubmission
from ...services.semester_service import get_current_semester
from ...models.student_club_membership import StudentClubMembership, MembershipStatus
from bson import ObjectId

router = APIRouter(prefix="/principal", tags=["Principal"])

_principal = Depends(require_role(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN))


@router.get("/stats")
async def get_principal_stats(_user: User = _principal):
    """Return KPI statistics for the Principal dashboard."""
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    if now.month == 12:
        month_end = datetime(now.year + 1, 1, 1)
    else:
        month_end = datetime(now.year, now.month + 1, 1)

    clubs = await Club.find(Club.is_active == True).to_list()
    depts = await Department.find(Department.is_active == True).to_list()
    dept_names = set(d.name for d in depts)
    all_dept_events = await DeptEvent.find().to_list()
    for de in all_dept_events:
        if de.department:
            dept_names.add(de.department)

    all_completed_club_events = await Event.find({"status": EventStatus.COMPLETED.value}).to_list()

    # Calculate this month's participants across club events and department events
    month_club_participants = sum(
        e.participant_count for e in all_completed_club_events
        if e.event_date and month_start <= e.event_date < month_end
    )
    month_dept_participants = sum(
        e.participant_count for e in all_dept_events
        if e.event_date and month_start <= e.event_date < month_end
    )

    return {
        "total_clubs": len(clubs),
        "total_departments": len(dept_names),
        "club_events_count": len(all_completed_club_events),
        "dept_events_count": len(all_dept_events),
        "this_month_participants": month_club_participants + month_dept_participants,
    }


@router.get("/rankings")
async def get_principal_rankings(
    limit: int = Query(5, ge=1, le=20),
    _user: User = _principal,
):
    """Return top clubs and top departments based on cumulative participants."""
    clubs = await Club.find(Club.is_active == True).to_list()
    club_name_by_id = {str(c.id): c.name for c in clubs}
    completed_club_events = await Event.find({"status": EventStatus.COMPLETED.value}).to_list()

    # Club stats
    club_stats: dict[str, dict] = {}
    for c in clubs:
        cid = str(c.id)
        club_stats[cid] = {
            "club_id": cid,
            "club_name": c.name,
            "event_count": 0,
            "total_participants": 0,
        }

    for e in completed_club_events:
        cid = str(e.club_id)
        if cid not in club_stats:
            club_stats[cid] = {
                "club_id": cid,
                "club_name": club_name_by_id.get(cid, "Unknown"),
                "event_count": 0,
                "total_participants": 0,
            }
        club_stats[cid]["event_count"] += 1
        club_stats[cid]["total_participants"] += (e.participant_count or 0)

    top_clubs = sorted(
        club_stats.values(),
        key=lambda x: (x["total_participants"], x["event_count"]),
        reverse=True,
    )[:limit]

    # Department stats
    dept_stats: dict[str, dict] = {}
    depts = await Department.find(Department.is_active == True).to_list()
    for d in depts:
        dept_stats[d.name] = {
            "department": d.name,
            "event_count": 0,
            "total_participants": 0,
            "total_certs": 0,
        }

    dept_events = await DeptEvent.find().to_list()
    for de in dept_events:
        dept = de.department or "Unknown"
        if dept not in dept_stats:
            dept_stats[dept] = {
                "department": dept,
                "event_count": 0,
                "total_participants": 0,
                "total_certs": 0,
            }
        dept_stats[dept]["event_count"] += 1
        dept_stats[dept]["total_participants"] += (de.participant_count or 0)
        dept_stats[dept]["total_certs"] += (de.cert_count or 0)

    top_departments = sorted(
        dept_stats.values(),
        key=lambda x: (x["total_participants"], x["event_count"]),
        reverse=True,
    )[:limit]

    return {
        "top_clubs": top_clubs,
        "top_departments": top_departments,
    }


@router.get("/clubs")
async def list_principal_clubs(_user: User = _principal):
    """List all clubs with number of events this semester and cumulative participants."""
    now = datetime.utcnow()
    # Current semester window (ODD=Jul-Dec, EVEN=Jan-Jun)
    if now.month >= 7:
        sem_start = datetime(now.year, 7, 1)
        sem_end = datetime(now.year, 12, 31, 23, 59, 59)
    else:
        sem_start = datetime(now.year, 1, 1)
        sem_end = datetime(now.year, 6, 30, 23, 59, 59)

    clubs = await Club.find(Club.is_active == True).to_list()
    all_completed = await Event.find({"status": EventStatus.COMPLETED.value}).to_list()

    results = []
    for club in clubs:
        cid = club.id
        club_events = [e for e in all_completed if e.club_id == cid]
        sem_events = [
            e for e in club_events
            if e.event_date and sem_start <= e.event_date <= sem_end
        ]
        cum_participants = sum((e.participant_count or 0) for e in club_events)

        results.append({
            "club_id": str(cid),
            "club_name": club.name,
            "slug": club.slug,
            "events_this_semester": len(sem_events),
            "cumulative_participants": cum_participants,
            "total_completed_events": len(club_events),
        })

    results.sort(key=lambda x: (x["cumulative_participants"], x["events_this_semester"]), reverse=True)
    return results


@router.get("/clubs/{club_id}/events")
async def list_principal_club_events(club_id: PydanticObjectId, _user: User = _principal):
    """List completed events for a specific club with detailed info."""
    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")

    events = await Event.find({
        "club_id": ObjectId(str(club_id)),
        "status": EventStatus.COMPLETED.value,
    }).sort(-Event.event_date).to_list()

    results = []
    for e in events:
        results.append({
            "id": str(e.id),
            "name": e.name,
            "event_date": e.event_date.isoformat() if e.event_date else None,
            "event_time": e.event_time or "—",
            "venue": e.venue or "—",
            "category": e.category or "—",
            "participant_count": e.participant_count or 0,
            "report_status": e.report_status or "not_submitted",
            "report_url": e.report_url,
            "report_filename": e.report_filename,
            "description": e.description,
        })

    return {
        "club_id": str(club.id),
        "club_name": club.name,
        "events": results,
    }


@router.get("/departments")
async def list_principal_departments(_user: User = _principal):
    """List all departments with ranking, total events conducted, and cumulative participants."""
    depts = await Department.find(Department.is_active == True).to_list()
    dept_names = set(d.name for d in depts)
    all_dept_events = await DeptEvent.find().to_list()
    for de in all_dept_events:
        if de.department:
            dept_names.add(de.department)

    dept_map: dict[str, dict] = {
        name: {
            "department": name,
            "total_events": 0,
            "cumulative_participants": 0,
            "total_certs": 0,
        }
        for name in dept_names
    }

    for de in all_dept_events:
        dept = de.department or "Unknown"
        if dept not in dept_map:
            dept_map[dept] = {
                "department": dept,
                "total_events": 0,
                "cumulative_participants": 0,
                "total_certs": 0,
            }
        dept_map[dept]["total_events"] += 1
        dept_map[dept]["cumulative_participants"] += (de.participant_count or 0)
        dept_map[dept]["total_certs"] += (de.cert_count or 0)

    sorted_depts = sorted(
        dept_map.values(),
        key=lambda x: (x["cumulative_participants"], x["total_events"]),
        reverse=True,
    )

    for idx, item in enumerate(sorted_depts):
        item["rank"] = idx + 1

    return sorted_depts


@router.get("/departments/{department_name}/events")
async def list_principal_dept_events(department_name: str, _user: User = _principal):
    """List all events conducted by a specific department with participants details."""
    dept_events = await DeptEvent.find({
        "department": {"$regex": f"^{re.escape(department_name)}$", "$options": "i"}
    }).sort(-DeptEvent.event_date).to_list()

    results = []
    for de in dept_events:
        # Extract student rows from excel_rows
        students = []
        for idx, row in enumerate(de.excel_rows or []):
            email = (row.get("Email") or row.get("email") or row.get("Mail") or "").strip().lower()
            name = row.get("Name") or row.get("name") or row.get("Student Name") or f"Student {idx+1}"
            reg_no = row.get("Registration Number") or row.get("registration_number") or row.get("Reg No") or row.get("Roll No") or "—"
            role = row.get("Role") or row.get("role") or row.get("Contribution") or row.get("contribution") or "Participant"
            class_name = row.get("Class") or row.get("class") or row.get("Section") or row.get("section") or "—"

            students.append({
                "id": str(idx),
                "name": name,
                "email": email or "—",
                "registration_number": reg_no,
                "class_name": class_name,
                "role": role,
            })

        results.append({
            "id": str(de.id),
            "name": de.name,
            "department": de.department,
            "event_date": de.event_date.isoformat() if de.event_date else None,
            "semester": de.semester,
            "status": de.status.value,
            "participant_count": de.participant_count or 0,
            "cert_count": de.cert_count or 0,
            "excel_file_name": de.excel_file_name,
            "students": students,
        })

    return {
        "department": department_name,
        "events": results,
    }



def _student_summary(user: User, total_credits: int, clubs: list | None = None, office_bearer: str | None = None) -> dict:
    return {
        "id": str(user.id),
        "name": user.name,
        "email": user.email,
        "registration_number": user.registration_number,
        "department": user.department,
        "batch": user.batch,
        "section": user.section,
        "total_credits": int(total_credits or 0),
        "clubs": clubs or [],
        "office_bearer": office_bearer,
    }


def _normalize_cert_type(value: str | None) -> str:
    return (value or "").strip().lower().replace("-", "_").replace(" ", "_")


DEFAULT_ROLE_POINTS: dict[str, int] = {
    "class_representative": 3,
    "club_member": 2,
    "coordinator": 3,
    "first_place": 5,
    "non_technical_participant": 2,
    "office_bearer": 3,
    "organizer": 5,
    "paper_presenter": 3,
    "second_place": 5,
    "student_council_member": 5,
    "student_volunteer": 2,
    "technical_talk": 2,
    "technical_participant": 2,
    "third_place": 5,
    "workshop": 3,
}


@router.get("/students")
async def list_students(
    department: Optional[str] = None,
    batch: Optional[str] = None,
    class_name: Optional[str] = Query(default=None, alias="class"),
    search: Optional[str] = None,
    _user: User = _principal,
):
    query: dict = {
        "role": UserRole.STUDENT,
        "is_active": True,
    }

    if department:
        query["department"] = department.strip()
    if batch:
        query["batch"] = batch.strip()
    if class_name:
        query["section"] = class_name.strip()
    if search:
        text = search.strip()
        if text:
            pattern = re.compile(re.escape(text), re.IGNORECASE)
            query["$or"] = [
                {"name": pattern},
                {"email": pattern},
                {"registration_number": pattern},
            ]

    students = await User.find(query).sort("name").to_list()

    emails = [(s.email or "").strip().lower() for s in students if s.email]
    reg_numbers = [(s.registration_number or "").strip() for s in students if s.registration_number]

    credit_query = {}
    clauses = []
    if emails:
        clauses.append({"student_email": {"$in": emails}})
    if reg_numbers:
        clauses.append({"registration_number": {"$in": reg_numbers}})
    if clauses:
        credit_query["$or"] = clauses

    credits_docs = await StudentCredit.find(credit_query).to_list() if credit_query else []
    credits_by_email = {
        (doc.student_email or "").strip().lower(): int(doc.total_credits or 0)
        for doc in credits_docs
        if doc.student_email
    }
    credits_by_reg = {
        (doc.registration_number or "").strip(): int(doc.total_credits or 0)
        for doc in credits_docs
        if doc.registration_number
    }

    student_ids = [s.id for s in students]
    approved_memberships = await StudentClubMembership.find({
        "student_id": {"$in": student_ids},
        "status": MembershipStatus.APPROVED.value,
    }).to_list() if student_ids else []

    clubs_by_student: dict = {}
    office_bearer_by_student: dict = {}
    for m in approved_memberships:
        clubs_by_student.setdefault(str(m.student_id), []).append(m.club_name or "")
        if m.office_bearer_role:
            office_bearer_by_student[str(m.student_id)] = f"{m.office_bearer_role} ({m.club_name or 'Club'})"

    items = []
    for student in students:
        email_key = (student.email or "").strip().lower()
        reg_key = (student.registration_number or "").strip()
        total_credits = credits_by_email.get(email_key, credits_by_reg.get(reg_key, 0))
        items.append(_student_summary(
            student,
            total_credits,
            clubs=clubs_by_student.get(str(student.id), []),
            office_bearer=office_bearer_by_student.get(str(student.id)),
        ))


    return {
        "count": len(items),
        "items": items,
    }


@router.get("/students/{student_id}/certificates")
async def get_student_certificates(student_id: PydanticObjectId, _user: User = _principal):
    student = await User.get(student_id)
    if not student or student.role != UserRole.STUDENT:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")

    student_email = (student.email or "").strip().lower()
    if not student_email:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Student email is missing")

    generated_certs = await Certificate.find({
        "snapshot.email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"},
    }).sort("-issued_at").to_list()

    manual_submissions = await ManualCreditSubmission.find({
        "student_email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"},
    }).sort("-submitted_at").to_list()

    current_semester = await get_current_semester()
    credit_docs = await StudentCredit.find({
        "$or": [
            {"student_email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"}},
            {"registration_number": student.registration_number} if student.registration_number else {"_id": None},
        ]
    }).to_list()

    credit_history = []
    for doc in credit_docs:
        credit_history.extend(doc.credit_history or [])

    dedup = {}
    for entry in credit_history:
        key = entry.cert_number or f"manual::{entry.awarded_at.isoformat()}::{entry.cert_type}"
        if key not in dedup:
            dedup[key] = entry
    credit_history = list(dedup.values())

    credit_points_by_cert: dict[str, int] = {}
    credit_semester_by_cert: dict[str, str] = {}
    semester_totals: dict[str, int] = {}
    for entry in credit_history:
        if entry.cert_number:
            credit_points_by_cert[entry.cert_number] = int(entry.points_awarded or 0)
            credit_semester_by_cert[entry.cert_number] = entry.semester or "Unknown"
        semester = entry.semester or "Unknown"
        semester_totals[semester] = semester_totals.get(semester, 0) + int(entry.points_awarded or 0)
    total_credits = sum(semester_totals.values())

    certificates = []
    for cert in generated_certs:
        certificates.append(
            {
                "source_type": "generated",
                "cert_number": cert.cert_number,
                "cert_type": cert.snapshot.cert_type if cert.snapshot else "",
                "event_name": cert.snapshot.event_name if cert.snapshot else "",
                "issuer": cert.snapshot.club_name if cert.snapshot else "",
                "status": cert.status.value,
                "issued_at": cert.issued_at,
                "credit_points": int(credit_points_by_cert.get(cert.cert_number, 0)),
                "semester": credit_semester_by_cert.get(cert.cert_number, "Unknown"),
            }
        )

    for submission in manual_submissions:
        certificates.append(
            {
                "source_type": "manual_upload",
                "cert_number": f"STU-MANUAL-{str(submission.id)[-8:].upper()}",
                "cert_type": submission.cert_type,
                "event_name": "Manual Submission",
                "issuer": submission.tutor_email,
                "status": submission.status.value,
                "issued_at": submission.submitted_at,
                "credit_points": int(submission.points_awarded or 0),
                "semester": submission.semester or "Unknown",
            }
        )

    # Get department certificates
    dept_certs = await DeptCertificate.find({
        "participant_email": {"$regex": f"^{re.escape(student_email)}$", "$options": "i"}
    }).to_list()

    for dc in dept_certs:
        certificates.append({
            "source_type": "dept_event",
            "cert_number": dc.cert_number,
            "cert_type": dc.contribution or "Participant",
            "event_name": "Department Event",
            "issuer": dc.department,
            "status": "emailed" if dc.emailed_at else "generated",
            "issued_at": dc.emailed_at or dc.created_at,
            "credit_points": int(credit_points_by_cert.get(dc.cert_number, 0)),
            "certificate_image_url": dc.png_url,
            "semester": credit_semester_by_cert.get(dc.cert_number, "Unknown"),
        })

    certificates.sort(
        key=lambda item: item.get("issued_at") or datetime.min,
        reverse=True,
    )

    return {
        "student": _student_summary(student, int(total_credits)),
        "current_semester": current_semester,
        "semester_totals": [
            {"semester": sem, "total_credits": total}
            for sem, total in sorted(semester_totals.items())
        ],
        "count": len(certificates),
        "certificates": certificates,
    }


@router.get("/events-overview")
async def get_events_overview(
    source_type: Optional[str] = None,
    search: Optional[str] = None,
    _user: User = _principal,
):
    search_pattern = re.compile(re.escape(search.strip()), re.IGNORECASE) if search and search.strip() else None
    source_type_normalized = (source_type or "").strip().lower()

    rows = []

    rules = await CreditRule.find_all().to_list()
    rule_points_by_type = {
        _normalize_cert_type(rule.cert_type): int(rule.points or 0)
        for rule in rules
    }

    def _points_for_type(cert_type: str | None) -> int:
        normalized = _normalize_cert_type(cert_type)
        if not normalized:
            return 0
        if normalized in rule_points_by_type:
            return int(rule_points_by_type[normalized] or 0)
        return int(DEFAULT_ROLE_POINTS.get(normalized, 0))

    include_clubs = source_type_normalized in ("", "club")
    include_departments = source_type_normalized in ("", "department")

    if include_clubs:
        club_events = await Event.find_all().to_list()
        club_ids = list({event.club_id for event in club_events if event.club_id})
        clubs = await Club.find({"_id": {"$in": club_ids}}).to_list() if club_ids else []
        club_name_by_id = {str(club.id): club.name for club in clubs}

        event_ids = [event.id for event in club_events if event.id]
        certificates = await Certificate.find({"event_id": {"$in": event_ids}}).to_list() if event_ids else []
        certs_by_event: dict[str, list[Certificate]] = {}
        for cert in certificates:
            key = str(cert.event_id)
            certs_by_event.setdefault(key, []).append(cert)

        for event in club_events:
            event_certs = certs_by_event.get(str(event.id), [])
            if not event_certs:
                continue
            if any(cert.status != CertStatus.EMAILED for cert in event_certs):
                continue

            participant_map = {}
            for cert in event_certs:
                snapshot = cert.snapshot
                unique_key = "|".join([
                    (snapshot.email or "").strip().lower(),
                    (snapshot.registration_number or "").strip(),
                    (snapshot.name or "").strip().lower(),
                ])
                item = participant_map.get(unique_key)
                if not item:
                    participant_map[unique_key] = {
                        "name": snapshot.name,
                        "email": snapshot.email,
                        "registration_number": snapshot.registration_number,
                        "class_name": None,
                        "contribution": snapshot.cert_type,
                        "allocated_points": _points_for_type(snapshot.cert_type),
                    }
                else:
                    item["allocated_points"] += _points_for_type(snapshot.cert_type)

            participants = list(participant_map.values())
            owner_name = club_name_by_id.get(str(event.club_id), "Club")
            row = {
                "source_type": "club",
                "source_name": owner_name,
                "event_name": event.name,
                "event_date": event.event_date,
                "certificates_count": len(event_certs),
                "participants_count": len(participants),
                "participants": participants,
            }

            if search_pattern:
                haystack = f"{row['event_name']} {row['source_name']}"
                if not search_pattern.search(haystack):
                    continue
            rows.append(row)

    if include_departments:
        dept_events = await DeptEvent.find_all().to_list()
        dept_event_ids = [str(event.id) for event in dept_events if event.id]
        dept_certs = await DeptCertificate.find({"event_id": {"$in": dept_event_ids}}).to_list() if dept_event_ids else []
        certs_by_event: dict[str, list[DeptCertificate]] = {}
        for cert in dept_certs:
            key = str(cert.event_id or "")
            certs_by_event.setdefault(key, []).append(cert)

        for event in dept_events:
            event_certs = certs_by_event.get(str(event.id), [])
            if not event_certs:
                continue
            if any(not cert.emailed_at for cert in event_certs):
                continue

            participant_map = {}
            for cert in event_certs:
                unique_key = "|".join([
                    (cert.participant_email or "").strip().lower(),
                    (cert.name or "").strip().lower(),
                    (cert.class_name or "").strip().lower(),
                ])
                item = participant_map.get(unique_key)
                if not item:
                    participant_map[unique_key] = {
                        "name": cert.name,
                        "email": cert.participant_email,
                        "registration_number": None,
                        "class_name": cert.class_name,
                        "contribution": cert.contribution,
                        "allocated_points": _points_for_type(cert.contribution),
                    }
                else:
                    item["allocated_points"] += _points_for_type(cert.contribution)

            participants = list(participant_map.values())
            row = {
                "source_type": "department",
                "source_name": event.department,
                "event_name": event.name,
                "event_date": event.event_date,
                "certificates_count": len(event_certs),
                "participants_count": len(participants),
                "participants": participants,
            }

            if search_pattern:
                haystack = f"{row['event_name']} {row['source_name']}"
                if not search_pattern.search(haystack):
                    continue
            rows.append(row)

    rows.sort(key=lambda item: item.get("event_date") or datetime.min, reverse=True)
    return {
        "count": len(rows),
        "items": rows,
    }
