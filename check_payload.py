import sys
path = r'C:\D\CertificateSoftware\frontend\src\dashboards\club\index.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Find payload building block
idx = text.find('academic_year: selectedAcademicYears.join')
if idx != -1:
    print(text[max(0,idx-500):min(len(text),idx+100)].encode('ascii','ignore').decode('ascii'))
