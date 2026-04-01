from fastapi import APIRouter, Depends

from ..core.dependencies import require_role
from ..models.user import User, UserRole
from ..models.student_credit import StudentCredit

router = APIRouter(prefix="/student", tags=["Student"])


@router.get("/me")
async def get_profile(current_user: User = Depends(require_role(UserRole.STUDENT))):
    return {
        "name": current_user.name,
        "username": current_user.username,
        "email": current_user.email,
        "registration_number": current_user.registration_number,
        "batch": current_user.batch,
        "department": current_user.department,
        "section": current_user.section,
    }


@router.get("/credits")
async def get_credits(current_user: User = Depends(require_role(UserRole.STUDENT))):
    credit_doc = await StudentCredit.find_one(
        StudentCredit.student_email == current_user.email
    )
    if not credit_doc:
        return {"total_credits": 0, "credit_history": []}
    return {
        "total_credits": credit_doc.total_credits,
        "credit_history": [e.model_dump() for e in credit_doc.credit_history],
    }
