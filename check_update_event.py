import sys

path = r'C:\D\CertificateSoftware\backend\app\routers\events.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Find update_event and its updates dict
idx = text.find('async def update_event')
if idx == -1:
    idx = text.find('def update_event')
if idx != -1:
    print(text[max(0,idx):min(len(text),idx+1500)].encode('ascii','ignore').decode('ascii'))
