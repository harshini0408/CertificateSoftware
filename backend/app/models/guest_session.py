"""GuestSession — per-session wizard state for guest users.

Each call to POST /guest/start-session creates a new document.
Old sessions remain visible in history until expires_at (created_at + 15 days),
at which point the daily scheduler permanently deletes them and their files.
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from beanie import Document, PydanticObjectId
from pydantic import Field


class GuestSession(Document):
    """One certificate-generation session for a guest user."""

    user_id: PydanticObjectId          # FK to User — scopes all data to one guest
    event_name: str                     # Free-text name entered by the guest

    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime               # Set by the endpoint: created_at + 15 days

    # ── Wizard state (mirrors the removed Event guest_* fields) ────────────
    # Absolute path to the uploaded PNG template on disk
    guest_template_path: Optional[str] = None
    # Parsed rows from the uploaded Excel (list of dicts keyed by column header)
    guest_excel_data: Optional[List[Dict[str, Any]]] = None
    # Column headers the guest selected to be printed on certificates
    guest_selected_columns: Optional[List[str]] = None
    # The column header that contains recipient email addresses
    guest_email_column: Optional[str] = None
    # Absolute paths to generated certificate PNGs (one per Excel row)
    guest_generated_certs: Optional[List[str]] = None
    # Whether emails have been sent for this session
    guest_emails_sent: bool = False
    # Per-row email delivery status for the guest session
    guest_email_statuses: Optional[List[Dict[str, Any]]] = None
    # Optional credit allocation for guest certificates
    guest_allocate_points: bool = False
    guest_points_per_cert: int = 0

    class Settings:
        name = "guest_sessions"
