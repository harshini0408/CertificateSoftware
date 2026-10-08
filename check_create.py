import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\eventsApi.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('useCreateEvent')
if idx != -1:
    print(text[max(0,idx):min(len(text),idx+1000)].encode('ascii','ignore').decode('ascii'))
