from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook

from ..core.dependencies import require_role
from ..models.user import User, UserRole
from ..models.student_credit import StudentCredit

router = APIRouter(prefix="/dept", tags=["Department"])


@router.get("/students")
async def list_department_students(
    batch: Optional[str] = None,
    sort_by: str = Query("total_credits", regex="^(total_credits|name)$"),
    order: str = Query("desc", regex="^(asc|desc)$"),
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


@router.get("/students/{registration_number}")
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


@router.get("/export")
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
