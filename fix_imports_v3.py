import os

def replace_in_file(file_path, search_text, replace_text):
    if not os.path.exists(file_path):
        print(f'File not found: {file_path}')
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    new_content = content.replace(search_text, replace_text)
    if content != new_content:
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            f.write(new_content)
        print(f'Updated: {file_path}')
    else:
        print(f'No changes for: {file_path}')

# App.jsx: Import was missing/incorrect in previous check
replace_in_file(r'd:\CertificateSoftware\frontend\src\App.jsx', "import Login from './pages/Login'", "import Login from './dashboards/auth/Login'")

# EventDetail.jsx: Fixing bare imports to quoted ones and consolidating
replace_in_file(r'd:\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx', 'import { useEvent } from ./eventsApi', "import { useEvent, eventKeys } from './eventsApi'")
replace_in_file(r'd:\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx', 'import { eventKeys } from ./eventsApi', '')

# TemplateSelector.jsx: Fixing bare import block
import_block = """import {
  useImageTemplates,
  useAllFieldPositions,
  useSaveFieldPositions,
  useEvent,
} from ./eventsApi"""
new_import_block = """import {
  useImageTemplates,
  useAllFieldPositions,
  useSaveFieldPositions,
  useEvent,
} from './eventsApi'"""
replace_in_file(r'd:\CertificateSoftware\frontend\src\dashboards\club\TemplateSelector.jsx', import_block, new_import_block)

# Verify.jsx: Quoting the import
replace_in_file(r'd:\CertificateSoftware\frontend\src\pages\Verify.jsx', 'import { useVerifyCert } from ./verifyApi', "import { useVerifyCert } from './verifyApi'")

# club/index.jsx: Consolidating and fixing auth import
replace_in_file(r'd:\CertificateSoftware\frontend\src\dashboards\club\index.jsx', 'import { useCreateEvent, useDeleteEvent } from ./eventsApi', "import { useCreateEvent, useDeleteEvent, useImageTemplates } from './eventsApi'")
replace_in_file(r'd:\CertificateSoftware\frontend\src\dashboards\club\index.jsx', 'import { useImageTemplates } from ./eventsApi', '')
replace_in_file(r'd:\CertificateSoftware\frontend\src\dashboards\club\index.jsx', "import { useChangePassword } from '../../api/auth'", "import { useChangePassword } from '../auth/api'")
