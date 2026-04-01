from io import BytesIO
from typing import Any, Dict, List, Tuple

from openpyxl import Workbook, load_workbook

from ..models.template import FieldSlot


def generate_excel_template(field_slots: List[FieldSlot]) -> BytesIO:
    """Create a downloadable .xlsx with column headers from field_slots
    plus one sample row.
    """
    wb = Workbook()
    ws = wb.active
    ws.title = "Participants"

    headers = [slot.label for slot in field_slots]
    # Always include Email as the first column
    if "Email" not in headers:
        headers.insert(0, "Email")

    for col, header in enumerate(headers, 1):
        ws.cell(row=1, column=col, value=header)

    # Sample row
    for col, header in enumerate(headers, 1):
        ws.cell(row=2, column=col, value=f"sample_{header.lower()}")

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


def parse_participants_excel(
    file_bytes: bytes,
    field_slots: List[FieldSlot],
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Parse an uploaded Excel file and return (rows, errors).

    Each row is a dict mapping column header → cell value.
    Errors list contains human-readable messages for bad rows.
    """
    wb = load_workbook(filename=BytesIO(file_bytes), read_only=True)
    ws = wb.active

    rows_iter = ws.iter_rows(values_only=True)
    headers_row = next(rows_iter, None)
    if not headers_row:
        return [], ["Excel file is empty"]

    headers = [str(h).strip() if h else "" for h in headers_row]
    parsed: List[Dict[str, Any]] = []
    errors: List[str] = []

    for row_idx, row in enumerate(rows_iter, start=2):
        if all(cell is None for cell in row):
            continue
        record: Dict[str, Any] = {}
        for col_idx, cell_value in enumerate(row):
            if col_idx < len(headers):
                record[headers[col_idx]] = str(cell_value).strip() if cell_value else ""
        # Validate email exists
        email = record.get("Email", "").strip()
        if not email:
            errors.append(f"Row {row_idx}: missing Email")
            continue
        parsed.append(record)

    wb.close()
    return parsed, errors
