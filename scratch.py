import sys 
path = r'C:\D\CertificateSoftware\backend\app\domains\student\routers.py' 
with open(path, 'r', encoding='utf-8') as f: 
    content = f.read() 
content = content.replace('if getattr(event, \" "registration_stopped\, False):', 'if getattr(event, \max_participants\, None) is not None and event.participant_count         raise HTTPException(status.HTTP_400_BAD_REQUEST, \Maximum" participants "reached.\)\n\n    if getattr(event, \registration_stopped\, False):') 
with open(path, 'w', encoding='utf-8') as f: 
    f.write(content) 
