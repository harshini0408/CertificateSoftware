import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\index.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = list(re.finditer(r'volunteers_required', text))
for m in matches:
    start = max(0, m.start()-200)
    end = min(len(text), m.end()+200)
    print(text[start:end].encode('ascii','ignore').decode('ascii'))
    print('---')
