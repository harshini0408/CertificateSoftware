import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\student\index.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('ev.registration_stopped ? (', '(ev.registration_stopped || (ev.max_participants != null && ev.participant_count >= ev.max_participants)) ? (')
text = text.replace('<span>{ev.registered_count || 0} student(s) registered</span>', '')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
print("Done.")
