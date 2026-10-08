import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('updateEvent.mutate')
if idx != -1:
    print(text[max(0,idx-400):min(len(text),idx+500)].encode('ascii','ignore').decode('ascii'))
