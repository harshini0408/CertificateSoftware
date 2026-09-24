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
  useAddTutorClass,
  useRemoveTutorClass,
  useTutorMappingSummary,
  useMakeFacultyTutor,
  useBulkImportFaculty,
  useDownloadFacultyImportSample,
  useDeleteUser,
  useBulkDeleteUsers,
  useStudentCertificateSearch,
  useStudentClubMemberships,
} from './usersApi'
import {
  useAdminStats,
  useAdminClubs,
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useAdminCertificates,
  useRevokeCertificate,
  useCreditRules,
  useUpdateCreditRules,
  useDeleteCreditRule,
  useBulkImportStudents,
  useResetStudentCredits,
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
  principal: 'bg-amber-50 text-amber-700 ring-amber-200',
  hod: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  student_affairs: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  club_coordinator: 'bg-blue-50 text-blue-700 ring-blue-200',
  dept_coordinator: 'bg-purple-50 text-purple-700 ring-purple-200',
  tutor: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  faculty: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  student: 'bg-green-50 text-green-700 ring-green-200',
  guest: 'bg-amber-50 text-amber-700 ring-amber-200',
  super_admin: 'bg-red-50 text-red-700 ring-red-200',
}
const roleLabel = {
  principal: 'Principal',
  hod: 'HOD',
  student_affairs: 'Student Affairs',
  club_coordinator: 'Club Coordinator',
  dept_coordinator: 'Dept Coordinator',
  tutor: 'Tutor',
  faculty: 'Faculty',
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
    if (form.contact_email && !/^[a-zA-Z0-9._%+-]+@psgitech\.ac\.in$/i.test(form.contact_email.trim())) {
      addToast({ type: 'error', message: 'Contact email must be a valid @psgitech.ac.in address.' })
      return
    }
    try {
      await updateClub.mutateAsync({
        clubId: club.id,
        name: form.name,
        contact_email: form.contact_email ? form.contact_email.trim().toLowerCase() : '',
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
  { value: 'principal', label: 'Principal', icon: '🏫', desc: 'College-level student overview' },
  { value: 'hod', label: 'HOD', icon: '🧭', desc: 'Can be assigned to multiple departments' },
  { value: 'student_affairs', label: 'Student Affairs', icon: '🏛️', desc: 'Student affairs and event oversight' },
  { value: 'club_coordinator', label: 'Club Coordinator', icon: '🏛️', desc: 'Manages a single club' },
  { value: 'dept_coordinator', label: 'Dept Coordinator', icon: '🎓', desc: 'Manages a department' },
  { value: 'tutor', label: 'Tutor', icon: '🧑‍🏫', desc: 'Manages one class of students' },
  { value: 'faculty', label: 'Faculty', icon: '👨‍🏫', desc: 'Institutional certificate generator' },
  { value: 'student', label: 'Student', icon: '📚', desc: 'Has certificates & credits' },
  { value: 'guest', label: 'Guest', icon: '🎟️', desc: 'Limited access account' },
]

function NewUserModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1)
  const [selectedRole, setSelectedRole] = useState('')
  const [form, setForm] = useState({ username: '', name: '', email: '', password: '', club_id: '', event_id: '', department: '', departments: [], registration_number: '', batch: '', section: '' })
  const [tutorStudents, setTutorStudents] = useState([])
  const [studentDraft, setStudentDraft] = useState({ name: '', email: '', registration_number: '' })
  const [tutorImportFile, setTutorImportFile] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const createUser = useCreateUser()
  const assignTutorStudents = useAssignTutorStudents()
  const bulkImportTutorStudents = useBulkImportTutorStudents()
  const { data: clubsList } = useClubs()
  const { data: departmentsList } = useDepartments({ is_active: true })
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
    setForm({ username: '', name: '', email: '', password: '', club_id: '', event_id: '', department: '', departments: [], registration_number: '', batch: '', section: '' })
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
    else if (!/^[a-zA-Z0-9._%+-]+@psgitech\.ac\.in$/i.test(form.email.trim())) errs.email = 'Only @psgitech.ac.in emails are allowed'
    if (selectedRole !== 'faculty') {
      if (!form.password || form.password.length < 8) errs.password = 'Min 8 characters'
    } else if (form.password && form.password.length < 8) {
      errs.password = 'Min 8 characters if provided'
    }
    if (selectedRole === 'club_coordinator' && !form.club_id) errs.club_id = 'Required'
    if (selectedRole === 'dept_coordinator' && !form.department) errs.department = 'Required'
    if (selectedRole === 'faculty' && !form.department) errs.department = 'Required'
    if (selectedRole === 'hod' && (!Array.isArray(form.departments) || form.departments.length === 0)) errs.departments = 'Select at least one department'
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
    if (!/^[a-zA-Z0-9._%+-]+@psgitech\.ac\.in$/i.test(email)) {
      setErrors((prev) => ({ ...prev, tutor_students: 'Must be a valid @psgitech.ac.in student email.' }))
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
      password: form.password || (selectedRole === 'faculty' ? form.email.trim().toLowerCase() : form.password),
      role: selectedRole,
    }

    if (selectedRole === 'club_coordinator') {
      payload.club_id = form.club_id
    }
    if (selectedRole === 'dept_coordinator' || selectedRole === 'student' || selectedRole === 'tutor' || selectedRole === 'faculty') {
      if (form.department?.trim()) payload.department = form.department.trim()
    }
    if (selectedRole === 'hod') {
      payload.departments = (form.departments || []).map((d) => d.trim()).filter(Boolean)
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

  const addHodDepartment = () => {
    const next = (form.department || '').trim()
    if (!next) return
    if ((form.departments || []).includes(next)) return
    setForm((prev) => ({
      ...prev,
      departments: [...(prev.departments || []), next],
      department: '',
    }))
    setErrors((prev) => ({ ...prev, departments: undefined }))
  }

  const removeHodDepartment = (slug) => {
    setForm((prev) => ({
      ...prev,
      departments: (prev.departments || []).filter((d) => d !== slug),
    }))
  }

  const canAddHodDepartment = !!(form.department || '').trim() && !(form.departments || []).includes((form.department || '').trim())

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
              <label className="form-label">{selectedRole === 'faculty' ? 'Faculty ID (Username) *' : 'Username *'}</label>
              <input className={`form-input font-mono ${errors.username ? 'form-input-error' : ''}`} value={form.username} onChange={(e) => handleChange('username', e.target.value)} />
              <p className="mt-0.5 text-xs text-gray-400">{selectedRole === 'faculty' ? 'Faculty ID used for login' : 'Cannot be changed later'}</p>
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
              <label className="form-label">{selectedRole === 'faculty' ? 'Password (Default: Email)' : 'Password *'}</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder={selectedRole === 'faculty' ? 'Leave blank to use email' : ''} className={`form-input pr-10 ${errors.password ? 'form-input-error' : ''}`} value={form.password} onChange={(e) => handleChange('password', e.target.value)} />
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
          {(selectedRole === 'dept_coordinator' || selectedRole === 'student' || selectedRole === 'tutor' || selectedRole === 'faculty') && (
            <div>
              <label className="form-label">Department (Name or Slug) *</label>
              <select
                className={`form-input ${errors.department ? 'form-input-error' : ''}`}
                value={form.department}
                onChange={(e) => handleChange('department', e.target.value)}
              >
                <option value="">Select department…</option>
                {(departmentsList || []).map((d) => (
                  <option key={d.id} value={d.slug}>{d.name} ({d.slug})</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Select by department name or slug. Student and HOD scope mapping is applied automatically using this department.</p>
              {(departmentsList || []).length === 0 && (
                <p className="mt-1 text-xs text-gray-500">No active departments available. Create one in the Departments tab first.</p>
              )}
              {errors.department && <p className="form-error">{errors.department}</p>}
            </div>
          )}
          {selectedRole === 'hod' && (
            <div>
              <label className="form-label">Department (Name or Slug) *</label>
              <div className="flex gap-2">
                <select
                  className={`form-input ${errors.departments ? 'form-input-error' : ''}`}
                  value={form.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                >
                  <option value="">Select department…</option>
                  {(departmentsList || []).map((d) => (
                    <option key={d.id} value={d.slug}>{d.name} ({d.slug})</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary whitespace-nowrap"
                  onClick={addHodDepartment}
                  disabled={!canAddHodDepartment}
                >
                  Add
                </button>
              </div>
              {(form.departments || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {(form.departments || []).map((slug) => {
                    const dep = (departmentsList || []).find((d) => d.slug === slug)
                    const label = dep ? `${dep.name} (${dep.slug})` : slug
                    return (
                      <span key={slug} className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs text-cyan-800 ring-1 ring-cyan-200">
                        {label}
                        <button
                          type="button"
                          className="font-semibold text-cyan-900 hover:text-cyan-700"
                          onClick={() => removeHodDepartment(slug)}
                          title="Remove department"
                        >
                          x
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}
              {errors.departments && <p className="form-error">{errors.departments}</p>}
              <p className="mt-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                HOD visibility is automatically applied to students belonging to the selected departments.
              </p>
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

  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (user) {
      setForm({ name: user.name, email: user.email })
      setErrors({})
    }
  }, [user])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.email || !/^[a-zA-Z0-9._%+-]+@psgitech\.ac\.in$/i.test(form.email.trim())) {
      setErrors({ email: 'Only @psgitech.ac.in emails are allowed' })
      return
    }
    updateUser.mutate({ userId: user.id, ...form, email: form.email.trim().toLowerCase() }, { onSuccess: onClose })
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
          <input type="email" className={`form-input ${errors.email ? 'form-input-error' : ''}`} value={form.email} onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setErrors({}); }} />
          {errors.email && <p className="form-error">{errors.email}</p>}
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

  return (
    <>
      <Navbar />
      <div className="flex items-start">
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-[calc(100dvh-3.5rem)] bg-background">
          <div className="page-container">
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'clubs' && <ClubsTab />}
            {activeTab === 'departments' && <DepartmentsTab />}
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
    {
      key: 'cert_number', header: 'Cert No.', searchKey: true,
      render: (v) => <span className="font-mono text-xs font-semibold text-navy">{v ?? '—'}</span>
    },
    {
      key: 'snapshot', header: 'Participant', searchKey: false,
      render: (snap) => <span className="text-sm">{snap?.name ?? '—'}</span>
    },
    {
      key: 'snapshot.email', header: 'Email', searchKey: false,
      render: (_, row) => <span className="text-sm">{row?.snapshot?.email ?? '—'}</span>
    },
    {
      key: 'snapshot.club_name', header: 'Club', searchKey: false,
      render: (_, row) => <span className="text-sm">{row?.snapshot?.club_name ?? '—'}</span>
    },
    {
      key: 'snapshot.event_name', header: 'Event', searchKey: false,
      render: (_, row) => <span className="text-sm">{row?.snapshot?.event_name ?? '—'}</span>
    },
    {
      key: 'cert_type', header: 'Cert Type',
      render: (v) => <StatusBadge status={v} size="sm" />
    },
    {
      key: 'status', header: 'Status',
      render: (v) => <StatusBadge status={v} size="sm" />
    },
    { key: 'issued_at', header: 'Issued', render: (v) => fmtDate(v) },
    {
      key: '_actions', header: 'Actions', searchKey: false, render: (_, row) => (
        !['revoked', 'emailed'].includes((row.status || '').toLowerCase()) && (
          <button
            onClick={() => setRevokeTarget(row)}
            className="rounded p-1 text-xs font-semibold text-red-600 hover:bg-red-50 hover:underline"
          >
            Revoke
          </button>
        )
      )
    },
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

// ── STUDENT CLUB MEMBERSHIPS ────────────────────────────────────────────────
function StudentClubMemberships({ studentId }) {
  const { data: memberships, isLoading } = useStudentClubMemberships(studentId)

  if (isLoading) return <span className="text-xs text-gray-400">Loading memberships...</span>

  const approved = (memberships || []).filter(m => m.status === 'approved')
  if (approved.length === 0) return <span className="text-xs text-gray-400">No active club memberships</span>

  return (
    <div className="flex flex-wrap gap-1">
      {approved.map(m => (
        <span key={m.id} className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200">
          {m.club_name}
        </span>
      ))}
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
                    <div className="mt-2">
                      <StudentClubMemberships studentId={item.student.id} />
                    </div>
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
  const deleteRule = useDeleteCreditRule()

  const [localRules, setLocalRules] = useState([])
  const [editingIndex, setEditingIndex] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [newRuleType, setNewRuleType] = useState('')
  const [newRulePoints, setNewRulePoints] = useState('0')
  const [deletingRuleId, setDeletingRuleId] = useState(null)

  useEffect(() => {
    if (!rulesData) return
    const ordered = [...rulesData].sort((a, b) =>
      String(a?.cert_type || '').localeCompare(String(b?.cert_type || ''), undefined, { sensitivity: 'base' }),
    )
    setLocalRules(ordered)
  }, [rulesData])

  const normalizeRuleType = (value) =>
    (value || '')
      .trim()
      .toLowerCase()
      .replace(/-/g, '_')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')

  const startEdit = (idx, value) => {
    setEditingIndex(idx)
    setEditValue(value)
  }

  const saveInline = () => {
    const numValue = Math.min(1000, Math.max(0, parseInt(editValue) || 0))
    const updated = [...localRules]
    updated[editingIndex].points = numValue
    setLocalRules(updated)
    setEditingIndex(null)
  }

  const handleAddRule = () => {
    const certType = normalizeRuleType(newRuleType)
    const points = Math.min(1000, Math.max(0, parseInt(newRulePoints) || 0))
    if (!certType) return

    const exists = localRules.some((r) => normalizeRuleType(r.cert_type) === certType)
    if (exists) return

    const nextRules = [...localRules, { cert_type: certType, points }].sort((a, b) =>
      String(a?.cert_type || '').localeCompare(String(b?.cert_type || ''), undefined, { sensitivity: 'base' }),
    )
    setLocalRules(nextRules)
    setNewRuleType('')
    setNewRulePoints('0')
  }

  const handleSaveAll = () => {
    const map = new Map()
    for (const rule of localRules) {
      const certType = normalizeRuleType(rule?.cert_type)
      if (!certType) continue
      const points = Math.min(1000, Math.max(0, parseInt(rule?.points) || 0))
      map.set(certType, { cert_type: certType, points })
    }
    updateRules.mutate(Array.from(map.values()))
  }

  const handleDeleteRule = async (rule) => {
    if (!rule?.id) return
    const ok = window.confirm(`Delete credit rule "${rule.cert_type}"? This action cannot be undone.`)
    if (!ok) return

    try {
      setDeletingRuleId(rule.id)
      await deleteRule.mutateAsync(rule.id)
      setLocalRules((prev) => prev.filter((r) => r.id !== rule.id))
      if (editingIndex !== null) {
        setEditingIndex(null)
        setEditValue('')
      }
    } finally {
      setDeletingRuleId(null)
    }
  }

  const canAddRule = (() => {
    const normalized = normalizeRuleType(newRuleType)
    if (!normalized) return false
    return !localRules.some((r) => normalizeRuleType(r.cert_type) === normalized)
  })()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Credit Points Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">
          These point values apply globally across all clubs, tutors, and students.
        </p>
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-foreground">Add New Credit Rule</h2>
        <p className="mt-1 text-xs text-gray-500">Example: hackathon with 3 points. This will appear in tutor and student role selections after saving.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="form-label">Rule Name</label>
            <input
              className="form-input"
              value={newRuleType}
              onChange={(e) => setNewRuleType(e.target.value)}
              placeholder="hackathon"
            />
          </div>
          <div>
            <label className="form-label">Points</label>
            <input
              type="number"
              min={0}
              max={1000}
              className="form-input"
              value={newRulePoints}
              onChange={(e) => setNewRulePoints(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              className="btn-primary w-full"
              disabled={!canAddRule}
              onClick={handleAddRule}
            >
              Add Rule
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex py-12 justify-center"><LoadingSpinner /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {localRules.map((rule, idx) => (
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
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule)}
                      disabled={deleteRule.isPending && deletingRuleId === rule.id}
                      className="rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Delete this rule"
                    >
                      {deleteRule.isPending && deletingRuleId === rule.id ? 'Deleting...' : 'Delete'}
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
  const [isResetOpen, setIsResetOpen] = useState(false)

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Overview</h1>
          <p className="mt-1 text-sm text-gray-500">Monitor the platform and manage global credit resets from one place.</p>
        </div>
        <button
          type="button"
          className="btn-danger sm:self-start"
          onClick={() => setIsResetOpen(true)}
        >
          Reset Credit Points
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        This will start the next semester and reset only current semester totals. Certificates will remain visible.
      </div>

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

      <CreditResetModal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
      />
    </div>
  )
}

function CreditResetModal({ isOpen, onClose }) {
  const [semester, setSemester] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const resetCredits = useResetStudentCredits()

  useEffect(() => {
    if (!isOpen) {
      setSemester('')
      setAdminPassword('')
    }
  }, [isOpen])

  const handleSubmit = (e) => {
    e.preventDefault()
    const semesterText = semester.trim()
    if (!semesterText || !adminPassword || resetCredits.isPending) return

    resetCredits.mutate(
      { semester: semesterText, adminPassword },
      {
        onSuccess: () => {
          setSemester('')
          setAdminPassword('')
          onClose()
        },
      },
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reset Credit Points">
      <form className="space-y-4" onSubmit={handleSubmit} autoComplete="off">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          This action sets the next semester and resets current semester totals only. Certificates remain untouched.
        </div>
        <div>
          <label className="form-label">Next semester</label>
          <input
            className="form-input"
            name="next_semester_label"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            placeholder="2025-2026 EVEN"
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-gray-500">Enter the next semester label before confirming the reset.</p>
        </div>
        <div>
          <label className="form-label">Super Admin Password</label>
          <input
            type="password"
            className="form-input"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
          />
          <p className="mt-1 text-xs text-gray-500">Password verification is required to complete this reset.</p>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={resetCredits.isPending}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-danger min-w-[160px]"
            disabled={resetCredits.isPending || !semester.trim() || !adminPassword}
          >
            {resetCredits.isPending ? <LoadingSpinner size="sm" label="" /> : 'Reset Credit Points'}
          </button>
        </div>
      </form>
    </Modal>
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
    {
      key: '_actions', header: 'Actions', searchKey: false, render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button title="Edit" onClick={() => setEditClub(row)} className="rounded p-1 text-gray-400 hover:text-navy hover:bg-navy/10 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
        </div>
      )
    },
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

function DepartmentModal({ isOpen, onClose, department }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  const createDepartment = useCreateDepartment()
  const updateDepartment = useUpdateDepartment()

  useEffect(() => {
    if (!isOpen) return
    setName(department?.name || '')
    setSlug(department?.slug || '')
    setError('')
  }, [isOpen, department])

  const isEdit = !!department

  const handleSubmit = (e) => {
    e.preventDefault()
    const normalized = name.trim()
    const normalizedSlug = slug.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!normalized) {
      setError('Department name is required')
      return
    }
    if (!normalizedSlug) {
      setError('Department slug is required')
      return
    }

    const payload = { name: normalized, slug: normalizedSlug }
    const mutation = isEdit
      ? updateDepartment.mutateAsync({ departmentId: department.id, ...payload })
      : createDepartment.mutateAsync(payload)

    mutation
      .then(() => onClose())
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Unable to save department')
      })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Department' : 'New Department'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="form-label">Department Name *</label>
          <input
            className={`form-input ${error ? 'form-input-error' : ''}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (error) setError('')
            }}
            placeholder="Computer Science and Engineering"
          />
          {error && <p className="form-error">{error}</p>}
        </div>
        <div>
          <label className="form-label">Slug *</label>
          <input
            className="form-input font-mono"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
              if (error) setError('')
            }}
            placeholder="CSE"
          />
          <p className="mt-1 text-xs text-gray-500">Uppercase letters and digits only.</p>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="btn-primary min-w-[140px]"
            disabled={createDepartment.isPending || updateDepartment.isPending}
          >
            {(createDepartment.isPending || updateDepartment.isPending)
              ? <LoadingSpinner size="sm" label="" />
              : (isEdit ? 'Save Changes' : 'Create Department')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DepartmentsTab() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)
  const filters = useMemo(() => {
    const f = {}
    if (debouncedSearch) f.search = debouncedSearch
    return f
  }, [debouncedSearch])

  const { data: departments, isLoading } = useDepartments(filters)
  const removeDepartment = useDeleteDepartment()

  const [showNew, setShowNew] = useState(false)
  const [editDepartment, setEditDepartment] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)

  const columns = [
    { key: 'name', header: 'Department Name', sortable: true, render: (v) => <span className="font-semibold">{v}</span> },
    { key: 'slug', header: 'Slug', render: (v) => <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono font-bold">{v}</span> },
    { key: 'created_at', header: 'Created', sortable: true, render: (v) => fmtDate(v) },
    {
      key: '_actions', header: 'Actions', searchKey: false, render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            title="Edit"
            onClick={() => setEditDepartment(row)}
            className="rounded p-1 text-gray-400 hover:text-navy hover:bg-navy/10 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button
            title="Remove"
            onClick={() => setRemoveTarget(row)}
            className="rounded p-1 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 12a1 1 0 001 1h6a1 1 0 001-1l1-12" /></svg>
          </button>
        </div>
      )
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Departments</h1>
        <button className="btn-primary" onClick={() => setShowNew(true)}>+ New Department</button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" placeholder="Search departments…" value={search} onChange={(e) => setSearch(e.target.value)} className="form-input w-72" />
      </div>

      <DataTable
        columns={columns}
        data={departments || []}
        isLoading={isLoading}
        emptyMessage="No departments found. Create your first department."
      />

      <DepartmentModal isOpen={showNew} onClose={() => setShowNew(false)} />
      <DepartmentModal isOpen={!!editDepartment} onClose={() => setEditDepartment(null)} department={editDepartment} />

      <ConfirmModal
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget?.id) return
          removeDepartment.mutate(removeTarget.id, {
            onSuccess: () => setRemoveTarget(null),
          })
        }}
        title="Remove Department?"
        message={`Remove ${removeTarget?.name || 'this department'}? This is blocked if users are still assigned to it.`}
        confirmLabel="Remove"
        isLoading={removeDepartment.isPending}
      />
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
              {['name', 'email', 'username', 'password', 'department', 'registration_number', 'batch', 'section', 'tutor_email'].map(col => (
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
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
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

function FacultyBulkImportModal({ isOpen, onClose }) {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const importMutation = useBulkImportFaculty()
  const downloadSample = useDownloadFacultyImportSample()

  const handleClose = () => {
    setFile(null)
    setResult(null)
    onClose()
  }

  const handleSubmit = () => {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    importMutation.mutate(formData, {
      onSuccess: ({ data }) => setResult(data),
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Bulk Import Faculty" wide>
      {!result ? (
        <div className="space-y-5">
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
            <p className="text-sm font-semibold text-indigo-900 mb-1">Excel File Requirements</p>
            <p className="text-xs text-indigo-700">
              Upload a <span className="font-mono font-bold">.xlsx</span> file with these exact column headers
              (case-insensitive, in any order):
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['name', 'faculty id', 'email', 'department', 'username (faculty id)', 'password (faculty id)'].map((col) => (
                <span key={col} className="inline-block rounded bg-indigo-100 px-2 py-0.5 font-mono text-[11px] text-indigo-800 font-semibold">{col}</span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-indigo-600">
              Note: Both username and initial password will be set from the file (default: Faculty ID). Department is strictly required. Upon first login, faculty will be prompted to change their password via email OTP.
            </p>
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
            <label className="form-label">Select Faculty Excel File (.xlsx)</label>
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
              {importMutation.isPending ? 'Importing...' : 'Import Faculty'}
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

function TutorSwitchModal({ isOpen, onClose, tutors, initialTutor, initialClass, students }) {
  const [fromTutorId, setFromTutorId] = useState('')
  const [toTutorId, setToTutorId] = useState('')
  const [selectedStudentEmails, setSelectedStudentEmails] = useState(new Set())
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const switchMutation = useReassignTutorStudents()

  const fromTutor = (tutors || []).find((t) => t.id === fromTutorId) || null
  const targetTutorOptions = (tutors || []).filter((t) => t.id !== fromTutorId)
  const toTutor = targetTutorOptions.find((t) => t.id === toTutorId) || null

  const mappedStudents = useMemo(() => {
    if (!fromTutor) return []
    const fromEmail = (fromTutor.email || '').toLowerCase()
    const tutorClasses = fromTutor.assigned_classes && fromTutor.assigned_classes.length > 0
      ? fromTutor.assigned_classes
      : (fromTutor.department && fromTutor.batch && fromTutor.section)
      ? [{ department: fromTutor.department, batch: fromTutor.batch, section: fromTutor.section }]
      : []

    return (students || []).filter((st) => {
      if (st.tutor_id === fromTutor.id) return true
      if (st.tutor_email && fromEmail && st.tutor_email.toLowerCase() === fromEmail) return true
      if (!st.tutor_id && !st.tutor_email && st.department && st.batch && st.section) {
        return tutorClasses.some(
          (c) =>
            (c.department || '').toLowerCase() === st.department.toLowerCase() &&
            (c.batch || '').toLowerCase() === st.batch.toLowerCase() &&
            (c.section || '').toLowerCase() === st.section.toLowerCase(),
        )
      }
      return false
    })
  }, [fromTutor, students])

  // Distinct classes among mapped students
  const availableClasses = useMemo(() => {
    const map = new Map()
    mappedStudents.forEach((st) => {
      if (st.department || st.batch || st.section) {
        const key = `${st.department || '—'}|${st.batch || '—'}|${st.section || '—'}`
        const label = `${st.department || 'Dept'} · Batch ${st.batch || '—'} · Sec ${st.section || '—'}`
        if (!map.has(key)) {
          map.set(key, {
            key,
            label,
            department: st.department,
            batch: st.batch,
            section: st.section,
            count: 0,
          })
        }
        map.get(key).count++
      }
    })
    return Array.from(map.values())
  }, [mappedStudents])

  // Initialize tutor and classFilter when modal opens
  useEffect(() => {
    if (!isOpen) return
    setFromTutorId(initialTutor?.id || '')
    setToTutorId('')
    setSearch('')
    if (initialClass && (initialClass.department || initialClass.batch || initialClass.section)) {
      const initKey = `${initialClass.department || '—'}|${initialClass.batch || '—'}|${initialClass.section || '—'}`
      setClassFilter(initKey)
    } else {
      setClassFilter('all')
    }
  }, [isOpen, initialTutor, initialClass])

  // Keep selectedStudentEmails synchronized with the active classFilter
  useEffect(() => {
    if (mappedStudents.length === 0) {
      setSelectedStudentEmails(new Set())
      return
    }
    if (classFilter === 'all') {
      const all = new Set(mappedStudents.map((s) => (s.email || '').toLowerCase()).filter(Boolean))
      setSelectedStudentEmails(all)
    } else {
      const groupStudents = mappedStudents.filter((st) => {
        const k = `${st.department || '—'}|${st.batch || '—'}|${st.section || '—'}`
        return k === classFilter
      })
      const groupEmails = new Set(groupStudents.map((s) => (s.email || '').toLowerCase()).filter(Boolean))
      setSelectedStudentEmails(groupEmails)
    }
  }, [mappedStudents, classFilter])

  // Handler when user clicks a class filter chip: immediately switch active filter and select that group
  const handleSelectClassFilter = (targetKey) => {
    setClassFilter(targetKey)
    if (targetKey === 'all') {
      const all = new Set(mappedStudents.map((s) => (s.email || '').toLowerCase()).filter(Boolean))
      setSelectedStudentEmails(all)
    } else {
      const groupStudents = mappedStudents.filter((st) => {
        const k = `${st.department || '—'}|${st.batch || '—'}|${st.section || '—'}`
        return k === targetKey
      })
      const groupEmails = new Set(groupStudents.map((s) => (s.email || '').toLowerCase()).filter(Boolean))
      setSelectedStudentEmails(groupEmails)
    }
  }

  // Filter students by class and search
  const visibleStudents = useMemo(() => {
    return mappedStudents.filter((st) => {
      if (classFilter !== 'all') {
        const key = `${st.department || '—'}|${st.batch || '—'}|${st.section || '—'}`
        if (key !== classFilter) return false
      }
      if (search) {
        const q = search.toLowerCase()
        const match =
          (st.name || '').toLowerCase().includes(q) ||
          (st.registration_number || '').toLowerCase().includes(q) ||
          (st.email || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [mappedStudents, classFilter, search])

  // Only visible students that are checked are considered selected for transfer
  const studentsToSwitch = useMemo(() => {
    return visibleStudents.filter((st) =>
      selectedStudentEmails.has((st.email || '').toLowerCase()),
    )
  }, [visibleStudents, selectedStudentEmails])

  const isAllVisibleSelected =
    visibleStudents.length > 0 &&
    visibleStudents.every((s) => selectedStudentEmails.has((s.email || '').toLowerCase()))

  const toggleSelectAllVisible = () => {
    setSelectedStudentEmails((prev) => {
      const next = new Set(prev)
      if (isAllVisibleSelected) {
        visibleStudents.forEach((s) => {
          if (s.email) next.delete(s.email.toLowerCase())
        })
      } else {
        visibleStudents.forEach((s) => {
          if (s.email) next.add(s.email.toLowerCase())
        })
      }
      return next
    })
  }

  const toggleStudent = (email) => {
    if (!email) return
    const lower = email.toLowerCase()
    setSelectedStudentEmails((prev) => {
      const next = new Set(prev)
      if (next.has(lower)) {
        next.delete(lower)
      } else {
        next.add(lower)
      }
      return next
    })
  }

  const activeClassObj = availableClasses.find((c) => c.key === classFilter)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!fromTutorId || !toTutorId || studentsToSwitch.length === 0) return
    switchMutation.mutate(
      {
        fromTutorId,
        toTutorId,
        studentEmails: studentsToSwitch.map((s) => s.email),
      },
      {
        onSuccess: () => onClose(),
      },
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Switch Tutor For Students" wide>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-gray-600">
          Select current and target tutor. Use the class filter chips below to switch an entire section group (e.g. Sec A or Sec B) or customize individual student checkboxes.
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

        {fromTutor && toTutor && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 text-gray-600">
              <p><span className="font-semibold text-gray-800">Source Tutor:</span> {fromTutor.name}</p>
              <p className="text-[11px] text-gray-500">{fromTutor.email} · {fromTutor.department || '—'}</p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50/70 p-3 text-green-800">
              <p><span className="font-semibold text-green-900">Target Tutor:</span> {toTutor.name}</p>
              <p className="text-[11px] text-green-700">{toTutor.email} · {toTutor.department || '—'}</p>
            </div>
          </div>
        )}

        {/* Student Selection Section */}
        {fromTutor && (
          <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/80 pb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Select Students to Reassign
                </h4>
                <p className="text-[11px] text-gray-500">
                  {classFilter !== 'all' && activeClassObj ? (
                    <span>
                      Filtered to <span className="font-semibold text-indigo-700">{activeClassObj.label}</span>. Only students selected in this group will be switched.
                    </span>
                  ) : (
                    <span>Showing all classes mapped to this tutor. Click a class filter chip below to switch a specific class group.</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-bold text-indigo-700">
                  Selected: {studentsToSwitch.length} / {visibleStudents.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedStudentEmails(new Set(visibleStudents.map((s) => (s.email || '').toLowerCase()).filter(Boolean)))}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudentEmails((prev) => {
                      const next = new Set(prev)
                      visibleStudents.forEach((s) => {
                        if (s.email) next.delete(s.email.toLowerCase())
                      })
                      return next
                    })
                  }}
                  className="text-[11px] font-semibold text-gray-500 hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Filter toolbar: Class chips + Search box */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {availableClasses.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-gray-500">Filter Class:</span>
                  <button
                    type="button"
                    onClick={() => handleSelectClassFilter('all')}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      classFilter === 'all'
                        ? 'bg-navy text-white shadow-2xs font-bold'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    All ({mappedStudents.length})
                  </button>
                  {availableClasses.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => handleSelectClassFilter(c.key)}
                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        classFilter === c.key
                          ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                      title={`Filter and switch only ${c.label}`}
                    >
                      {c.label} ({c.count})
                    </button>
                  ))}
                </div>
              )}
              <div className="w-full sm:w-64 ml-auto">
                <input
                  type="search"
                  placeholder="Search student name, reg no…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input text-xs py-1"
                />
              </div>
            </div>

            {/* Scrollable Students Table */}
            {mappedStudents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-xs text-gray-500">
                No students currently mapped to this tutor.
              </div>
            ) : visibleStudents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-xs text-gray-500">
                No students matching search filter.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-2xs">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50 text-gray-600 sticky top-0 z-10">
                    <tr>
                      <th className="w-10 px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isAllVisibleSelected}
                          onChange={toggleSelectAllVisible}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-navy focus:ring-navy cursor-pointer"
                          title="Select / Deselect all visible students"
                        />
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">Student Name</th>
                      <th className="px-3 py-2 text-left font-semibold">Reg Number</th>
                      <th className="px-3 py-2 text-left font-semibold">Class / Section</th>
                      <th className="px-3 py-2 text-left font-semibold">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleStudents.map((st) => {
                      const isSelected = selectedStudentEmails.has((st.email || '').toLowerCase())
                      return (
                        <tr
                          key={st.id || st.email}
                          onClick={() => toggleStudent(st.email)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-indigo-50/50 hover:bg-indigo-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleStudent(st.email)}
                              className="h-3.5 w-3.5 rounded border-gray-300 text-navy focus:ring-navy cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900">{st.name}</td>
                          <td className="px-3 py-2 font-mono text-gray-600 font-semibold">
                            {st.registration_number || '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {st.department || '—'} · {st.batch || '—'} · Sec {st.section || '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-500 font-mono text-[11px]">{st.email}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!fromTutorId || !toTutorId || studentsToSwitch.length === 0 || switchMutation.isPending}
          >
            {switchMutation.isPending
              ? 'Switching...'
              : classFilter !== 'all' && activeClassObj
              ? `Switch ${studentsToSwitch.length} Student${studentsToSwitch.length !== 1 ? 's' : ''} in Sec ${activeClassObj.section || ''}`
              : `Switch ${studentsToSwitch.length} Student${studentsToSwitch.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── TUTOR CLASS SWITCH MODAL ──────────────────────────────────────────────────
function SwitchTutorClassModal({ isOpen, onClose, tutor, departments }) {
  const [department, setDepartment] = useState('')
  const [batch, setBatch] = useState('')
  const [section, setSection] = useState('')
  const updateUser = useUpdateUser()

  useEffect(() => {
    if (!isOpen || !tutor) return
    setDepartment(tutor.department || '')
    setBatch(tutor.batch || '')
    setSection(tutor.section || '')
  }, [isOpen, tutor])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!department || !batch || !section) return
    updateUser.mutate(
      {
        userId: tutor.id,
        department,
        batch: batch.trim(),
        section: section.trim().toUpperCase(),
      },
      {
        onSuccess: () => onClose(),
      },
    )
  }

  if (!tutor) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Switch Class for ${tutor.name}`}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-gray-600">
          Switch class for <span className="font-semibold text-gray-900">{tutor.name}</span> (Faculty ID: {tutor.username}).
        </p>

        <div>
          <label className="form-label">Department *</label>
          <select
            className="form-input"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
          >
            <option value="">Select Department...</option>
            {(departments || []).map((d) => (
              <option key={d.id || d.name} value={d.name}>
                {d.name} {d.slug ? `(${d.slug})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">Batch (e.g. 2024-2028) *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. 2024-2028"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="form-label">Section (e.g. A, B, C) *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. A"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            required
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!department || !batch || !section || updateUser.isPending}
          >
            {updateUser.isPending ? 'Saving...' : 'Switch Class'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── ADD TUTOR CLASS MODAL ─────────────────────────────────────────────────────
function AddTutorClassModal({ isOpen, onClose, tutor, departments }) {
  const [department, setDepartment] = useState('')
  const [batch, setBatch] = useState('')
  const [section, setSection] = useState('')
  const [assignUnassigned, setAssignUnassigned] = useState(true)
  const addClassMutation = useAddTutorClass()

  useEffect(() => {
    if (!isOpen || !tutor) return
    setDepartment(tutor.department || '')
    setBatch(tutor.batch || '')
    setSection('')
    setAssignUnassigned(true)
  }, [isOpen, tutor])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!department || !batch || !section) return
    addClassMutation.mutate(
      {
        tutorId: tutor.id,
        department,
        batch: batch.trim(),
        section: section.trim().toUpperCase(),
        assignUnassigned,
      },
      {
        onSuccess: () => onClose(),
      },
    )
  }

  if (!tutor) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Add Class for ${tutor.name}`}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-gray-600">
          Assign an additional class to <span className="font-semibold text-gray-900">{tutor.name}</span> (Faculty ID: {tutor.username}).
        </p>

        <div>
          <label className="form-label">Department *</label>
          <select
            className="form-input"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
          >
            <option value="">Select Department...</option>
            {(departments || []).map((d) => (
              <option key={d.id || d.name} value={d.name}>
                {d.name} {d.slug ? `(${d.slug})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">Batch (e.g. 2024-2028) *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. 2024-2028"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="form-label">Section (e.g. A, B, C) *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. B"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="add-class-assign-unassigned"
            checked={assignUnassigned}
            onChange={(e) => setAssignUnassigned(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="add-class-assign-unassigned" className="text-xs text-gray-700 cursor-pointer select-none">
            Automatically map unassigned students in this class to {tutor.name}
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="btn-primary"
            disabled={!department || !batch || !section || addClassMutation.isPending}
          >
            {addClassMutation.isPending ? 'Adding Class...' : 'Add Class'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── MAKE FACULTY TUTOR MODAL ────────────────────────────────────────────────
function MakeFacultyTutorModal({ isOpen, onClose, faculty, departments }) {
  const [department, setDepartment] = useState('')
  const [batch, setBatch] = useState('')
  const [section, setSection] = useState('')
  const [assignUnassigned, setAssignUnassigned] = useState(true)
  const makeTutorMutation = useMakeFacultyTutor()

  useEffect(() => {
    if (!isOpen || !faculty) return
    setDepartment(faculty.department || '')
    setBatch(faculty.batch || '')
    setSection(faculty.section || '')
    setAssignUnassigned(true)
  }, [isOpen, faculty])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!department || !batch || !section) return
    makeTutorMutation.mutate(
      {
        facultyId: faculty.id,
        department,
        batch: batch.trim(),
        section: section.trim().toUpperCase(),
        assignUnassigned,
      },
      {
        onSuccess: () => onClose(),
      },
    )
  }

  if (!faculty) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Make as Tutor: ${faculty.name}`}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-lg bg-indigo-50 p-3 border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
          <p className="font-semibold mb-1">Assign Class to Faculty</p>
          <p>
            Promote <span className="font-bold text-gray-900">{faculty.name}</span> (Faculty ID: <span className="font-mono font-bold text-gray-900">{faculty.username}</span>) as a class Tutor. They will retain full faculty certificate generation privileges and gain class mentoring rights.
          </p>
        </div>

        <div>
          <label className="form-label">Department *</label>
          <select
            className="form-input"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
          >
            <option value="">Select Department...</option>
            {(departments || []).map((d) => (
              <option key={d.id || d.name} value={d.name}>
                {d.name} {d.slug ? `(${d.slug})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="form-label">Batch (e.g. 2024-2028) *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. 2024-2028"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="form-label">Section (e.g. A, B, C) *</label>
          <input
            type="text"
            className="form-input uppercase"
            placeholder="e.g. A"
            maxLength={5}
            value={section}
            onChange={(e) => setSection(e.target.value.toUpperCase())}
            required
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="make-tutor-assign-unassigned"
            checked={assignUnassigned}
            onChange={(e) => setAssignUnassigned(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="make-tutor-assign-unassigned" className="text-xs text-gray-700 cursor-pointer select-none">
            Automatically map unassigned students of this class to this tutor
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={onClose}
            disabled={makeTutorMutation.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary text-sm bg-indigo-600 hover:bg-indigo-700"
            disabled={makeTutorMutation.isPending || !department || !batch || !section}
          >
            {makeTutorMutation.isPending ? 'Assigning...' : 'Confirm & Make as Tutor'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── STUDENT GROUPED VIEW ──────────────────────────────────────────────────────
function StudentGroupedView({
  students,
  isLoading,
  tutors,
  departments,
  onSwitchTutor,
  onEditUser,
  onDeleteUser,
}) {
  const [deptFilter, setDeptFilter] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [tutorFilter, setTutorFilter] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)

  // Options for dropdowns
  const deptOptions = useMemo(() => {
    const s = new Set()
    ;(departments || []).forEach((d) => { if (d.name) s.add(d.name) })
    ;(students || []).forEach((u) => { if (u.department) s.add(u.department) })
    return Array.from(s).sort()
  }, [departments, students])

  const batchOptions = useMemo(() => {
    const s = new Set()
    ;(students || []).forEach((u) => { if (u.batch) s.add(u.batch) })
    return Array.from(s).sort()
  }, [students])

  const sectionOptions = useMemo(() => {
    const s = new Set()
    ;(students || []).forEach((u) => { if (u.section) s.add(u.section) })
    return Array.from(s).sort()
  }, [students])

  // Filter students
  const filteredStudents = useMemo(() => {
    return (students || []).filter((s) => {
      if (deptFilter && (s.department || '').toLowerCase() !== deptFilter.toLowerCase()) return false
      if (batchFilter && (s.batch || '').toLowerCase() !== batchFilter.toLowerCase()) return false
      if (sectionFilter && (s.section || '').toLowerCase() !== sectionFilter.toLowerCase()) return false
      if (tutorFilter) {
        if (tutorFilter === '__unassigned__') {
          if (s.tutor_id || s.tutor_name) return false
        } else {
          if (
            s.tutor_id !== tutorFilter &&
            (s.tutor_name || '') !== tutorFilter &&
            (s.tutor_email || '') !== tutorFilter
          ) {
            return false
          }
        }
      }
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase()
        const match =
          (s.name || '').toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q) ||
          (s.registration_number || '').toLowerCase().includes(q) ||
          (s.username || '').toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [students, deptFilter, batchFilter, sectionFilter, tutorFilter, debouncedSearch])

  // Group: Department -> Batch -> Section -> Tutor
  const groupedData = useMemo(() => {
    const depts = {}
    for (const s of filteredStudents) {
      const dept = (s.department || 'Unassigned Department').trim()
      const batch = (s.batch || 'Unassigned Batch').trim()
      const section = (s.section || 'Unassigned Section').trim()
      const tutorKey = s.tutor_id || (s.tutor_name ? `name:${s.tutor_name}` : '__unassigned__')
      const tutorLabel = s.tutor_name || 'Unassigned Tutor'

      if (!depts[dept]) depts[dept] = {}
      if (!depts[dept][batch]) depts[dept][batch] = {}
      if (!depts[dept][batch][section]) depts[dept][batch][section] = {}
      if (!depts[dept][batch][section][tutorKey]) {
        depts[dept][batch][section][tutorKey] = {
          key: tutorKey,
          label: tutorLabel,
          tutorId: s.tutor_id || null,
          tutorEmail: s.tutor_email || null,
          tutorUsername: s.tutor_username || null,
          students: [],
        }
      }
      depts[dept][batch][section][tutorKey].students.push(s)
    }
    return depts
  }, [filteredStudents])

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Filters ({filteredStudents.length} of {students?.length || 0} students)
          </span>
          {(deptFilter || batchFilter || sectionFilter || tutorFilter || search) && (
            <button
              type="button"
              onClick={() => {
                setDeptFilter('')
                setBatchFilter('')
                setSectionFilter('')
                setTutorFilter('')
                setSearch('')
              }}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          <div>
            <label className="form-label text-[11px]">Department</label>
            <select
              className="form-input text-xs py-1.5"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {deptOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label text-[11px]">Batch</label>
            <select
              className="form-input text-xs py-1.5"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
            >
              <option value="">All Batches</option>
              {batchOptions.map((b) => (
                <option key={b} value={b}>Batch {b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label text-[11px]">Section</label>
            <select
              className="form-input text-xs py-1.5"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
            >
              <option value="">All Sections</option>
              {sectionOptions.map((sec) => (
                <option key={sec} value={sec}>Section {sec}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label text-[11px]">Tutor</label>
            <select
              className="form-input text-xs py-1.5"
              value={tutorFilter}
              onChange={(e) => setTutorFilter(e.target.value)}
            >
              <option value="">All Tutors</option>
              {(tutors || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.username})
                </option>
              ))}
              <option value="__unassigned__">Unassigned Tutor</option>
            </select>
          </div>

          <div>
            <label className="form-label text-[11px]">Search</label>
            <input
              type="search"
              placeholder="Name, Reg No, Email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input text-xs py-1.5"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-12 text-center">
          <LoadingSpinner size="lg" label="Loading students..." />
        </div>
      ) : Object.keys(groupedData).length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 font-medium">No students found matching your filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedData).map(([dept, batches]) => {
            const deptStudentCount = Object.values(batches).reduce(
              (acc, secs) =>
                acc +
                Object.values(secs).reduce(
                  (a2, tuts) => a2 + Object.values(tuts).reduce((a3, t) => a3 + t.students.length, 0),
                  0,
                ),
              0,
            )

            return (
              <div
                key={dept}
                className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* 1. Department Heading */}
                <div className="bg-gradient-to-r from-navy/10 via-indigo-50/50 to-transparent border-b border-gray-200 px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-white text-xs font-bold shadow-xs">
                      {dept.slice(0, 3).toUpperCase()}
                    </span>
                    <div>
                      <h2 className="text-base font-bold text-gray-900 tracking-tight">
                        Department: {dept}
                      </h2>
                    </div>
                  </div>
                  <span className="rounded-full bg-navy/10 px-3 py-1 text-xs font-semibold text-navy">
                    {deptStudentCount} {deptStudentCount === 1 ? 'Student' : 'Students'}
                  </span>
                </div>

                <div className="p-5 space-y-6">
                  {Object.entries(batches).map(([batch, sections]) => {
                    return (
                      <div
                        key={batch}
                        className="rounded-xl border border-gray-200/80 bg-gray-50/50 p-4 space-y-4"
                      >
                        {/* 2. Batch Heading */}
                        <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-800 bg-indigo-100/70 border border-indigo-200 px-3 py-1 rounded-md">
                            Batch {batch}
                          </span>
                        </div>

                        <div className="space-y-4">
                          {Object.entries(sections).map(([section, tutorsMap]) => {
                            return (
                              <div
                                key={section}
                                className="rounded-lg border border-gray-200 bg-white p-4 shadow-2xs space-y-4"
                              >
                                {/* 3. Section Heading */}
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-800">
                                      Section: {section}
                                    </span>
                                  </div>
                                </div>

                                {/* 4. Tutors under this Section */}
                                <div className="space-y-4">
                                  {Object.values(tutorsMap).map((tutorGroup) => {
                                    const tutorObj =
                                      (tutors || []).find(
                                        (t) =>
                                          t.id === tutorGroup.tutorId ||
                                          (tutorGroup.tutorEmail && t.email?.toLowerCase() === tutorGroup.tutorEmail.toLowerCase()),
                                      ) || null

                                    return (
                                      <div
                                        key={tutorGroup.key}
                                        className="rounded-lg border border-indigo-100 bg-indigo-50/20 p-3.5 space-y-3"
                                      >
                                        {/* Tutor Heading + Switch Tutor Option */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-gray-200 shadow-2xs">
                                          <div className="flex items-center gap-2.5">
                                            <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
                                            <span className="text-sm font-semibold text-gray-900">
                                              Tutor: {tutorGroup.label}
                                              {tutorGroup.tutorUsername ? ` (${tutorGroup.tutorUsername})` : ''}
                                            </span>
                                            <span className="text-xs text-gray-500 font-medium">
                                              · {tutorGroup.students.length}{' '}
                                              {tutorGroup.students.length === 1 ? 'student' : 'students'}
                                            </span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => onSwitchTutor(tutorObj, { department: dept, batch, section })}
                                            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-200"
                                          >
                                            ⇄ Switch Tutor
                                          </button>
                                        </div>

                                        {/* Student List Table */}
                                        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                          <table className="min-w-full divide-y divide-gray-200 text-xs">
                                            <thead className="bg-gray-50 text-gray-600 font-medium">
                                              <tr>
                                                <th className="px-3.5 py-2.5 text-left">Student Name</th>
                                                <th className="px-3.5 py-2.5 text-left">Registration No</th>
                                                <th className="px-3.5 py-2.5 text-left">Email</th>
                                                <th className="px-3.5 py-2.5 text-left">Status</th>
                                                <th className="px-3.5 py-2.5 text-right">Actions</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                              {tutorGroup.students.map((st) => (
                                                <tr
                                                  key={st.id}
                                                  className="hover:bg-gray-50/80 transition-colors"
                                                >
                                                  <td className="px-3.5 py-2 font-medium text-gray-900">
                                                    {st.name}
                                                  </td>
                                                  <td className="px-3.5 py-2 font-mono text-gray-600">
                                                    {st.registration_number || '—'}
                                                  </td>
                                                  <td className="px-3.5 py-2 text-gray-500">{st.email}</td>
                                                  <td className="px-3.5 py-2">
                                                    <StatusBadge
                                                      status={st.is_active ? 'active' : 'inactive'}
                                                    />
                                                  </td>
                                                  <td className="px-3.5 py-2 text-right">
                                                    <div className="inline-flex items-center gap-1.5">
                                                      <button
                                                        title="Edit student"
                                                        onClick={() => onEditUser(st)}
                                                        className="rounded p-1 text-gray-400 hover:text-navy hover:bg-navy/10 transition-colors"
                                                      >
                                                        <svg
                                                          className="h-3.5 w-3.5"
                                                          fill="none"
                                                          viewBox="0 0 24 24"
                                                          stroke="currentColor"
                                                          strokeWidth={2}
                                                        >
                                                          <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                                          />
                                                        </svg>
                                                      </button>
                                                      <button
                                                        title="Delete student"
                                                        onClick={() => onDeleteUser(st)}
                                                        className="rounded p-1 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                                                      >
                                                        <svg
                                                          className="h-3.5 w-3.5"
                                                          fill="none"
                                                          viewBox="0 0 24 24"
                                                          stroke="currentColor"
                                                          strokeWidth={2}
                                                        >
                                                          <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v11a2 2 0 002 2h4a2 2 0 002-2V7"
                                                          />
                                                        </svg>
                                                      </button>
                                                    </div>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── TUTOR GROUPED VIEW ────────────────────────────────────────────────────────
function TutorGroupedView({
  tutors,
  students,
  isLoading,
  tutorMappingSummary,
  tutorMappingLoading,
  onAddClass,
  onSwitchClass,
  onRemoveClass,
  onSwitchTutor,
  onEditUser,
  onDeleteUser,
}) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search)

  // Filter tutors
  const filteredTutors = useMemo(() => {
    return (tutors || []).filter((t) => {
      if (!debouncedSearch) return true
      const q = debouncedSearch.toLowerCase()
      const classText = (t.assigned_classes || [])
        .map((c) => `${c.department} ${c.batch} ${c.section}`)
        .join(' ')
      return (
        (t.name || '').toLowerCase().includes(q) ||
        (t.username || '').toLowerCase().includes(q) ||
        (t.email || '').toLowerCase().includes(q) ||
        (t.department || '').toLowerCase().includes(q) ||
        classText.toLowerCase().includes(q)
      )
    })
  }, [tutors, debouncedSearch])

  // Pre-calculate students mapped to each tutor
  const studentsByTutorId = useMemo(() => {
    const map = {}
    ;(tutors || []).forEach((t) => {
      map[t.id] = []
    })

    ;(students || []).forEach((st) => {
      // 1. Direct match by tutor_id or tutor_email
      let matchedTutor = (tutors || []).find(
        (t) =>
          t.id === st.tutor_id ||
          (st.tutor_email && t.email?.toLowerCase() === st.tutor_email.toLowerCase()),
      )

      // 2. If no direct match, check classes assigned to tutors
      if (!matchedTutor && st.department && st.batch && st.section) {
        matchedTutor = (tutors || []).find((t) => {
          const classes = t.assigned_classes || []
          const hasPrimary =
            (t.department || '').toLowerCase() === st.department.toLowerCase() &&
            (t.batch || '').toLowerCase() === st.batch.toLowerCase() &&
            (t.section || '').toLowerCase() === st.section.toLowerCase()
          const hasAssigned = classes.some(
            (c) =>
              (c.department || '').toLowerCase() === st.department.toLowerCase() &&
              (c.batch || '').toLowerCase() === st.batch.toLowerCase() &&
              (c.section || '').toLowerCase() === st.section.toLowerCase(),
          )
          return hasPrimary || hasAssigned
        })
      }

      if (matchedTutor && map[matchedTutor.id]) {
        map[matchedTutor.id].push(st)
      }
    })

    return map
  }, [tutors, students])

  return (
    <div className="space-y-5">
      {/* Top Snapshot Card & Search */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-foreground">Tutor Mapping Snapshot</h2>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-md bg-indigo-50 border border-indigo-100 px-2.5 py-1 font-semibold text-indigo-700">
                Tutors: {tutorMappingLoading ? '...' : (tutorMappingSummary?.total_tutors ?? tutors?.length ?? 0)}
              </span>
              <span className="rounded-md bg-green-50 border border-green-100 px-2.5 py-1 font-semibold text-green-700">
                Mapped Students: {tutorMappingLoading ? '...' : (tutorMappingSummary?.total_mapped_students ?? 0)}
              </span>
            </div>
          </div>
          <input
            type="search"
            placeholder="Search tutor name, Faculty ID, dept…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input w-72 text-xs py-1.5"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="card p-12 text-center">
          <LoadingSpinner size="lg" label="Loading tutors..." />
        </div>
      ) : filteredTutors.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 font-medium">No tutors found matching your search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTutors.map((tutor) => {
            const mappedStudents = studentsByTutorId[tutor.id] || []
            const tutorClasses = tutor.assigned_classes && tutor.assigned_classes.length > 0
              ? tutor.assigned_classes
              : tutor.department && tutor.batch && tutor.section
              ? [{ department: tutor.department, batch: tutor.batch, section: tutor.section }]
              : []

            return (
              <div
                key={tutor.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4 transition-shadow hover:shadow-md"
              >
                {/* Tutor Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-base font-bold text-gray-900">{tutor.name}</h3>
                      <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-mono font-bold text-indigo-700 border border-indigo-200">
                        Faculty ID: {tutor.username}
                      </span>
                      <StatusBadge status={tutor.is_active ? 'active' : 'inactive'} />
                    </div>
                    <p className="text-xs text-gray-500">{tutor.email}</p>

                    {/* Assigned Classes */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-xs font-semibold text-gray-600">Assigned Classes:</span>
                      {tutorClasses.length > 0 ? (
                        tutorClasses.map((c, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200"
                          >
                            <span>{c.department} · Batch {c.batch} · Sec {c.section}</span>
                            {tutorClasses.length > 1 && (
                              <button
                                type="button"
                                title="Remove this class"
                                onClick={() => onRemoveClass(tutor.id, c)}
                                className="text-blue-400 hover:text-blue-900 font-bold ml-0.5 text-[11px]"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs italic text-gray-400">No classes assigned</span>
                      )}
                    </div>
                  </div>

                  {/* Actions near tutor name/id */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onAddClass(tutor)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                      title="Assign an additional class to this tutor"
                    >
                      + Add Class
                    </button>
                    <button
                      type="button"
                      onClick={() => onSwitchClass(tutor)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                      title="Switch tutor's assigned class"
                    >
                      ⇄ Switch Class
                    </button>
                    <button
                      type="button"
                      onClick={() => onSwitchTutor(tutor)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                      title="Switch mapped students to another tutor"
                    >
                      ⇄ Switch Students
                    </button>
                    <button
                      title="Edit tutor"
                      onClick={() => onEditUser(tutor)}
                      className="rounded p-1.5 text-gray-400 hover:text-navy hover:bg-navy/10 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      title="Delete tutor"
                      onClick={() => onDeleteUser(tutor)}
                      className="rounded p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v11a2 2 0 002 2h4a2 2 0 002-2V7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Body: Students List */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">
                      Mapped Students ({mappedStudents.length})
                    </h4>
                  </div>

                  {mappedStudents.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-4 text-center">
                      <p className="text-xs text-gray-500 italic">No students currently mapped to this tutor.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50 text-gray-600 font-medium">
                          <tr>
                            <th className="px-3.5 py-2.5 text-left">Student Name</th>
                            <th className="px-3.5 py-2.5 text-left">Registration No</th>
                            <th className="px-3.5 py-2.5 text-left">Email</th>
                            <th className="px-3.5 py-2.5 text-left">Class</th>
                            <th className="px-3.5 py-2.5 text-left">Status</th>
                            <th className="px-3.5 py-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {mappedStudents.map((st) => (
                            <tr key={st.id} className="hover:bg-gray-50/80 transition-colors">
                              <td className="px-3.5 py-2 font-medium text-gray-900">{st.name}</td>
                              <td className="px-3.5 py-2 font-mono text-gray-600">
                                {st.registration_number || '—'}
                              </td>
                              <td className="px-3.5 py-2 text-gray-500">{st.email}</td>
                              <td className="px-3.5 py-2 text-gray-600">
                                {st.department || '—'} · {st.batch || '—'} · Sec {st.section || '—'}
                              </td>
                              <td className="px-3.5 py-2">
                                <StatusBadge status={st.is_active ? 'active' : 'inactive'} />
                              </td>
                              <td className="px-3.5 py-2 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    title="Edit student"
                                    onClick={() => onEditUser(st)}
                                    className="rounded p-1 text-gray-400 hover:text-navy hover:bg-navy/10 transition-colors"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    title="Delete student"
                                    onClick={() => onDeleteUser(st)}
                                    className="rounded p-1 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v11a2 2 0 002 2h4a2 2 0 002-2V7" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── ROLE USERS VIEW (for Faculty, HOD, Coordinators, etc.) ───────────────────
function RoleUsersView({
  role,
  users,
  isLoading,
  clubs,
  onEditUser,
  onDeleteUser,
  onBulkDelete,
  bulkDeleting,
  onMakeTutor,
}) {
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const debouncedSearch = useDebounce(search)

  const clubMap = useMemo(() => {
    const m = {}
    ;(clubs || []).forEach((c) => { m[c.id] = c.name })
    return m
  }, [clubs])

  const getScope = (u) => {
    if (u.role === 'principal') return 'College'
    if (u.role === 'hod') {
      if (Array.isArray(u.departments) && u.departments.length > 0) return u.departments.join(', ')
      return u.department || '—'
    }
    if (u.role === 'club_coordinator') return clubMap[u.club_id] || u.club_id || '—'
    if (u.role === 'dept_coordinator') return u.department || '—'
    if (u.role === 'guest') return clubMap[u.club_id] || '—'
    return u.department || '—'
  }

  const filteredUsers = useMemo(() => {
    return (users || []).filter((u) => {
      if (!debouncedSearch) return true
      const q = debouncedSearch.toLowerCase()
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.username || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        getScope(u).toLowerCase().includes(q)
      )
    })
  }, [users, debouncedSearch, clubMap])

  useEffect(() => {
    const validIds = new Set((filteredUsers || []).map((u) => u.id))
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)))
  }, [filteredUsers])

  const selectableIds = useMemo(
    () => (filteredUsers || []).filter((u) => u.role !== 'super_admin').map((u) => u.id),
    [filteredUsers],
  )
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id))

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds([])
    else setSelectedIds(selectableIds)
  }

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const columns = [
    {
      key: '_select',
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleSelectAll}
          onClick={(e) => e.stopPropagation()}
          aria-label="Select all"
        />
      ),
      searchKey: false,
      align: 'center',
      width: '48px',
      render: (_, row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          disabled={row.role === 'super_admin'}
          onChange={() => toggleSelectOne(row.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${row.username}`}
        />
      ),
    },
    { key: 'name', header: 'Name', sortable: true, searchKey: true },
    {
      key: 'email',
      header: 'Registered Email',
      sortable: true,
      searchKey: true,
      render: (v) => <span className="text-xs text-gray-600">{v || '—'}</span>,
    },
    {
      key: 'username',
      header: role === 'faculty' ? 'Faculty ID' : 'Username',
      render: (v) => <span className="font-mono text-xs font-semibold">{v}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      render: (v) => (
        <span
          className={`inline-flex items-center rounded-full ring-1 ring-inset px-2.5 py-0.5 text-xs font-medium ${
            roleBadge[v] || 'bg-gray-100 text-gray-600 ring-gray-200'
          }`}
        >
          {roleLabel[v] || v}
        </span>
      ),
    },
    {
      key: '_scope',
      header: 'Scope',
      searchKey: false,
      render: (_, row) => <span className="text-xs text-gray-500">{getScope(row)}</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      searchKey: false,
      render: (v) => <StatusBadge status={v ? 'active' : 'inactive'} />,
    },
    {
      key: '_actions',
      header: 'Actions',
      searchKey: false,
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {role === 'faculty' && (
            <button
              type="button"
              onClick={() => onMakeTutor && onMakeTutor(row)}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 transition-colors border border-indigo-200"
              title="Assign this faculty as a class tutor"
            >
              <span>👨‍🏫</span> Make as Tutor
            </button>
          )}
          <button
            title="Edit"
            onClick={() => onEditUser(row)}
            className="rounded p-1 text-gray-400 hover:text-navy hover:bg-navy/10 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          {row.role !== 'super_admin' && (
            <button
              title="Delete user"
              onClick={() => onDeleteUser(row)}
              className="rounded p-1 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v11a2 2 0 002 2h4a2 2 0 002-2V7" />
              </svg>
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          placeholder={`Search ${roleLabel[role] || role}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input w-72 text-xs py-1.5"
        />

        {selectedIds.length > 0 && (
          <button
            className="btn-danger text-xs py-1.5"
            onClick={() => onBulkDelete(selectedIds, () => setSelectedIds([]))}
            disabled={bulkDeleting}
          >
            {bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filteredUsers || []}
        isLoading={isLoading}
        emptyMessage={`No ${roleLabel[role] || role} users found.`}
      />
    </div>
  )
}

// ── ROLE TABS CONFIGURATION ───────────────────────────────────────────────────
const USER_ROLE_TABS = [
  { key: 'student', label: 'Students' },
  { key: 'faculty', label: 'Faculty' },
  { key: 'tutor', label: 'Tutors' },
  { key: 'hod', label: 'HODs' },
  { key: 'dept_coordinator', label: 'Dept Coordinators' },
  { key: 'club_coordinator', label: 'Club Coordinators' },
  { key: 'student_affairs', label: 'Student Affairs' },
  { key: 'principal', label: 'Principals' },
  { key: 'guest', label: 'Guests' },
  { key: 'super_admin', label: 'Super Admins' },
]

// ── USERS TAB ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [activeRoleTab, setActiveRoleTab] = useState('student')

  // Queries
  const { data: roleUsers, isLoading: roleUsersLoading } = useUsers({ role: activeRoleTab })
  const { data: tutors } = useUsers({ role: 'tutor' })
  const { data: students } = useUsers({ role: 'student' })
  const { data: clubs } = useClubs()
  const { data: departments } = useDepartments()
  const { data: tutorMappingSummary, isLoading: tutorMappingLoading } = useTutorMappingSummary()

  // Mutations
  const deleteUser = useDeleteUser()
  const bulkDeleteUsers = useBulkDeleteUsers()
  const removeTutorClassMutation = useRemoveTutorClass()

  // Modals state
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [showTutorBulkImport, setShowTutorBulkImport] = useState(false)
  const [showFacultyBulkImport, setShowFacultyBulkImport] = useState(false)
  const [showMakeFacultyTutor, setShowMakeFacultyTutor] = useState(false)
  const [selectedFacultyForTutor, setSelectedFacultyForTutor] = useState(null)
  const [showTutorSwitch, setShowTutorSwitch] = useState(false)
  const [showTutorClassSwitch, setShowTutorClassSwitch] = useState(false)
  const [showAddTutorClass, setShowAddTutorClass] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [selectedTutorForSwitch, setSelectedTutorForSwitch] = useState(null)
  const [selectedClassForSwitch, setSelectedClassForSwitch] = useState(null)
  const [selectedTutorForClass, setSelectedTutorForClass] = useState(null)

  const handleDeleteUser = async (user) => {
    if (!user?.id) return
    if (user.role === 'super_admin') return

    const confirmed = window.confirm(`Delete user "${user.name}" (${user.username})?`)
    if (!confirmed) return

    await deleteUser.mutateAsync(user.id)
  }

  const handleBulkDelete = async (ids, onClear) => {
    if (!ids || ids.length === 0) return
    const confirmed = window.confirm(`Delete ${ids.length} selected user(s)?`)
    if (!confirmed) return

    await bulkDeleteUsers.mutateAsync(ids)
    if (onClear) onClear()
  }

  const handleRemoveTutorClass = (tutorId, c) => {
    const confirmed = window.confirm(
      `Remove class ${c.department} - Batch ${c.batch} - Section ${c.section} from this tutor?`,
    )
    if (!confirmed) return
    removeTutorClassMutation.mutate({
      tutorId,
      department: c.department,
      batch: c.batch,
      section: c.section,
    })
  }

  return (
    <div className="space-y-5">
      {/* Top Header & Global Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage and organize platform accounts by user role</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeRoleTab === 'student' && (
            <button
              className="btn-secondary text-xs"
              onClick={() => setShowBulkImport(true)}
            >
              ↑ Import Students
            </button>
          )}
          {activeRoleTab === 'tutor' && (
            <button
              className="btn-secondary text-xs"
              onClick={() => setShowTutorBulkImport(true)}
            >
              ↑ Import Tutors
            </button>
          )}
          {activeRoleTab === 'faculty' && (
            <button
              className="btn-secondary text-xs"
              onClick={() => setShowFacultyBulkImport(true)}
            >
              ↑ Import Faculty
            </button>
          )}
          {(activeRoleTab === 'student' || activeRoleTab === 'tutor') && (
            <button
              className="btn-secondary text-xs"
              onClick={() => {
                setSelectedTutorForSwitch(null)
                setSelectedClassForSwitch(null)
                setShowTutorSwitch(true)
              }}
            >
              ⇄ Switch Tutor Mapping
            </button>
          )}
          <button className="btn-primary text-xs" onClick={() => setShowNew(true)}>
            + New User
          </button>
        </div>
      </div>

      {/* Role Navigation Tabs on Top */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-2 overflow-x-auto pb-px" aria-label="User Roles Tabs">
          {USER_ROLE_TABS.map((tab) => {
            const isActive = activeRoleTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveRoleTab(tab.key)}
                className={`group inline-flex items-center whitespace-nowrap border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'border-navy text-navy font-bold'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Active Tab Content */}
      {activeRoleTab === 'student' ? (
        <StudentGroupedView
          students={roleUsers || []}
          isLoading={roleUsersLoading}
          tutors={tutors || []}
          departments={departments || []}
          onSwitchTutor={(tutor, classContext) => {
            setSelectedTutorForSwitch(tutor)
            setSelectedClassForSwitch(classContext || null)
            setShowTutorSwitch(true)
          }}
          onEditUser={(u) => setEditUser(u)}
          onDeleteUser={handleDeleteUser}
        />
      ) : activeRoleTab === 'tutor' ? (
        <TutorGroupedView
          tutors={roleUsers || []}
          students={students || []}
          isLoading={roleUsersLoading}
          tutorMappingSummary={tutorMappingSummary}
          tutorMappingLoading={tutorMappingLoading}
          onAddClass={(tutor) => {
            setSelectedTutorForClass(tutor)
            setShowAddTutorClass(true)
          }}
          onSwitchClass={(tutor) => {
            setSelectedTutorForClass(tutor)
            setShowTutorClassSwitch(true)
          }}
          onRemoveClass={handleRemoveTutorClass}
          onSwitchTutor={(tutor) => {
            setSelectedTutorForSwitch(tutor)
            setSelectedClassForSwitch(null)
            setShowTutorSwitch(true)
          }}
          onEditUser={(u) => setEditUser(u)}
          onDeleteUser={handleDeleteUser}
        />
      ) : (
        <RoleUsersView
          role={activeRoleTab}
          users={roleUsers || []}
          isLoading={roleUsersLoading}
          clubs={clubs || []}
          onEditUser={(u) => setEditUser(u)}
          onDeleteUser={handleDeleteUser}
          onBulkDelete={handleBulkDelete}
          bulkDeleting={bulkDeleteUsers.isPending}
          onMakeTutor={(f) => {
            setSelectedFacultyForTutor(f)
            setShowMakeFacultyTutor(true)
          }}
        />
      )}

      {/* Modals */}
      <BulkImportModal isOpen={showBulkImport} onClose={() => setShowBulkImport(false)} />
      <TutorBulkImportModal isOpen={showTutorBulkImport} onClose={() => setShowTutorBulkImport(false)} />
      <FacultyBulkImportModal isOpen={showFacultyBulkImport} onClose={() => setShowFacultyBulkImport(false)} />
      <MakeFacultyTutorModal
        isOpen={showMakeFacultyTutor}
        onClose={() => {
          setShowMakeFacultyTutor(false)
          setSelectedFacultyForTutor(null)
        }}
        faculty={selectedFacultyForTutor}
        departments={departments || []}
      />
      <TutorSwitchModal
        isOpen={showTutorSwitch}
        onClose={() => {
          setShowTutorSwitch(false)
          setSelectedTutorForSwitch(null)
          setSelectedClassForSwitch(null)
        }}
        tutors={tutors || []}
        initialTutor={selectedTutorForSwitch}
        initialClass={selectedClassForSwitch}
        students={students || []}
      />
      <SwitchTutorClassModal
        isOpen={showTutorClassSwitch}
        onClose={() => {
          setShowTutorClassSwitch(false)
          setSelectedTutorForClass(null)
        }}
        tutor={selectedTutorForClass}
        departments={departments || []}
      />
      <AddTutorClassModal
        isOpen={showAddTutorClass}
        onClose={() => {
          setShowAddTutorClass(false)
          setSelectedTutorForClass(null)
        }}
        tutor={selectedTutorForClass}
        departments={departments || []}
      />
      <NewUserModal isOpen={showNew} onClose={() => setShowNew(false)} />
      <EditUserModal isOpen={!!editUser} onClose={() => setEditUser(null)} user={editUser} />
    </div>
  )
}
