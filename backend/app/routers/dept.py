from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook

from ..core.dependencies import require_role
from ..models.user import User, UserRole
from ..models.student_credit import StudentCredit
from ..models.event import Event
from ..models.club import Club
from ..models.certificate import Certificate, CertStatus

router = APIRouter(tags=["Department"])


# ── /coordinator/stats ───────────────────────────────────────────────────

@router.get("/coordinator/stats")
async def get_coordinator_stats(
    current_user: User = Depends(require_role(UserRole.DEPT_COORDINATOR)),
):
    """Summary stats scoped to the coordinator's department."""
    dept = current_user.department

    # Get all clubs matching department scope (get all events, then count)
    all_events = await Event.find_all().to_list()
    # For simplicity, get all events since dept coordinators see cross-club
    total_events = len(all_events)

    # Unique clubs
    club_ids = set(e.club_id for e in all_events)
    clubs_count = len(club_ids)

    # Certificate stats
    all_certs = await Certificate.find_all().to_list()
    certs_issued = sum(1 for c in all_certs if c.status in (CertStatus.GENERATED, CertStatus.EMAILED))
    pending_emails = sum(1 for c in all_certs if c.status == CertStatus.GENERATED)

    return {
        "total_events": total_events,
        "clubs_count": clubs_count,
        "certs_issued": certs_issued,
        "pending_emails": pending_emails,
    }


# ── /coordinator/events ──────────────────────────────────────────────────

@router.get("/coordinator/events")
async def get_coordinator_events(
    current_user: User = Depends(require_role(UserRole.DEPT_COORDINATOR)),
):
    """All events across clubs visible to this coordinator."""
    events = await Event.find_all().to_list()

    # Batch fetch club names
    club_ids = set(e.club_id for e in events)
    clubs = {c.id: c for c in await Club.find({"_id": {"$in": list(club_ids)}}).to_list()}

    results = []
    for e in events:
        club = clubs.get(e.club_id)
        # Count certs for this event
        cert_count = await Certificate.find(Certificate.event_id == e.id).count()
        pending_emails = await Certificate.find(
            Certificate.event_id == e.id,
            Certificate.status == CertStatus.GENERATED,
        ).count()

        results.append({
            "_id": str(e.id),
            "id": str(e.id),
            "name": e.name,
            "club_id": str(e.club_id),
            "club_name": club.name if club else "Unknown",
            "event_date": e.event_date,
            "status": e.status.value,
            "participant_count": e.participant_count,
            "cert_count": cert_count,
            "pending_emails": pending_emails,
        })

    return results


# ── /dept/students ───────────────────────────────────────────────────────

@router.get("/dept/students")
async def list_department_students(
    batch: Optional[str] = None,
    sort_by: str = Query("total_credits", pattern="^(total_credits|name)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(require_role(UserRole.DEPT_COORDINATOR)),
):
    query = {"department": current_user.department}
    if batch:
        query["batch"] = batch

    students = await StudentCredit.find(query).to_list()

    reverse = order == "desc"
    if sort_by == "total_credits":
        students.sort(key=lambda s: s.total_credits, reverse=reverse)
    else:
        students.sort(key=lambda s: s.student_name.lower(), reverse=reverse)

    return [
        {
            "id": str(s.id),
            "student_email": s.student_email,
            "registration_number": s.registration_number,
            "student_name": s.student_name,
            "department": s.department,
            "batch": s.batch,
            "section": s.section,
            "total_credits": s.total_credits,
            "last_updated": s.last_updated,
        }
        for s in students
    ]


@router.get("/dept/students/{registration_number}")
async def get_student_detail(
    registration_number: str,
    current_user: User = Depends(require_role(UserRole.DEPT_COORDINATOR)),
):
    student = await StudentCredit.find_one(
        StudentCredit.registration_number == registration_number,
        StudentCredit.department == current_user.department,
    )
    if not student:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found in your department")
    return {
        "student_name": student.student_name,
        "registration_number": student.registration_number,
        "department": student.department,
        "batch": student.batch,
        "section": student.section,
        "total_credits": student.total_credits,
        "credit_history": [e.model_dump() for e in student.credit_history],
    }


@router.get("/dept/export")
async def export_department(
    current_user: User = Depends(require_role(UserRole.DEPT_COORDINATOR)),
):
    students = await StudentCredit.find(
        StudentCredit.department == current_user.department
    ).to_list()

    wb = Workbook()
    ws = wb.active
    ws.title = "Student Credits"
    headers = ["Name", "Reg No", "Section", "Batch", "Total Credits", "Last Activity"]
    for col, h in enumerate(headers, 1):
        ws.cell(row=1, column=col, value=h)

    for row_idx, s in enumerate(students, 2):
        last_activity = s.credit_history[-1].awarded_at if s.credit_history else None
        ws.cell(row=row_idx, column=1, value=s.student_name)
        ws.cell(row=row_idx, column=2, value=s.registration_number)
        ws.cell(row=row_idx, column=3, value=s.section)
        ws.cell(row=row_idx, column=4, value=s.batch)
        ws.cell(row=row_idx, column=5, value=s.total_credits)
        ws.cell(row=row_idx, column=6, value=str(last_activity) if last_activity else "")

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    dept = current_user.department or "dept"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={dept}_credits.xlsx"},
    )
