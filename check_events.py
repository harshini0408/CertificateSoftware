import sys

# Check events.py update
path = r'C:\D\CertificateSoftware\backend\app\routers\events.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

idx1 = text.find('max_participants=body.max_participants')
idx2 = text.find('updates["max_participants"]')
print('Create: max_participants found in Event(...) :', idx1 != -1)
print('Update: max_participants in updates dict found:', idx2 != -1)
if idx1 != -1:
    print(text[max(0,idx1-60):min(len(text),idx1+80)].encode('ascii','ignore').decode('ascii'))
if idx2 != -1:
    print(text[max(0,idx2-60):min(len(text),idx2+80)].encode('ascii','ignore').decode('ascii'))
