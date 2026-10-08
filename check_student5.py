import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\student\index.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('ev.registration_stopped ?')
if idx != -1:
    print(text[max(0, idx+150):min(len(text), idx+600)].encode("ascii", "ignore").decode("ascii"))
