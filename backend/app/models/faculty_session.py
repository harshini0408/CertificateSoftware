"""FacultySession — per-session wizard state for faculty and tutor users.

Saved in separate collection 'faculty_sessions' instead of 'guest_sessions'.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from beanie import Document, PydanticObjectId
from pydantic import Field


class FacultySession(Document):
    """One certificate-generation session for a faculty or tutor user."""

    user_id: PydanticObjectId          # FK to User — scopes all data to one faculty
    event_name: str                    # Free-text name entered by the faculty

    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime               # Set by the endpoint: created_at + 15 days

    # ── Wizard state ─────────────────────────────────────────────────────────
    guest_template_path: Optional[str] = None
    guest_excel_data: Optional[List[Dict[str, Any]]] = None
    guest_selected_columns: Optional[List[str]] = None
    guest_email_column: Optional[str] = None
    guest_generated_certs: Optional[List[str]] = None
    guest_emails_sent: bool = False
    guest_email_statuses: Optional[List[Dict[str, Any]]] = None
    guest_allocate_points: bool = False
    guest_points_per_cert: int = 0

    class Settings:
        name = "faculty_sessions"
