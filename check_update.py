import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\index.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Check if max_participants is in EventUpdate call
idx = text.find('useUpdateEvent')
if idx != -1:
    print('Found useUpdateEvent at', idx)
    print(text[max(0,idx-200):min(len(text),idx+600)].encode('ascii','ignore').decode('ascii'))
