import os
import re

file_path = r'D:\CertificateSoftware\frontend\src\dashboards\superadmin\index.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Strip the rogue injected line everywhere
cleaned_content = re.sub(
    r'\s*if\s*\(isConfiguratorOpen\)\s*return\s*\(<><Navbar \/>.*?\);\n', 
    '', 
    content
)

# 2. Re-inject into AdminDashboard where it belongs
set_tab_pattern = r'(const\s+setTab\s*=\s*\(t\)\s*=>\s*setSearchParams\(t\s*===\s*\'overview\'\s*\?\s*\{\}\s*:\s*\{\s*tab:\s*t\s*\}\)\n)'
replacement = r'\1\n  if (isConfiguratorOpen) return (<><Navbar /><div className="flex"><Sidebar /><main className="flex-1 min-h-[calc(100dvh-3.5rem)] bg-background"><div className="p-4"><button onClick={() => setIsConfiguratorOpen(false)} className="mb-4 flex items-center gap-2 text-sm font-bold text-navy hover:text-navy-light transition-colors"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>BACK TO DASHBOARD</button><CertificateConfigurator /></div></main></div></>);\n'

cleaned_content = re.sub(set_tab_pattern, replacement, cleaned_content)

# 3. Add the missing headers
headers = """import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import DataTable from '../../components/DataTable'
import ConfirmModal from '../../components/ConfirmModal'
import CertificateMappingTab from './CertificateMappingTab'
import CertificateConfigurator from '../../components/CertificateConfigurator'

import { useClubs, useClub, useClubUsers, useCreateClub, useUpdateClub } from '../club/api'
import { useUsers, useCreateUser, useUpdateUser, useDeactivateUser } from './usersApi'
import {
  useAdminStats,
  useAdminClubs,
  useAdminCertificates,
  useRevokeCertificate,
  useCreditRules,
  useUpdateCreditRules,
  useBulkImportStudents,
} from './api'
import { useEvents } from '../club/eventsApi'

// ── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce(value, delay = 300) {
"""

if cleaned_content.strip().startswith('const [debounced, setDebounced] = useState(value)'):
    final_content = headers + cleaned_content
else:
    final_content = cleaned_content

# 4. Fix the literal \n injected erroneously
final_content = final_content.replace('\\n', '\n')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(final_content)

print("Done fixing file.")
