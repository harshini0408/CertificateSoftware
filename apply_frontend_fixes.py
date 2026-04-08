import os

def fix_file(file_path, search_str, replace_str):
    if not os.path.exists(file_path):
        print(f"Skipping: {file_path} (Not found)")
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content.replace(search_str, replace_str)
    
    if new_content != content:
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            f.write(new_content)
        print(f"Updated: {file_path}")
    else:
        print(f"No changes for: {file_path}")

# EventDetail.jsx
fix_file(r'D:\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx', 
         'import { useEvent } from ./eventsApi', 
         "import { useEvent, eventKeys } from './eventsApi'")
fix_file(r'D:\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx', 
         'import { eventKeys } from ./eventsApi', 
         "")

# TemplateSelector.jsx
fix_file(r'D:\CertificateSoftware\frontend\src\dashboards\club\TemplateSelector.jsx', 
         'from ./eventsApi', 
         "from './eventsApi'")

# Verify.jsx
fix_file(r'D:\CertificateSoftware\frontend\src\pages\Verify.jsx', 
         'import { useVerifyCert } from ./verifyApi', 
         "import { useVerifyCert } from './verifyApi'")

# Club Index
fix_file(r'D:\CertificateSoftware\frontend\src\dashboards\club\index.jsx', 
         'import { useCreateEvent, useDeleteEvent } from ./eventsApi', 
         "import { useCreateEvent, useDeleteEvent, useImageTemplates } from './eventsApi'")
fix_file(r'D:\CertificateSoftware\frontend\src\dashboards\club\index.jsx', 
         'import { useImageTemplates } from ./eventsApi', 
         "")
fix_file(r'D:\CertificateSoftware\frontend\src\dashboards\club\index.jsx', 
         "import { useChangePassword } from '../../api/auth'", 
         "import { useChangePassword } from '../auth/api'")
