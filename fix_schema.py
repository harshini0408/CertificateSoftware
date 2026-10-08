path = r'C:\D\CertificateSoftware\backend\app\schemas\event.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix duplicate max_participants in EventResponse - keep only one, right before participant_count
old = '''    mapping_confirmed: bool = False
    max_participants: Optional[int] = None
    max_participants: Optional[int] = None
    participant_count: int = 0
    max_participants: Optional[int] = None
    volunteers_required: int = 0'''

new = '''    mapping_confirmed: bool = False
    max_participants: Optional[int] = None
    participant_count: int = 0
    volunteers_required: int = 0'''

text = text.replace(old, new)
with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
print("Done.")
