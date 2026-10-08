import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Find the edit form fields area to add max_participants input
idx = text.find('editVenue')
while idx != -1:
    if 'input' in text[idx:idx+200] and 'value={editVenue}' in text[idx:idx+300]:
        print('Found editVenue input at', idx)
        print(text[max(0,idx-100):min(len(text),idx+400)].encode('ascii','ignore').decode('ascii'))
        break
    idx = text.find('editVenue', idx+1)
