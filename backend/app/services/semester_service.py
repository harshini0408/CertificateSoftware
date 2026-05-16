from datetime import datetime
from typing import Optional

from ..models.credit_semester import CreditSemesterState


async def get_current_semester() -> Optional[str]:
    state = await CreditSemesterState.find_one(CreditSemesterState.key == "current")
    return state.current_semester if state else None


async def set_current_semester(semester: str, updated_by: Optional[str] = None) -> CreditSemesterState:
    now = datetime.utcnow()
    state = await CreditSemesterState.find_one(CreditSemesterState.key == "current")
    if state:
        await state.set({
            "current_semester": semester,
            "updated_at": now,
            "updated_by": updated_by,
        })
        return state

    state = CreditSemesterState(
        current_semester=semester,
        updated_at=now,
        updated_by=updated_by,
    )
    await state.insert()
    return state
