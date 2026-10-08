import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Find the max_participants in create event form in club index.jsx
path2 = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\index.jsx'
with open(path2, 'r', encoding='utf-8') as f:
    text2 = f.read()
idx = text2.find('max_participants')
print('max_participants in index.jsx found:', idx != -1)
if idx != -1:
    print(text2[max(0,idx-100):min(len(text2), idx+200)].encode('ascii','ignore').decode('ascii'))
