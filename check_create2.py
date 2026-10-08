import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\index.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Find create event form submit
idx = text.find('createEvent.mutate')
if idx != -1:
    print(text[max(0,idx-200):min(len(text),idx+400)].encode('ascii','ignore').decode('ascii'))
