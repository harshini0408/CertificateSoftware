import sys

path = r'C:\D\CertificateSoftware\backend\app\domains\club\routers.py'

new_endpoint = '''
@router.get("/{club_id}/events/{event_id}/participants/export")
async def export_event_participants(
    club_id: PydanticObjectId,
    event_id: PydanticObjectId,
    _user: User = Depends(require_club_access)
):
    import io
    from fastapi.responses import StreamingResponse
    from openpyxl import Workbook
    from ...models.participant import Participant

    club = await Club.get(club_id)
    if not club:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Club not found")
    
    participants = await Participant.find({"event_id": str(event_id)}).to_list()
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Participants"
    
    headers = ["Name", "Email", "Reg No", "Type", "Source", "Status", "Added On"]
    ws.append(headers)
    
    for p in participants:
        ws.append([
            p.student_name,
            p.student_email,
            p.registration_number or "",
            p.participant_type,
            p.source,
            p.status,
            p.created_at.strftime("%Y-%m-%d %H:%M:%S") if p.created_at else ""
        ])
        
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=participants_{event_id}.xlsx"}
    )
'''

with open(path, 'a', encoding='utf-8') as f:
    f.write("\n" + new_endpoint + "\n")

print("Appended successfully.")
