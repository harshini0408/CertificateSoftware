import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Check imports
idx = text.find('axiosInstance')
print('axiosInstance found:', idx != -1)
if idx != -1:
    print(text[max(0, idx-50):min(len(text), idx+50)].encode('ascii','ignore').decode('ascii'))
