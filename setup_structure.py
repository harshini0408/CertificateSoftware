import os
from pathlib import Path

base_dir = Path(r'd:\Certificate-Software\backend')

dirs = [
    'app/models',
    'app/schemas',
    'app/routers',
    'app/services',
    'app/core',
    'app/static/templates',
    'app/static/fonts',
    'storage/certs',
    'storage/assets'
]

files = [
    'app/main.py',
    'app/config.py',
    'app/database.py',
    'app/scheduler.py',
    'app/models/__init__.py',
    'app/models/club.py',
    'app/models/user.py',
    'app/models/event.py',
    'app/models/template.py',
    'app/models/participant.py',
    'app/models/certificate.py',
    'app/models/email_log.py',
    'app/models/scan_log.py',
    'app/models/credit_rule.py',
    'app/models/student_credit.py',
    'app/schemas/__init__.py',
    'app/schemas/auth.py',
    'app/schemas/club.py',
    'app/schemas/event.py',
    'app/schemas/template.py',
    'app/schemas/participant.py',
    'app/schemas/certificate.py',
    'app/schemas/credit.py',
    'app/routers/__init__.py',
    'app/routers/auth.py',
    'app/routers/admin.py',
    'app/routers/clubs.py',
    'app/routers/events.py',
    'app/routers/participants.py',
    'app/routers/templates.py',
    'app/routers/certificates.py',
    'app/routers/verify.py',
    'app/routers/register.py',
    'app/routers/student.py',
    'app/routers/dept.py',
    'app/services/__init__.py',
    'app/services/auth_service.py',
    'app/services/cert_number.py',
    'app/services/png_generator.py',
    'app/services/qr_service.py',
    'app/services/template_renderer.py',
    'app/services/email_service.py',
    'app/services/excel_service.py',
    'app/services/signature_service.py',
    'app/services/storage_service.py',
    'app/services/credit_service.py',
    'app/core/__init__.py',
    'app/core/security.py',
    'app/core/dependencies.py',
    'app/static/templates/participation.html',
    'app/static/templates/coordinator.html',
    'app/static/templates/winner_1st.html',
    'app/static/templates/winner_2nd.html',
    'app/static/templates/winner_3rd.html',
    'app/static/templates/appreciation.html',
    'app/static/fonts/.gitkeep',
    'storage/certs/.gitkeep',
    'storage/assets/.gitkeep',
    'requirements.txt',
    '.env.example',
    '.gitignore'
]

for d in dirs:
    (base_dir / d).mkdir(parents=True, exist_ok=True)

for f in files:
    file_path = base_dir / f
    if not file_path.exists():
        file_path.write_text('', encoding='utf-8')

print("Created directories and empty files successfully.")
