import os

def replace_in_file(file_path, search_text, replace_text):
    if not os.path.exists(file_path):
        print(f'File not found: {file_path}')
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    new_content = content.replace(search_text, replace_text)
    if content != new_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated: {file_path}')
    else:
        print(f'No changes for: {file_path}')

# App.jsx
# Note: The tool might have already partially changed some things or failed completely.
# Let's use more robust matching.
replace_in_file(r'd:\CertificateSoftware\frontend\src\App.jsx', "import Login from './pages/Login'", "import Login from './dashboards/auth/Login'")
replace_in_file(r'd:\CertificateSoftware\frontend\src\App.jsx', "import Login from \"./pages/Login\"", "import Login from './dashboards/auth/Login'")

# EventDetail.jsx
# Existing line: import { useEvent } from ./eventsApi
replace_in_file(r'd:\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx', 'import { useEvent } from ./eventsApi', "import { useEvent, eventKeys } from './eventsApi'")
# Remove the second import if it exists
replace_in_file(r'd:\CertificateSoftware\frontend\src\dashboards\club\EventDetail.jsx', 'import { eventKeys } from ./eventsApi', '')

# TemplateSelector.jsx
# This one has a multiline import usually
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

# Verify.jsx
replace_in_file(r'd:\CertificateSoftware\frontend\src\pages\Verify.jsx', 'import { useVerifyCert } from ./verifyApi', "import { useVerifyCert } from './verifyApi'")

# club/index.jsx
replace_in_file(r'd:\CertificateSoftware\frontend\src\dashboards\club\index.jsx', 'import { useCreateEvent, useDeleteEvent } from ./eventsApi', "import { useCreateEvent, useDeleteEvent, useImageTemplates } from './eventsApi'")
replace_in_file(r'd:\CertificateSoftware\frontend\src\dashboards\club\index.jsx', "import { useImageTemplates } from './eventsApi'", "") 
replace_in_file(r'd:\CertificateSoftware\frontend\src\dashboards\club\index.jsx', 'import { useImageTemplates } from ./eventsApi', "")
replace_in_file(r'd:\CertificateSoftware\frontend\src\dashboards\club\index.jsx', "import { useChangePassword } from '../../api/auth'", "import { useChangePassword } from '../auth/api'")
