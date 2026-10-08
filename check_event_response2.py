path = r'C:\D\CertificateSoftware\backend\app\routers\events.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('def _event_response')
if idx != -1:
    print(text[max(0,idx):min(len(text),idx+1500)].encode('ascii','ignore').decode('ascii'))
