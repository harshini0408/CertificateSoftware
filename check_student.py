import sys

path = r'C:\D\CertificateSoftware\frontend\src\dashboards\student\index.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('participant_count')
if idx != -1:
    print(text[max(0, idx-200):min(len(text), idx+200)])
