import { useState, useEffect, useCallback, useMemo } from 'react'
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

import { useClubs, useClub, useClubUsers, useCreateClub, useUpdateClub } from '../club/api'
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useAssignTutorStudents,
  useBulkImportTutorStudents,
  useBulkImportTutors,
  useDownloadTutorImportSample,
  useReassignTutorStudents,
  useTutorMappingSummary,
  useStudentCertificateSearch,
} from './usersApi'
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
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
  return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

// ── Format date helper ────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Role badge colors ─────────────────────────────────────────────────────────
const roleBadge = {
  club_coordinator: 'bg-blue-50 text-blue-700 ring-blue-200',
  dept_coordinator: 'bg-purple-50 text-purple-700 ring-purple-200',
  tutor: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  student: 'bg-green-50 text-green-700 ring-green-200',
  guest: 'bg-amber-50 text-amber-700 ring-amber-200',
  super_admin: 'bg-red-50 text-red-700 ring-red-200',
}
const roleLabel = {
  club_coordinator: 'Club Coordinator',
  dept_coordinator: 'Dept Coordinator',
  tutor: 'Tutor',
  student: 'Student',
  guest: 'Guest',
  super_admin: 'Super Admin',
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL SHELL — reusable portal wrapper
// ═══════════════════════════════════════════════════════════════════════════════
function Modal({ isOpen, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!isOpen) return
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
  return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [isOpen, onClose])

  if (!isOpen) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className={`relative z-10 w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-xl bg-white shadow-modal max-h-[80vh] flex flex-col`}
        style={{ animation: 'fadeIn .15s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLUB DETAIL SIDE PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function ClubDetailPanel({ clubId, onClose, onEdit }) {
  const { data: club, isLoading } = useClub(clubId)
  const { data: members } = useClubUsers(clubId)

  if (!clubId) return null
  return createPortal(
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <aside
        className="absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-xl overflow-y-auto"
        style={{ animation: 'slideIn .2s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Club Details</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : club ? (
          <div className="px-6 py-5 space-y-5">
            <div>
              <h3 className="text-xl font-bold text-foreground">{club.name}</h3>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs font-mono font-bold text-navy">{club.slug}</span>
              </div>
            </div>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-gray-500">Contact Email</dt><dd className="font-medium">{club.contact_email || '—'}</dd></div>
              <div><dt className="text-gray-500">Created</dt><dd className="font-medium">{fmtDate(club.created_at)}</dd></div>
              <div><dt className="text-gray-500">Members</dt><dd className="font-medium">{members?.length ?? 0}</dd></div>
            </dl>
            {members && members.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-600 mb-2">Members</h4>
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white shrink-0">
                        {m.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <span className={`inline-flex items-center rounded-full ring-1 ring-inset px-2 py-0.5 text-xs font-medium ${roleBadge[m.role] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                          {roleLabel[m.role] || m.role}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button className="btn-primary flex-1" onClick={() => onEdit(club)}>Edit Club</button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>,
    document.body,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW CLUB MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function NewClubModal({ isOpen, onClose }) {
  const [form, setForm] = useState({
    name: '',
    slug: '',
  })
  const [errors, setErrors] = useState({})
  const createClub = useCreateClub()

  const handleChange = (field, value) => {
    if (field === 'slug') value = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.name.trim()) errs.name = 'Club name is required'
    if (!form.slug.trim()) errs.slug = 'Slug is required'
    if (!/^[A-Z0-9]+$/.test(form.slug)) errs.slug = 'Uppercase letters and digits only'
    if (Object.keys(errs).length) { setErrors(errs); return }

    createClub.mutate(form, {
      onSuccess: () => {
        onClose()
        setForm({
          name: '',
          slug: '',
        })
      },
      onError: (err) => {
        const detail = err?.response?.data?.detail || ''
        if (detail.toLowerCase().includes('slug')) setErrors({ slug: detail })
      },
    })
  }
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Club">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Club Name *</label>
          <input className={`form-input ${errors.name ? 'form-input-error' : ''}`} value={form.name} onChange={(e) => handleChange('name', e.target.value)} />
          {errors.name && <p className="form-error">{errors.name}</p>}
        </div>
        <div>
          <label className="form-label">Slug *</label>
          <input className={`form-input font-mono ${errors.slug ? 'form-input-error' : ''}`} value={form.slug} onChange={(e) => handleChange('slug', e.target.value)} placeholder="ECOCLUB" />
          <p className="mt-1 text-xs text-gray-400">Used in certificate numbers. Uppercase letters and digits only. Cannot be changed later.</p>
          {errors.slug && <p className="form-error">{errors.slug}</p>}
        </div>
        <p className="text-xs text-gray-500">Coordinator details can be created separately under Users as Club Coordinator.</p>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary min-w-[120px]" disabled={createClub.isPending}>
            {createClub.isPending ? <LoadingSpinner size="sm" label="" /> : 'Create Club'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT CLUB MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function EditClubModal({ isOpen, onClose, club }) {
  const [form, setForm] = useState({ name: '', contact_email: '', coordinator_username: '' })
  const updateClub = useUpdateClub()
  const updateUser = useUpdateUser()
  const { data: clubUsers } = useClubUsers(club?.id)

  const coordinator = useMemo(
    () => (clubUsers || []).find((u) => u.role === 'club_coordinator') || null,
    [clubUsers],
  )

  useEffect(() => {
    if (club) {
      setForm((prev) => ({
        ...prev,
        name: club.name,
        contact_email: club.contact_email || '',
      }))
    }
  }, [club])

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      coordinator_username: coordinator?.username || '',
    }))
  }, [coordinator])

  const handleSubmit = (e) => {
    e.preventDefault()
    doSave()
  }

  const doSave = async () => {
    try {
      await updateClub.mutateAsync({
        clubId: club.id,
        name: form.name,
        contact_email: form.contact_email,
      })

      if (coordinator && form.coordinator_username && form.coordinator_username !== coordinator.username) {
        await updateUser.mutateAsync({
          userId: coordinator.id,
          username: form.coordinator_username,
        })
      }

      onClose()
    } catch {
      // Toasts are handled by mutation hooks
    }
  }

  if (!club) return null
  return (
      <Modal isOpen={isOpen} onClose={onClose} title="Edit Club">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Club Name</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Slug</label>
            <input className="form-input font-mono bg-gray-50 cursor-not-allowed" value={club.slug} disabled title="Cannot be changed" />
          </div>
          <div>
            <label className="form-label">Contact Email</label>
            <input type="email" className="form-input" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Coordinator Username</label>
            <input
              className="form-input font-mono"
              value={form.coordinator_username}
              onChange={(e) => setForm((f) => ({ ...f, coordinator_username: e.target.value }))}
              placeholder="club_coordinator_username"
              disabled={!coordinator}
            />
            {!coordinator && (
              <p className="mt-1 text-xs text-gray-500">
                No club coordinator user found for this club.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary min-w-[120px]" disabled={updateClub.isPending || updateUser.isPending}>
              {(updateClub.isPending || updateUser.isPending) ? <LoadingSpinner size="sm" label="" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NEW USER MODAL (multi-step, role-aware)
// ═══════════════════════════════════════════════════════════════════════════════
const roles = [
  { value: 'club_coordinator', label: 'Club Coordinator', icon: '🏛️', desc: 'Manages a single club' },
  { value: 'dept_coordinator', label: 'Dept Coordinator', icon: '🎓', desc: 'Manages a department' },
  { value: 'tutor', label: 'Tutor', icon: '🧑‍🏫', desc: 'Manages one class of students' },
  { value: 'student', label: 'Student', icon: '📚', desc: 'Has certificates & credits' },
  { value: 'guest', label: 'Guest', icon: '🎟️', desc: 'Limited access account' },
]

function NewUserModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1)
  const [selectedRole, setSelectedRole] = useState('')
  const [form, setForm] = useState({ username: '', name: '', email: '', password: '', club_id: '', event_id: '', department: '', registration_number: '', batch: '', section: '' })
  const [tutorStudents, setTutorStudents] = useState([])
  const [studentDraft, setStudentDraft] = useState({ name: '', email: '', registration_number: '' })
  const [tutorImportFile, setTutorImportFile] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const createUser = useCreateUser()
  const assignTutorStudents = useAssignTutorStudents()
  const bulkImportTutorStudents = useBulkImportTutorStudents()
  const { data: clubsList } = useClubs()
  const { data: eventsList, isFetching: fetchingEvents } = useEvents(
    selectedRole === 'guest' && form.club_id ? form.club_id : null
  )

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const resetModal = () => {
    setStep(1)
    setSelectedRole('')
    setForm({ username: '', name: '', email: '', password: '', club_id: '', event_id: '', department: '', registration_number: '', batch: '', section: '' })
    setTutorStudents([])
    setStudentDraft({ name: '', email: '', registration_number: '' })
    setTutorImportFile(null)
    setErrors({})
  }

  const handleClose = () => { onClose(); resetModal() }

  const validateStep2 = () => {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Required'
    if (!form.username.trim()) errs.username = 'Required'
    else if (!/^[a-zA-Z0-9_-]+$/.test(form.username)) errs.username = 'Letters, numbers, underscores, hyphens only'
    if (!form.email.trim()) errs.email = 'Required'
    if (!form.password || form.password.length < 8) errs.password = 'Min 8 characters'
    if (selectedRole === 'club_coordinator' && !form.club_id) errs.club_id = 'Required'
    if (selectedRole === 'dept_coordinator' && !form.department) errs.department = 'Required'
    if (selectedRole === 'tutor') {
      if (!form.department) errs.department = 'Required'
      if (!form.batch) errs.batch = 'Required'
      if (!form.section) errs.section = 'Required'
    }
    if (selectedRole === 'student') {
      if (!form.department) errs.department = 'Required'
      if (!form.registration_number) errs.registration_number = 'Required'
      if (!form.batch) errs.batch = 'Required'
      if (!form.section) errs.section = 'Required'
    }
    return errs
  }

  const handleAddTutorStudent = () => {
    const name = studentDraft.name.trim()
    const email = studentDraft.email.trim().toLowerCase()
    const registration_number = studentDraft.registration_number.trim()

    if (!name || !email || !registration_number) {
      setErrors((prev) => ({ ...prev, tutor_students: 'Name, Email and Registration Number are required.' }))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors((prev) => ({ ...prev, tutor_students: 'Enter a valid student email.' }))
      return
    }
    if (tutorStudents.some((s) => s.email.toLowerCase() === email)) {
      setErrors((prev) => ({ ...prev, tutor_students: 'Student email already added in this list.' }))
      return
    }

    setTutorStudents((prev) => [...prev, { name, email, registration_number }])
    setStudentDraft({ name: '', email: '', registration_number: '' })
    setErrors((prev) => ({ ...prev, tutor_students: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validateStep2()
    if (Object.keys(errs).length) { setErrors(errs); return }
    const payload = {
      username: form.username.trim(),
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      role: selectedRole,
    }

    if (selectedRole === 'club_coordinator') {
      payload.club_id = form.club_id
    }
    if (selectedRole === 'dept_coordinator' || selectedRole === 'student' || selectedRole === 'tutor') {
      payload.department = form.department.trim()
    }
    if (selectedRole === 'student' || selectedRole === 'tutor') {
      payload.batch = form.batch.trim()
      payload.section = form.section.trim()
    }
    if (selectedRole === 'student') {
      payload.registration_number = form.registration_number.trim()
    }

    try {
      const createdResp = await createUser.mutateAsync(payload)
      const createdUser = createdResp?.data || createdResp
      const tutorId = createdUser?.id

      if (selectedRole === 'tutor' && tutorId) {
        if (tutorStudents.length > 0) {
          await assignTutorStudents.mutateAsync({ tutorId, students: tutorStudents })
        }
        if (tutorImportFile) {
          await bulkImportTutorStudents.mutateAsync({ tutorId, file: tutorImportFile })
        }
      }

      handleClose()
    } catch (err) {
      const d = err?.response?.data?.detail || ''
      if (d.toLowerCase().includes('username')) setErrors({ username: d })
      else if (d.toLowerCase().includes('email')) setErrors({ email: d })
      else if (d.toLowerCase().includes('registration')) setErrors({ registration_number: d })
    }
  }
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={step === 1 ? 'New User — Select Role' : `New User — ${roleLabel[selectedRole]}`} wide>
      {step === 1 ? (
        <div className="grid grid-cols-2 gap-3">
          {roles.map((r) => (
            <button key={r.value} type="button" onClick={() => { setSelectedRole(r.value); setStep(2) }}
              className="flex flex-col items-center gap-2 rounded-lg border-2 border-gray-200 p-5 text-center transition-all hover:border-navy hover:bg-navy/5">
              <span className="text-3xl">{r.icon}</span>
              <span className="text-sm font-semibold text-foreground">{r.label}</span>
              <span className="text-xs text-gray-500">{r.desc}</span>
            </button>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name *</label>
              <input className={`form-input ${errors.name ? 'form-input-error' : ''}`} value={form.name} onChange={(e) => handleChange('name', e.target.value)} />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>
            <div>
              <label className="form-label">Username *</label>
              <input className={`form-input font-mono ${errors.username ? 'form-input-error' : ''}`} value={form.username} onChange={(e) => handleChange('username', e.target.value)} />
              <p className="mt-0.5 text-xs text-gray-400">Cannot be changed later</p>
              {errors.username && <p className="form-error">{errors.username}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Email *</label>
              <input type="email" className={`form-input ${errors.email ? 'form-input-error' : ''}`} value={form.email} onChange={(e) => handleChange('email', e.target.value)} />
              {errors.email && <p className="form-error">{errors.email}</p>}
            </div>
            <div>
              <label className="form-label">Password *</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" className={`form-input pr-10 ${errors.password ? 'form-input-error' : ''}`} value={form.password} onChange={(e) => handleChange('password', e.target.value)} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">{showPassword ? 'Hide' : 'Show'}</button>
              </div>
              {errors.password && <p className="form-error">{errors.password}</p>}
            </div>
          </div>

          {/* Role-specific fields */}
          {selectedRole === 'club_coordinator' && (
            <div>
              <label className="form-label">Club *</label>
              <select className={`form-input ${errors.club_id ? 'form-input-error' : ''}`} value={form.club_id} onChange={(e) => { handleChange('club_id', e.target.value); }}>
                <option value="">Select club…</option>
                {(clubsList || []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.slug})</option>)}
              </select>
              {errors.club_id && <p className="form-error">{errors.club_id}</p>}
            </div>
          )}
          {(selectedRole === 'dept_coordinator' || selectedRole === 'student' || selectedRole === 'tutor') && (
            <div>
              <label className="form-label">Department *</label>
              <input className={`form-input ${errors.department ? 'form-input-error' : ''}`} value={form.department} onChange={(e) => handleChange('department', e.target.value)} placeholder="CSE" />
              {errors.department && <p className="form-error">{errors.department}</p>}
            </div>
          )}
          {selectedRole === 'tutor' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Batch *</label>
                  <input className={`form-input ${errors.batch ? 'form-input-error' : ''}`} value={form.batch} onChange={(e) => handleChange('batch', e.target.value)} placeholder="2024-2028" />
                  {errors.batch && <p className="form-error">{errors.batch}</p>}
                </div>
                <div>
                  <label className="form-label">Section *</label>
                  <input className={`form-input ${errors.section ? 'form-input-error' : ''}`} value={form.section} onChange={(e) => handleChange('section', e.target.value)} placeholder="A" />
                  {errors.section && <p className="form-error">{errors.section}</p>}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-sm font-semibold text-foreground">Assign Students To This Tutor (Optional)</p>
                <p className="mt-1 text-xs text-gray-500">You can add students manually and/or bulk import .xlsx with columns: name, email, registration number.</p>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <input className="form-input" placeholder="Student name" value={studentDraft.name} onChange={(e) => setStudentDraft((p) => ({ ...p, name: e.target.value }))} />
                  <input className="form-input" placeholder="Student email" value={studentDraft.email} onChange={(e) => setStudentDraft((p) => ({ ...p, email: e.target.value }))} />
                  <input className="form-input" placeholder="Registration number" value={studentDraft.registration_number} onChange={(e) => setStudentDraft((p) => ({ ...p, registration_number: e.target.value }))} />
                </div>
                <div className="mt-2 flex justify-end">
                  <button type="button" className="btn-secondary" onClick={handleAddTutorStudent}>+ Add Student</button>
                </div>

                {errors.tutor_students && <p className="form-error mt-1">{errors.tutor_students}</p>}

                {tutorStudents.length > 0 && (
                  <div className="mt-3 max-h-36 overflow-auto rounded border border-gray-100">
                    {tutorStudents.map((s, idx) => (
                      <div key={`${s.email}-${idx}`} className="flex items-center justify-between border-b border-gray-100 px-2 py-1.5 text-xs last:border-b-0">
                        <span className="truncate">{s.name} • {s.email} • {s.registration_number}</span>
                        <button
                          type="button"
                          className="text-red-600 hover:underline"
                          onClick={() => setTutorStudents((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3">
                  <label className="form-label">Bulk Import Students (.xlsx)</label>
                  <input type="file" accept=".xlsx" className="form-input" onChange={(e) => setTutorImportFile(e.target.files?.[0] || null)} />
                  {tutorImportFile && <p className="mt-1 text-xs text-gray-500">Selected: {tutorImportFile.name}</p>}
                </div>
              </div>
            </>
          )}
          {selectedRole === 'student' && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="form-label">Reg Number *</label>
                <input className={`form-input ${errors.registration_number ? 'form-input-error' : ''}`} value={form.registration_number} onChange={(e) => handleChange('registration_number', e.target.value)} />
                {errors.registration_number && <p className="form-error">{errors.registration_number}</p>}
              </div>
              <div>
                <label className="form-label">Batch *</label>
                <input className={`form-input ${errors.batch ? 'form-input-error' : ''}`} value={form.batch} onChange={(e) => handleChange('batch', e.target.value)} placeholder="2022-2026" />
                {errors.batch && <p className="form-error">{errors.batch}</p>}
              </div>
              <div>
                <label className="form-label">Section *</label>
                <input className={`form-input ${errors.section ? 'form-input-error' : ''}`} value={form.section} onChange={(e) => handleChange('section', e.target.value)} placeholder="A" />
                {errors.section && <p className="form-error">{errors.section}</p>}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button type="button" className="btn-secondary" onClick={() => { setStep(1); setErrors({}) }}>← Back</button>
            <button type="submit" className="btn-primary min-w-[120px]" disabled={createUser.isPending || assignTutorStudents.isPending || bulkImportTutorStudents.isPending}>
              {(createUser.isPending || assignTutorStudents.isPending || bulkImportTutorStudents.isPending) ? <LoadingSpinner size="sm" label="" /> : 'Create User'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT USER MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function EditUserModal({ isOpen, onClose, user }) {
  const [form, setForm] = useState({ name: '', email: '' })
  const updateUser = useUpdateUser()

  useEffect(() => {
    if (user) setForm({ name: user.name, email: user.email })
  }, [user])

  const handleSubmit = (e) => {
    e.preventDefault()
    updateUser.mutate({ userId: user.id, ...form }, { onSuccess: onClose })
  }

  if (!user) return null
  return (
      <Modal isOpen={isOpen} onClose={onClose} title="Edit User">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Username</label>
            <input className="form-input bg-gray-50 cursor-not-allowed" value={user.username} disabled title="Cannot be changed" />
          </div>
          <div>
            <label className="form-label">Role</label>
            <input className="form-input bg-gray-50 cursor-not-allowed" value={roleLabel[user.role] || user.role} disabled title="Cannot be changed" />
          </div>
          <div>
            <label className="form-label">Full Name</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary min-w-[120px]" disabled={updateUser.isPending}>
              {updateUser.isPending ? <LoadingSpinner size="sm" label="" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: AdminDashboard
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'
  const setTab = (t) => setSearchParams(t === 'overview' ? {} : { tab: t })

  return (
    <>
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-h-[calc(100dvh-3.5rem)] bg-background">
          <div className="page-container">
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'clubs' && <ClubsTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'certificate-mapping' && <CertificateMappingTab />}
            {activeTab === 'student-certificates' && <StudentCertificatesTab />}
            {activeTab === 'certificates' && <CertificatesTab />}
            {activeTab === 'credit-rules' && <CreditRulesTab />}
          </div>
        </main>
      </div>
    </>
  )
}

// ── CERTIFICATES TAB ──────────────────────────────────────────────────────
function CertificatesTab() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [clubFilter, setClubFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  
  // Pagination
  const [page, setPage] = useState(1)

  const { data: clubs } = useClubs()
  
  const filters = useMemo(() => {
    const f = {}
    if (search) f.search = search
    if (statusFilter) f.status = statusFilter
    if (clubFilter) f.club_id = clubFilter
    if (dateFrom) f.date_from = dateFrom
    if (dateTo) f.date_to = dateTo
    return f
  }, [search, statusFilter, clubFilter, dateFrom, dateTo])

  // Triggers API call correctly, keepPreviousData is inside hook
  const { data, isLoading } = useAdminCertificates(filters, page)
  const revokeCert = useRevokeCertificate()
  
  const [revokeTarget, setRevokeTarget] = useState(null)

  const certs = data?.items ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1

  const columns = [
    { key: 'cert_number', header: 'Cert No.', searchKey: true,
      render: (v) => <span className="font-mono text-xs font-semibold text-navy">{v ?? '—'}</span> },
    { key: 'snapshot', header: 'Participant', searchKey: false,
      render: (snap) => <span className="text-sm">{snap?.name ?? '—'}</span> },
    { key: 'snapshot.email', header: 'Email', searchKey: false,
      render: (_, row) => <span className="text-sm">{row?.snapshot?.email ?? '—'}</span> },
    { key: 'snapshot.club_name', header: 'Club', searchKey: false,
      render: (_, row) => <span className="text-sm">{row?.snapshot?.club_name ?? '—'}</span> },
    { key: 'snapshot.event_name', header: 'Event', searchKey: false,
      render: (_, row) => <span className="text-sm">{row?.snapshot?.event_name ?? '—'}</span> },
    { key: 'cert_type', header: 'Cert Type',
      render: (v) => <StatusBadge status={v} size="sm" /> },
    { key: 'status', header: 'Status',
      render: (v) => <StatusBadge status={v} size="sm" /> },
    { key: 'issued_at', header: 'Issued', render: (v) => fmtDate(v) },
    { key: '_actions', header: 'Actions', searchKey: false, render: (_, row) => (
      !['revoked', 'emailed'].includes((row.status || '').toLowerCase()) && (
        <button
          onClick={() => setRevokeTarget(row)}
          className="rounded p-1 text-xs font-semibold text-red-600 hover:bg-red-50 hover:underline"
        >
          Revoke
        </button>
      )
    )},
  ]
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Certificates</h1>
        <span className="text-sm text-gray-400">{total} total</span>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" placeholder="Search certificates…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="form-input w-64" />
        <select value={clubFilter} onChange={(e) => { setClubFilter(e.target.value); setPage(1); }}
          className="form-input w-40">
          <option value="">All Clubs</option>
          {(clubs ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="form-input w-40">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="generated">Generated</option>
          <option value="emailed">Emailed</option>
          <option value="failed">Failed</option>
          <option value="revoked">Revoked</option>
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="form-input w-36" title="Date From" />
          <span className="text-gray-400">—</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="form-input w-36" title="Date To" />
        </div>
      </div>
      
      <DataTable columns={columns} data={certs} isLoading={isLoading}
        emptyMessage="No certificates found." />

      {pages > 0 && (
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-gray-500">
            Showing {(page - 1) * 50 + (certs.length ? 1 : 0)}–{(page - 1) * 50 + certs.length} of {total} certificates
          </span>
          <div className="flex gap-2">
            <button className="btn-secondary text-sm py-1.5" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <button className="btn-secondary text-sm py-1.5" disabled={page === pages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => {
          revokeCert.mutate(revokeTarget?.cert_number, {
            onSuccess: () => setRevokeTarget(null)
          })
        }}
        title="Revoke Certificate?"
        message={`Revoke certificate ${revokeTarget?.cert_number} issued to ${revokeTarget?.snapshot?.name}? This cannot be undone.`}
        confirmLabel="Revoke"
        isLoading={revokeCert.isPending}
      />
    </div>
  )
}

// ── STUDENT CERTIFICATES TAB ────────────────────────────────────────────────
function StudentCertificatesTab() {
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const { data, isLoading } = useStudentCertificateSearch(submittedQuery)

  const results = data?.results || []

  const columns = [
    { key: 'source_type', header: 'Source', render: (v) => <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">{(v || '').replace(/_/g, ' ')}</span> },
    { key: 'cert_number', header: 'Cert No.', render: (v) => <span className="font-mono text-xs font-semibold text-navy">{v ?? '—'}</span> },
    { key: 'event_name', header: 'Event Name', searchKey: true },
    { key: 'club_name', header: 'Club', render: (v) => <span className="text-xs text-gray-500">{v ?? '—'}</span> },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'credit_points', header: 'Credit Points', align: 'right', render: (v) => <span className="font-bold text-green-700">+{v ?? 0}</span> },
    { key: 'issued_at', header: 'Issued / Submitted', render: (v) => (v ? fmtDate(v) : '—') },
  ]

  const handleSearch = (e) => {
    e.preventDefault()
    setSubmittedQuery(query.trim())
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Student Certificates</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search by student name, registration number, or email to see generated and manual certificates.
        </p>
      </div>

      <form onSubmit={handleSearch} className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          className="form-input w-full sm:w-96"
          placeholder="Search by name, registration number, or email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn-primary sm:ml-auto">
          Search
        </button>
      </form>

      {submittedQuery && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="card p-6"><LoadingSpinner /></div>
          ) : results.length === 0 ? (
            <div className="card p-6 text-sm text-gray-500">No student found for “{submittedQuery}”.</div>
          ) : (
            results.map((item) => (
              <div key={item.student.id} className="card p-5 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{item.student.name}</h2>
                    <p className="text-sm text-gray-500">
                      {item.student.email} · {item.student.registration_number || '—'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-navy/10 px-2 py-1 font-semibold text-navy">Total: {item.total_certificates}</span>
                    <span className="rounded bg-green-50 px-2 py-1 font-semibold text-green-700">Generated: {item.generated_count}</span>
                    <span className="rounded bg-blue-50 px-2 py-1 font-semibold text-blue-700">Manual: {item.manual_upload_count}</span>
                    <span className="rounded bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">Verified Manual: {item.verified_manual_count}</span>
                  </div>
                </div>

                <DataTable
                  columns={columns}
                  data={item.certificates}
                  isLoading={false}
                  emptyMessage="No certificates found for this student."
                  rowKey="cert_number"
                />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── CREDIT RULES TAB ──────────────────────────────────────────────────────
function CreditRulesTab() {
  const { data: rulesData, isLoading } = useCreditRules()
  const updateRules = useUpdateCreditRules()

  const [localRules, setLocalRules] = useState([])
  const [editingIndex, setEditingIndex] = useState(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    if (rulesData) setLocalRules(rulesData)
  }, [rulesData])

  const targetRules = [
    { cert_type: 'Class Representative', points: 3 },
    { cert_type: 'Club Member', points: 2 },
    { cert_type: 'Coordinator', points: 3 },
    { cert_type: 'First Place', points: 5 },
    { cert_type: 'Non-Technical Participant', points: 2 },
    { cert_type: 'Office Bearer', points: 3 },
    { cert_type: 'Organizer', points: 5 },
    { cert_type: 'Paper Presenter', points: 3 },
    { cert_type: 'Second Place', points: 5 },
    { cert_type: 'Student Council Member', points: 5 },
    { cert_type: 'Student Volunteer', points: 2 },
    { cert_type: 'Technical Talk', points: 2 },
    { cert_type: 'Technical Participant', points: 2 },
    { cert_type: 'Third Place', points: 5 },
    { cert_type: 'Workshop', points: 3 },
  ]

  // Ensure all required cert types exist in local array.
  const orderedRules = targetRules.map((base) => {
    const r = localRules.find((x) => x.cert_type === base.cert_type)
    return r || base
  })

  const startEdit = (idx, value) => {
    setEditingIndex(idx)
    setEditValue(value)
  }

  const saveInline = () => {
    const numValue = Math.min(1000, Math.max(0, parseInt(editValue) || 0))
    const updated = [...orderedRules]
    updated[editingIndex].points = numValue
    setLocalRules(updated)
    setEditingIndex(null)
  }

  const handleSaveAll = () => {
    updateRules.mutate(orderedRules)
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Credit Points Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">
          These point values apply globally across all clubs.
        </p>
      </div>
      
      {isLoading ? (
        <div className="flex py-12 justify-center"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {orderedRules.map((rule, idx) => (
            <div key={rule.cert_type} className="card p-5 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-sm font-semibold text-foreground capitalize">
                  {rule.cert_type.replace(/_/g, ' ')}
                </p>
                <p className="text-xs text-gray-500">Base points per certificate</p>
              </div>
              <div className="flex items-center gap-4">
                {editingIndex === idx ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number" className="form-input w-20 text-center text-lg font-bold p-1"
                      min={0} max={1000} value={editValue} onChange={(e) => setEditValue(e.target.value)}
                    />
                    <button onClick={saveInline} className="h-8 w-8 flex items-center justify-center rounded-full bg-green-100 text-green-700 hover:bg-green-200">✓</button>
                    <button onClick={() => setEditingIndex(null)} className="h-8 w-8 flex items-center justify-center rounded-full bg-red-100 text-red-700 hover:bg-red-200">✗</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black text-navy">{rule.points}</span>
                    <button onClick={() => startEdit(idx, rule.points)} className="p-1 text-gray-400 hover:text-navy transition-colors">
                      ✎
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-start">
        <button className="btn-primary min-w-[200px]" onClick={handleSaveAll} disabled={updateRules.isPending}>
          {updateRules.isPending ? <LoadingSpinner size="sm" label="" /> : 'Save All Changes'}
        </button>
      </div>
    </div>
  )
}

// ── OVERVIEW TAB ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const [, setSearchParams] = useSearchParams()
  const { data: stats, isLoading: sl } = useAdminStats()
  const { data: clubs } = useAdminClubs()

  const chartData = useMemo(() => {
    return stats?.certs_by_source || []
  }, [stats])

  const recentCertificates = useMemo(() => {
    const rows = stats?.recent_certificates || []
    return rows.map((row, idx) => ({ ...row, _row_key: `${row.source_type}-${row.source_name}-${row.event_name}-${idx}` }))
  }, [stats])

  const recentCertificateCols = [
    { key: 'event_name', header: 'Event Name', sortable: true, searchKey: true },
    { key: 'generated_at', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'mailed_count', header: 'Mailed', align: 'right', render: (v, row) => `${v ?? 0}/${row.count ?? 0}` },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'source_type',
      header: 'Source',
      render: (v, row) => (
        <span className="text-xs text-gray-700 capitalize">
          {v} {row.source_name ? `(${row.source_name})` : ''}
        </span>
      ),
    },
    { key: 'count', header: 'Count', align: 'right', render: (v) => <span className="font-semibold text-navy">{v ?? 0}</span> },
  ]

  const hasChartData = chartData.some(d => d.count > 0)
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Platform Overview</h1>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total Clubs" value={stats?.total_clubs ?? 0} accent="navy" isLoading={sl} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>} />
        <StatCard label="Total Users" value={stats?.total_users ?? 0} accent="blue" isLoading={sl} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>} />
        <StatCard label="Total Students" value={stats?.total_students ?? 0} accent="green" isLoading={sl} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>} />
        <StatCard label="Emails Sent Today" value={stats?.emails_sent_today ?? 0} accent="blue" isLoading={sl} icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">Certificates Generated by Source (all time)</h2>
        <div className="h-[280px] w-full">
          {sl ? (
            <div className="h-full flex items-center justify-center"><LoadingSpinner /></div>
          ) : !hasChartData ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-500">No certificates issued yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12 }} width={40} />
                <Tooltip
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value, name, props) => [
                    `${value} certificates`,
                    props.payload.name || props.payload.slug
                  ]}
                  labelStyle={{ display: 'none' }}
                />
                <Bar dataKey="count" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title mb-0">Recent Certificates Generated</h2>
          <button className="text-sm font-medium text-navy hover:underline" onClick={() => setSearchParams({ tab: 'certificates' })}>
            View all &rarr;
          </button>
        </div>
        <DataTable
          columns={recentCertificateCols}
          data={recentCertificates}
          isLoading={sl}
          emptyMessage="No certificates generated yet."
          rowKey="_row_key"
        />
      </div>
    </div>
  )
}

// ── CLUBS TAB ─────────────────────────────────────────────────────────────────
function ClubsTab() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const filters = useMemo(() => {
    const f = {}
    if (debouncedSearch) f.search = debouncedSearch
    return f
  }, [debouncedSearch])
  const { data: clubs, isLoading } = useClubs(filters)

  const [showNew, setShowNew] = useState(false)
  const [editClub, setEditClub] = useState(null)
  const [detailClubId, setDetailClubId] = useState(null)

  const columns = [
    { key: 'name', header: 'Name', sortable: true, render: (v) => <span className="font-semibold">{v}</span> },
    { key: 'slug', header: 'Slug', render: (v) => <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono font-bold">{v}</span> },
    { key: 'contact_email', header: 'Email', sortable: true },
    { key: 'created_at', header: 'Created', sortable: true, render: (v) => fmtDate(v) },
    { key: '_actions', header: 'Actions', searchKey: false, render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button title="Edit" onClick={() => setEditClub(row)} className="rounded p-1 text-gray-400 hover:text-navy hover:bg-navy/10 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
        </div>
    )},
  ]
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Clubs</h1>
        <button className="btn-primary" onClick={() => setShowNew(true)}>+ New Club</button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" placeholder="Search clubs…" value={search} onChange={(e) => setSearch(e.target.value)} className="form-input w-64" />
      </div>
      <DataTable columns={columns} data={clubs || []} isLoading={isLoading} emptyMessage="No clubs found. Create your first club." onRowClick={(row) => setDetailClubId(row.id)} />
      <NewClubModal isOpen={showNew} onClose={() => setShowNew(false)} />
      <EditClubModal isOpen={!!editClub} onClose={() => setEditClub(null)} club={editClub} />
      {detailClubId && <ClubDetailPanel clubId={detailClubId} onClose={() => setDetailClubId(null)} onEdit={(c) => { setDetailClubId(null); setEditClub(c) }} />}
    </div>
  )
}

function BulkImportModal({ isOpen, onClose }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)   // { created, skipped, errors[] }
  const importMutation = useBulkImportStudents()

  const handleClose = () => {
    setFile(null)
    setResult(null)
    onClose()
  }

  const handleSubmit = () => {
    if (!file) return
    importMutation.mutate(file, {
      onSuccess: ({ data }) => setResult(data),
    })
  }
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Import Students" wide>
      {!result ? (
        <div className="space-y-5">
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
            <p className="text-sm font-semibold text-blue-800 mb-1">Excel File Requirements</p>
            <p className="text-xs text-blue-700">
              Upload a <span className="font-mono font-bold">.xlsx</span> file with these column headers
              (case-insensitive, in any order):
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['name','email','username','password','department','registration_number','batch','section','tutor_email'].map(col => (
                <span key={col} className="inline-block rounded bg-blue-100 px-2 py-0.5 font-mono text-[11px] text-blue-800">{col}</span>
              ))}
            </div>
            <p className="text-xs text-blue-600 mt-2">
              Rows with duplicate username, email, or registration number will be skipped (not failed).
            </p>
          </div>

          <div>
            <label className="form-label">Select Excel File (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-500 file:mr-3 file:rounded file:border-0
                file:bg-navy/10 file:px-3 file:py-1.5 file:text-xs file:font-medium
                file:text-navy hover:file:bg-navy/20 cursor-pointer"
            />
            {file && (
              <p className="mt-1 text-xs text-gray-500">
                Selected: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button className="btn-secondary" onClick={handleClose}>Cancel</button>
            <button
              className="btn-primary"
              onClick={handleSubmit}
              disabled={!file || importMutation.isPending}
            >
              {importMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Importing…
                </span>
              ) : 'Import Students'}
            </button>
          </div>
        </div>
      ) : (
        // Results view
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{result.created}</p>
              <p className="text-xs text-green-600 font-medium mt-0.5">Created</p>
            </div>
            <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3 text-center">
              <p className="text-2xl font-bold text-yellow-700">{result.skipped}</p>
              <p className="text-xs text-yellow-600 font-medium mt-0.5">Skipped</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
              <p className="text-xs text-red-600 font-medium mt-0.5">Errors</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Row Errors
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-red-100 bg-red-50 divide-y divide-red-100">
                {result.errors.map((e, i) => (
                  <div key={i} className="flex gap-3 px-3 py-2">
                    <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-700">
                      Row {e.row}
                    </span>
                    <span className="text-xs text-red-700">{e.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button className="btn-secondary" onClick={() => { setFile(null); setResult(null) }}>
              Import Another File
            </button>
            <button className="btn-primary" onClick={handleClose}>Done</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function TutorBulkImportModal({ isOpen, onClose }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const importMutation = useBulkImportTutors()
  const downloadSample = useDownloadTutorImportSample()

  const handleClose = () => {
    setFile(null)
    setResult(null)
    onClose()
  }

  const handleSubmit = () => {
    if (!file) return
    importMutation.mutate(file, {
      onSuccess: ({ data }) => setResult(data),
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Import Tutors" wide>
      {!result ? (
        <div className="space-y-5">
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
            <p className="text-sm font-semibold text-blue-800 mb-1">Excel File Requirements</p>
            <p className="text-xs text-blue-700">
              Upload a <span className="font-mono font-bold">.xlsx</span> file with these column headers
              (case-insensitive, in any order):
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['name', 'username', 'email', 'password', 'department', 'batch', 'section'].map((col) => (
                <span key={col} className="inline-block rounded bg-blue-100 px-2 py-0.5 font-mono text-[11px] text-blue-800">{col}</span>
              ))}
            </div>
            <div className="mt-3">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => downloadSample.mutate()}
                disabled={downloadSample.isPending}
              >
                {downloadSample.isPending ? 'Downloading sample...' : 'Download Sample Excel'}
              </button>
            </div>
          </div>

          <div>
            <label className="form-label">Select Tutor Excel File (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-500 file:mr-3 file:rounded file:border-0
                file:bg-navy/10 file:px-3 file:py-1.5 file:text-xs file:font-medium
                file:text-navy hover:file:bg-navy/20 cursor-pointer"
            />
            {file && (
              <p className="mt-1 text-xs text-gray-500">
                Selected: <span className="font-medium">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button className="btn-secondary" onClick={handleClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={!file || importMutation.isPending}>
              {importMutation.isPending ? 'Importing...' : 'Import Tutors'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{result.created}</p>
              <p className="text-xs text-green-600 font-medium mt-0.5">Created</p>
            </div>
            <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-3 text-center">
              <p className="text-2xl font-bold text-yellow-700">{result.skipped}</p>
              <p className="text-xs text-yellow-600 font-medium mt-0.5">Skipped</p>
            </div>
            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
              <p className="text-xs text-red-600 font-medium mt-0.5">Errors</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Row Errors</p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-red-100 bg-red-50 divide-y divide-red-100">
                {result.errors.map((e, i) => (
                  <div key={i} className="flex gap-3 px-3 py-2">
                    <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-700">Row {e.row}</span>
                    <span className="text-xs text-red-700">{e.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <button className="btn-secondary" onClick={() => { setFile(null); setResult(null) }}>Import Another File</button>
            <button className="btn-primary" onClick={handleClose}>Done</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function TutorSwitchModal({ isOpen, onClose, tutors, initialTutor }) {
  const [fromTutorId, setFromTutorId] = useState('')
  const [toTutorId, setToTutorId] = useState('')
  const switchMutation = useReassignTutorStudents()

  useEffect(() => {
    if (!isOpen) return
    setFromTutorId(initialTutor?.id || '')
    setToTutorId('')
  }, [isOpen, initialTutor])

  const fromTutor = (tutors || []).find((t) => t.id === fromTutorId) || null
  const targetTutorOptions = (tutors || []).filter((t) => t.id !== fromTutorId)
  const toTutor = targetTutorOptions.find((t) => t.id === toTutorId) || null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!fromTutorId || !toTutorId) return
    switchMutation.mutate(
      { fromTutorId, toTutorId },
      {
        onSuccess: () => onClose(),
      },
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Switch Tutor For Students" wide>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-gray-600">
          Select the current tutor and target tutor. All students currently mapped to the selected tutor will be reassigned.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label">Current Tutor *</label>
            <select className="form-input" value={fromTutorId} onChange={(e) => setFromTutorId(e.target.value)}>
              <option value="">Select tutor...</option>
              {(tutors || []).map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">New Tutor *</label>
            <select className="form-input" value={toTutorId} onChange={(e) => setToTutorId(e.target.value)} disabled={!fromTutorId}>
              <option value="">Select tutor...</option>
              {targetTutorOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
              ))}
            </select>
          </div>
        </div>

        {fromTutor && (
          <div className="rounded border border-gray-200 p-3 text-xs text-gray-600">
            <p><span className="font-semibold text-gray-800">Current tutor:</span> {fromTutor.name} ({fromTutor.email})</p>
            <p><span className="font-semibold text-gray-800">Scope:</span> {fromTutor.department || '—'} / {fromTutor.batch || '—'} / {fromTutor.section || '—'}</p>
          </div>
        )}
        {toTutor && (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-xs text-green-700">
            <p><span className="font-semibold">Target tutor:</span> {toTutor.name} ({toTutor.email})</p>
            <p><span className="font-semibold">Scope:</span> {toTutor.department || '—'} / {toTutor.batch || '—'} / {toTutor.section || '—'}</p>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!fromTutorId || !toTutorId || switchMutation.isPending}>
            {switchMutation.isPending ? 'Switching...' : 'Switch Students'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── USERS TAB ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const debouncedSearch = useDebounce(search)
  const filters = useMemo(() => {
    const f = {}
    if (debouncedSearch) f.search = debouncedSearch
    if (roleFilter) f.role = roleFilter
    return f
  }, [debouncedSearch, roleFilter])
  const { data: users, isLoading } = useUsers(filters)
  const { data: clubs } = useClubs()
  const { data: tutors } = useUsers({ role: 'tutor' })
  const { data: tutorMappingSummary, isLoading: tutorMappingLoading } = useTutorMappingSummary()

  const [showBulkImport, setShowBulkImport] = useState(false)
  const [showTutorBulkImport, setShowTutorBulkImport] = useState(false)
  const [showTutorSwitch, setShowTutorSwitch] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [selectedTutorForSwitch, setSelectedTutorForSwitch] = useState(null)

  const clubMap = useMemo(() => {
    const m = {}
    ;(clubs || []).forEach((c) => { m[c.id] = c.name })
    return m
  }, [clubs])

  const getScope = (u) => {
    if (u.role === 'club_coordinator') return clubMap[u.club_id] || u.club_id || '—'
    if (u.role === 'dept_coordinator') return u.department || '—'
    if (u.role === 'tutor') return `${u.department || ''} ${u.batch || ''} ${u.section || ''}`.trim() || '—'
    if (u.role === 'student') return `${u.batch || ''} ${u.section || ''}`.trim() || '—'
    if (u.role === 'guest') return `${clubMap[u.club_id] || ''} · 1 event`
    return '—'
  }

  const columns = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'username', header: 'Username', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'role', header: 'Role', render: (v) => <span className={`inline-flex items-center rounded-full ring-1 ring-inset px-2 py-0.5 text-xs font-medium ${roleBadge[v] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>{roleLabel[v] || v}</span> },
    { key: '_scope', header: 'Scope', searchKey: false, render: (_, row) => <span className="text-xs text-gray-500">{getScope(row)}</span> },
    { key: '_actions', header: 'Actions', searchKey: false, render: (_, row) => (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {row.role === 'tutor' && (
          <button
            title="Switch students to another tutor"
            onClick={() => {
              setSelectedTutorForSwitch(row)
              setShowTutorSwitch(true)
            }}
            className="rounded p-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:underline"
          >
            Switch Students
          </button>
        )}
        <button title="Edit" onClick={() => setEditUser(row)} className="rounded p-1 text-gray-400 hover:text-navy hover:bg-navy/10 transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
      </div>
    )},
  ]
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            onClick={() => setShowBulkImport(true)}
          >
            ↑ Import Students
          </button>
          <button
            className="btn-secondary"
            onClick={() => setShowTutorBulkImport(true)}
          >
            ↑ Import Tutors
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              setSelectedTutorForSwitch(null)
              setShowTutorSwitch(true)
            }}
          >
            ⇄ Switch Tutor Mapping
          </button>
          <button className="btn-primary" onClick={() => setShowNew(true)}>+ New User</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} className="form-input w-64" />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="form-input w-44">
          <option value="">All Roles</option>
          <option value="club_coordinator">Club Coordinator</option>
          <option value="dept_coordinator">Dept Coordinator</option>
          <option value="tutor">Tutor</option>
          <option value="student">Student</option>
          <option value="guest">Guest</option>
        </select>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Tutor Mapping Snapshot</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded bg-indigo-50 px-2 py-1 font-semibold text-indigo-700">
                Tutors: {tutorMappingLoading ? '...' : (tutorMappingSummary?.total_tutors ?? 0)}
              </span>
              <span className="rounded bg-green-50 px-2 py-1 font-semibold text-green-700">
                Mapped Students: {tutorMappingLoading ? '...' : (tutorMappingSummary?.total_mapped_students ?? 0)}
              </span>
            </div>
          </div>

          {!tutorMappingLoading && (
            <div className="flex flex-wrap gap-2">
              {(tutorMappingSummary?.items || []).slice(0, 12).map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                  title={`${t.name} (${t.email})`}
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="text-gray-500">x {t.mapped_students}</span>
                </span>
              ))}
              {(tutorMappingSummary?.items || []).length === 0 && (
                <span className="text-xs text-gray-500">No tutor mappings found.</span>
              )}
            </div>
          )}
        </div>
      </div>

      <DataTable columns={columns} data={users || []} isLoading={isLoading} emptyMessage="No users found matching your filters." />
      <BulkImportModal isOpen={showBulkImport} onClose={() => setShowBulkImport(false)} />
      <TutorBulkImportModal isOpen={showTutorBulkImport} onClose={() => setShowTutorBulkImport(false)} />
      <TutorSwitchModal
        isOpen={showTutorSwitch}
        onClose={() => {
          setShowTutorSwitch(false)
          setSelectedTutorForSwitch(null)
        }}
        tutors={tutors || []}
        initialTutor={selectedTutorForSwitch}
      />
      <NewUserModal isOpen={showNew} onClose={() => setShowNew(false)} />
      <EditUserModal isOpen={!!editUser} onClose={() => setEditUser(null)} user={editUser} />
    </div>
  )
}
