import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Find the edit form UI
idx = text.find('isEditing')
occurrences = []
while idx != -1:
    occurrences.append(idx)
    idx = text.find('isEditing', idx+1)

print(f'isEditing occurrences: {len(occurrences)}')
# Look for the form - first occurrence that has <form
for pos in occurrences:
    chunk = text[max(0,pos-20):min(len(text),pos+50)]
    if 'isEditing &&' in chunk or 'isEditing ?' in chunk:
        print(f'Found at {pos}:', chunk.encode('ascii','ignore').decode('ascii'))
