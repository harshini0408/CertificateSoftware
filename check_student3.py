import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\student\index.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.finditer(r'registration_stopped', text)
for i, m in enumerate(matches):
    start = max(0, m.start() - 100)
    end = min(len(text), m.end() + 100)
    print(f'Match {i}: {text[start:end].encode("ascii", "ignore").decode("ascii")}')
