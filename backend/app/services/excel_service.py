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
from typing import Any, Dict, List, Tuple

# ── Column aliases for cert_type detection ────────────────────────────────────
_CERT_TYPE_ALIASES = {"role", "certificate type", "cert type", "type", "cert_type"}
_ATTACHED_TEMPLATE_NAME = "clubs_certificate_template.xlsx"
_ATTACHED_TEMPLATE_PATH = Path(__file__).resolve().parents[3] / _ATTACHED_TEMPLATE_NAME


def _normalise_key(k: str) -> str:
    """Lower-case + strip for alias matching."""
    return k.lower().strip()


def get_excel_template_filename() -> str:
    """Return template filename used in download response."""
    if _ATTACHED_TEMPLATE_PATH.exists():
        return _ATTACHED_TEMPLATE_NAME
    return "participants_template.xlsx"


# ──────────────────────────────────────────────────────────────────────────────
# EXCEL TEMPLATE GENERATION
# ──────────────────────────────────────────────────────────────────────────────
def generate_excel_template(field_slots: List[str] = None) -> BytesIO:
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

    if _ATTACHED_TEMPLATE_PATH.exists():
        buf = BytesIO(_ATTACHED_TEMPLATE_PATH.read_bytes())
        buf.seek(0)
        return buf

    wb = Workbook()
    ws = wb.active
    ws.title = "Participants"

    headers = [
        "Name",
        "Email",
        "Registration Number",
        "Event Name",
        "Event Date",
        "Role",
    ]

    sample = [
        "John Doe",
        "john@example.com",
        "21CS001",
        "Tech Symposium 2024",
        "2024-04-01",
        "participant",
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

    # Auto-adjust column width
    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = max(max_len + 4, 14)

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

    wb = load_workbook(filename=BytesIO(file_bytes), read_only=True)
    ws = wb.active

    rows_iter = ws.iter_rows(values_only=True)
    headers_row = next(rows_iter, None)

    if not headers_row:
        return [], ["Excel file is empty"]

    headers = [str(h).strip() if h else "" for h in headers_row]

    # Detect cert_type column
    cert_type_col_idx = -1
    for i, h in enumerate(headers):
        if _normalise_key(h) in _CERT_TYPE_ALIASES:
            cert_type_col_idx = i
            break

    parsed: List[Dict[str, Any]] = []
    errors: List[str] = []

    for row_idx, row in enumerate(rows_iter, start=2):
        if all(cell is None for cell in row):
            continue

        record: Dict[str, Any] = {}

        # Map row to headers
        for col_idx, cell_value in enumerate(row):
            if col_idx < len(headers) and headers[col_idx]:
                record[headers[col_idx]] = (
                    str(cell_value).strip() if cell_value is not None else ""
                )

        # Extract important fields
        email = ""
        reg_no = ""

        for k, v in record.items():
            kl = k.lower().replace(" ", "").replace("_", "")
            if kl in ("email", "emailid", "mail"):
                email = v
            elif kl in ("registrationnumber", "regno", "rollno", "rollnumber"):
                reg_no = v

        if not email:
            errors.append(f"Row {row_idx}: missing Email — skipped")
            continue

        # Extract Role → cert_type
        if cert_type_col_idx >= 0 and cert_type_col_idx < len(row):
            raw_role = (
                str(row[cert_type_col_idx]).strip()
                if row[cert_type_col_idx]
                else ""
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
            if _normalise_key(k) not in _RESERVED_FIELDS
        }

        parsed.append(cleaned_record)

    wb.close()
    return parsed, errors