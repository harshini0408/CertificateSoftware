import sys
path = r'C:\D\CertificateSoftware\backend\app\domains\club\routers.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Get the last 60 lines (the appended endpoint)
lines = text.splitlines()
print('\n'.join(lines[-60:]))
