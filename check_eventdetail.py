import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.finditer(r'<h3 className=\"text-sm font-bold text-navy\">Participant', text)
for i, m in enumerate(matches):
    start = max(0, m.start() - 200)
    end = min(len(text), m.end() + 200)
    print(f'Match {i}: {text[start:end].encode("ascii", "ignore").decode("ascii")}')
