"""
Excel parsing utilities for participant import.

Expected Excel columns (case-insensitive, spaces/underscores normalised):
    - Email (required — rows without email are skipped)
    - Role / Certificate Type / Type / cert_type
      (optional — defaults to "participant" if missing)
    - Any other columns are preserved as certificate fields

The Role column value is normalized:
  "Volunteer"  → "volunteer"
  "Winner 1st" → "winner_1st"
  "Coordinator"→ "coordinator"
"""

# pyright: reportMissingImports=false

from io import BytesIO
import importlib
from pathlib import Path
import re
from datetime import date, datetime
from typing import Any, Dict, List, Tuple

# ── Column aliases for cert_type detection ────────────────────────────────────
_CERT_TYPE_ALIASES = {"role", "certificate type", "cert type", "type", "cert_type"}
_ATTACHED_TEMPLATE_NAME = "clubs_certificate_template.xlsx"
_ATTACHED_TEMPLATE_PATH = Path(__file__).resolve().parents[3] / _ATTACHED_TEMPLATE_NAME
_EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_EMAIL_FULL_PATTERN = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def _normalise_key(k: str) -> str:
    """Lower-case + strip for alias matching."""
    return k.lower().strip()


def _compact_key(k: str) -> str:
    """Lower-case and remove non-alphanumerics for tolerant header matching."""
    return "".join(ch for ch in k.lower() if ch.isalnum())


def _looks_like_email(value: str) -> bool:
    """Lightweight email check for parser fallback detection."""
    if not value:
        return False
    v = value.strip()
    return bool(_EMAIL_FULL_PATTERN.match(v))


def _extract_email_from_text(value: str) -> str:
    """Extract first email-like token from arbitrary text/formula content."""
    if not value:
        return ""
    m = _EMAIL_PATTERN.search(value)
    return m.group(0).strip() if m else ""


def _extract_email_from_cell(cell: Any) -> str:
    """Extract email from a cell value or hyperlink target."""
    if cell is None:
        return ""

    value = "" if cell.value is None else str(cell.value).strip()
    if _looks_like_email(value):
        return value

    value_candidate = _extract_email_from_text(value)
    if value_candidate:
        return value_candidate

    hyperlink = getattr(cell, "hyperlink", None)
    if hyperlink:
        target = (getattr(hyperlink, "target", "") or "").strip()
        if target.lower().startswith("mailto:"):
            candidate = target[7:].strip()
            if _looks_like_email(candidate):
                return candidate
            candidate = _extract_email_from_text(candidate)
            if candidate:
                return candidate
        if _looks_like_email(target):
            return target
        target_candidate = _extract_email_from_text(target)
        if target_candidate:
            return target_candidate

    return ""


def _cell_to_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def get_excel_template_filename() -> str:
    """Return template filename used in download response."""
    if _ATTACHED_TEMPLATE_PATH.exists():
        return _ATTACHED_TEMPLATE_NAME
    return "participants_template.xlsx"


async def get_active_role_names() -> List[str]:
    """Return active role labels for Excel dropdown generation."""
    from ..models.role_template_preset import RoleTemplatePreset

    presets = await RoleTemplatePreset.find(RoleTemplatePreset.is_active == True).to_list()
    labels = [p.display_label for p in presets if p.display_label]
    return labels


# ──────────────────────────────────────────────────────────────────────────────
# EXCEL TEMPLATE GENERATION
# ──────────────────────────────────────────────────────────────────────────────
def generate_excel_template(roles: List[str] = None, field_slots: List[str] = None) -> BytesIO:
    """Create a downloadable .xlsx with standard certificate columns.

    Columns:
    - Name
    - Email (REQUIRED)
    - Registration Number
    - Event Name
    - Event Date
    - Role

    Optional:
    - Additional dynamic fields (field_slots)

    Notes:
    - Role = cert_type (participant, volunteer, winner_1st, etc.)
    """

    Workbook = importlib.import_module("openpyxl").Workbook
    Font = importlib.import_module("openpyxl.styles").Font

    if _ATTACHED_TEMPLATE_PATH.exists() and not roles:
        buf = BytesIO(_ATTACHED_TEMPLATE_PATH.read_bytes())
        buf.seek(0)
        return buf

    wb = Workbook()
    ws = wb.active
    ws.title = "Participants"

    headers = ["Name", "Registration Number", "Event Date", "Role", "Email"]

    sample = [
        "John Doe",
        "21CS001",
        "2024-04-01",
        roles[0] if roles else "participant",
        "john@example.com",
    ]

    # Add dynamic fields if provided
    if field_slots:
        for field in field_slots:
            headers.append(field)
            sample.append(f"Sample {field}")

    # Write headers
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = Font(bold=True)

    # Write sample row
    for col, value in enumerate(sample, 1):
        ws.cell(row=2, column=col, value=value)

    # Add Role dropdown in column D.
    if roles:
        DataValidation = importlib.import_module("openpyxl.worksheet.datavalidation").DataValidation
        safe_roles = [r.replace('"', "'") for r in roles if r]
        role_string = ",".join(safe_roles)
        if role_string:
            dv = DataValidation(
                type="list",
                formula1=f'"{role_string}"',
                allow_blank=False,
                showDropDown=False,
            )
            dv.error = "Please select a valid role from the dropdown"
            dv.errorTitle = "Invalid Role"
            dv.prompt = "Select the participant's role"
            dv.promptTitle = "Role"
            ws.add_data_validation(dv)
            dv.sqref = "D2:D10000"

    # Auto-adjust column width
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = max(max_len + 4, 18)

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


# ──────────────────────────────────────────────────────────────────────────────
# EXCEL PARSING
# ──────────────────────────────────────────────────────────────────────────────
def parse_participants_excel(
    file_bytes: bytes,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Parse uploaded Excel and return (valid_rows, errors)."""

    load_workbook = importlib.import_module("openpyxl").load_workbook

    wb = load_workbook(filename=BytesIO(file_bytes), read_only=False)
    ws = wb.active

    rows_iter = ws.iter_rows(values_only=False)
    headers_row = next(rows_iter, None)

    if not headers_row:
        return [], ["Excel file is empty"]

    headers = [str(c.value).strip() if c and c.value is not None else "" for c in headers_row]

    compact_headers = [_compact_key(h) for h in headers]

    email_col_indexes = [
        i
        for i, hk in enumerate(compact_headers)
        if hk == "email"
        or hk.endswith("email")
        or hk.endswith("emailid")
        or "email" in hk
    ]
    reg_col_indexes = [
        i
        for i, hk in enumerate(compact_headers)
        if hk in ("registrationnumber", "regno", "rollno", "rollnumber")
    ]
    name_col_indexes = [
        i
        for i, hk in enumerate(compact_headers)
        if hk in ("name", "studentname", "participantname", "fullname")
    ]

    # Detect cert_type column
    cert_type_col_idx = -1
    for i, h in enumerate(headers):
        if _normalise_key(h) in _CERT_TYPE_ALIASES:
            cert_type_col_idx = i
            break

    parsed: List[Dict[str, Any]] = []
    errors: List[str] = []

    for row_idx, row in enumerate(rows_iter, start=2):
        if all((c is None) or (c.value is None) or (str(c.value).strip() == "") for c in row):
            continue

        record: Dict[str, Any] = {}

        # Map row to headers
        for col_idx, cell in enumerate(row):
            if col_idx < len(headers) and headers[col_idx]:
                record[headers[col_idx]] = _cell_to_text(cell.value if cell is not None else None)

        # Extract important fields
        email = ""
        reg_no = ""
        student_name = ""

        # Prefer index-based extraction derived from headers.
        for idx in email_col_indexes:
            if idx < len(row):
                email = _extract_email_from_cell(row[idx])
                if email:
                    break

        for idx in reg_col_indexes:
            if idx < len(row) and row[idx] is not None and row[idx].value is not None:
                reg_no = _cell_to_text(row[idx].value)
                if reg_no:
                    break

        for idx in name_col_indexes:
            if idx < len(row) and row[idx] is not None and row[idx].value is not None:
                student_name = _cell_to_text(row[idx].value)
                if student_name:
                    break

        # Fallback alias scan for non-standard headers.
        for k, v in record.items():
            kl = _compact_key(k)
            if (not email) and kl in (
                "email", "emailid", "mail", "collegeemailid", "studentemail", "studentemailid"
            ):
                email = v
            elif (not reg_no) and kl in ("registrationnumber", "regno", "rollno", "rollnumber"):
                reg_no = v
            elif (not student_name) and kl in ("name", "studentname", "participantname", "fullname"):
                student_name = v

        # Final fallback: pick first cell in row that looks like an email.
        if not email:
            for cell in row:
                candidate = _extract_email_from_cell(cell)
                if candidate:
                    email = candidate
                    break

        if not email:
            errors.append(f"Row {row_idx}: missing Email — skipped")
            continue

        # Canonical keys expected by downstream flows/UI while preserving original values.
        if student_name and not (record.get("Name") or "").strip():
            record["Name"] = student_name
        if reg_no and not (record.get("Registration Number") or "").strip():
            record["Registration Number"] = reg_no

        # Extract Role → cert_type
        if cert_type_col_idx >= 0 and cert_type_col_idx < len(row):
            raw_role = _cell_to_text(
                row[cert_type_col_idx].value
                if row[cert_type_col_idx] is not None
                else None
            )
        else:
            raw_role = ""

        cert_type = (
            raw_role.lower().replace(" ", "_").replace("-", "_")
            if raw_role
            else "participant"
        )

        # Add system fields
        record["_cert_type"] = cert_type
        record["_email"] = email
        record["_reg_no"] = reg_no

        # Remove reserved fields (not printed on certificate)
        _RESERVED_FIELDS = {
            "email", "email id", "emailid", "mail",
            "role", "certificate type", "certificatetype",
            "cert type", "certtype", "type", "cert_type",
        }

        cleaned_record = {
            k: v
            for k, v in record.items()
            if k.startswith("_")
            or (_normalise_key(k) not in _RESERVED_FIELDS and "email" not in _compact_key(k))
        }

        parsed.append(cleaned_record)

    wb.close()
    return parsed, errors