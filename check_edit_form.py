import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Find the Edit Event form area
idx = text.find('handleEditSubmit')
if idx != -1:
    print(text[max(0,idx-300):min(len(text),idx+500)].encode('ascii','ignore').decode('ascii'))
