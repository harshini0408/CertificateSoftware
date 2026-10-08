import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Check that our patch landed
idx = text.find('handleExport')
print('handleExport found:', idx != -1)
if idx != -1:
    print(text[max(0,idx-20):min(len(text),idx+300)].encode('ascii','ignore').decode('ascii'))
