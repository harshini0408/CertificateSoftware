import os

def fix_file(p, s, r):
    if not os.path.exists(p):
        print(f"File not found: {p}")
        return
    with open(p, 'r', encoding='utf-8') as f:
        c = f.read()
    nc = c.replace(s, r)
    if c != nc:
        with open(p, 'w', encoding='utf-8', newline='') as f:
            f.write(nc)
        print(f"Updated {p}")
    else:
        print(f"No changes for {p}")

# CertificateIssue.jsx
fix_file(r'd:\CertificateSoftware\frontend\src\dashboards\club\CertificateIssue.jsx', 
         'import { useParticipants } from ./participantsApi', 
         "import { useParticipants } from './participantsApi'")

# Login.jsx
login_path = r'd:\CertificateSoftware\frontend\src\dashboards\auth\Login.jsx'
fix_file(login_path, "import { useLogin } from '../api/auth'", "import { useLogin } from './api'")
fix_file(login_path, "import { useAuthStore } from '../store/authStore'", "import { useAuthStore } from '../../store/authStore'")
fix_file(login_path, "import LoadingSpinner from '../components/LoadingSpinner'", "import LoadingSpinner from '../../components/LoadingSpinner'")
fix_file(login_path, "import collegeBg from '../Images/college bg.jpeg'", "import collegeBg from '../../Images/college bg.jpeg'")
fix_file(login_path, "import collegeLogo from '../Images/College logo.png'", "import collegeLogo from '../../Images/College logo.png'")

# auth/api.js
auth_api_path = r'd:\CertificateSoftware\frontend\src\dashboards\auth\api.js'
fix_file(auth_api_path, "import axiosInstance from '../utils/axiosInstance'", "import axiosInstance from '../../utils/axiosInstance'")
fix_file(auth_api_path, "import { useAuthStore } from '../store/authStore'", "import { useAuthStore } from '../../store/authStore'")
fix_file(auth_api_path, "import { useToastStore } from '../store/uiStore'", "import { useToastStore } from '../../store/uiStore'")
fix_file(auth_api_path, "import queryClient from '../utils/queryClient'", "import queryClient from '../../utils/queryClient'")

# TemplateSelector.jsx
fix_file(r'd:\CertificateSoftware\frontend\src\dashboards\club\TemplateSelector.jsx', 
         "import { useParticipants } from '../api/participants'", 
         "import { useParticipants } from './participantsApi'")
