path = r'C:\D\CertificateSoftware\backend\app\routers\events.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

old = '''        participant_count=e.participant_count,
        volunteers_required=getattr(e, "volunteers_required", 0) or 0,'''

new = '''        max_participants=getattr(e, "max_participants", None),
        participant_count=e.participant_count,
        volunteers_required=getattr(e, "volunteers_required", 0) or 0,'''

text = text.replace(old, new)
with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
print("Done.")
