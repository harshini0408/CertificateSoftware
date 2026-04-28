import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import StatCard from '../../components/StatCard'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import ConfirmModal from '../../components/ConfirmModal'
import FileUpload from '../../components/FileUpload'
import { useClubDashboard, useClubAssets, useUpdateClubAssets } from './api'
import { useCreateEvent, useDeleteEvent, useEvents } from './eventsApi'
import { useAuthStore } from '../../store/authStore'
import { useChangePassword } from '../auth/api'
import axiosInstance from '../../utils/axiosInstance'
import { BACKEND_URL } from '../../utils/axiosInstance'

// ── Tab ids ───────────────────────────────────────────────────────────────────
const TABS = ['events', 'settings']

const TAB_LABELS = {
  events: 'Club Dashboard',
  settings: 'Settings',
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Icon helpers ──────────────────────────────────────────────────────────────
const Icon = {
  events: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  certs: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard tab
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardTab({ clubId, dashboard, isLoading }) {
  const { data: events, isLoading: eventsLoading } = useEvents(clubId)
  if (isLoading || eventsLoading) return <LoadingSpinner fullPage label="Loading dashboard…" />

  const club = dashboard?.club || {}
  const eventRows = Array.isArray(events) ? events : []
  const totalEvents = eventRows.length
  const totalCertificatesIssued = eventRows.reduce((sum, event) => sum + Number(event?.cert_count ?? 0), 0)
  const recentEvents = [...eventRows].sort((a, b) => {
    const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0
    return bTime - aTime
  })

  const eventColumns = [
    { key: 'name', header: 'Event', sortable: true },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'participant_count', header: 'Participants', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
    { key: 'cert_count', header: 'Certs Issued', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">{club.name || 'Club Dashboard'}</h1>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono font-bold text-navy">{club.slug}</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        <StatCard label="Total Events" value={totalEvents} icon={Icon.events} accent="navy" />
        <StatCard label="Certificates Issued" value={totalCertificatesIssued} icon={Icon.certs} accent="green" />
      </div>

      {/* Recent events */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Recent Events</h2>
        </div>
        <DataTable
          columns={eventColumns}
          data={recentEvents}
          isLoading={false}
          emptyMessage="No events yet. Create your first event."
          rowKey="id"
        />
      </div>

    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Events tab
// ═══════════════════════════════════════════════════════════════════════════════
function EventsTab({ clubId }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const createEvent = useCreateEvent(clubId)
  const deleteEvent = useDeleteEvent(clubId)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    if (!isModalOpen) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [isModalOpen])

  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm()

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', clubId, 'list'],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/clubs/${clubId}/events`)
      return data
    },
    enabled: !!clubId,
  })

  const onSubmit = (data) => {
    createEvent.mutate(data, {
      onSuccess: (res) => {
        setIsModalOpen(false)
        reset()
        const event = res?.data ?? res
        navigate(`/club/${clubId}/events/${event.id ?? event._id}`)
      }
    })
  }

  const handleDelete = () => {
    deleteEvent.mutate(deleteTarget.id ?? deleteTarget._id, {
      onSuccess: () => setDeleteTarget(null)
    })
  }

  const eventColumns = [
    { key: 'name', header: 'Event Name', sortable: true, searchKey: true,
      render: (v, row) => (
        <button
          className="text-sm font-semibold text-navy hover:underline text-left"
          onClick={() => navigate(`/club/${clubId}/events/${row.id ?? row._id}`)}
        >
          {v}
        </button>
      ) },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'participant_count', header: 'Participants', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
    { key: '_actions', header: 'Actions', align: 'center', searchKey: false, render: (_, row) => (
        <div className="flex justify-center gap-2">
          <button onClick={() => navigate(`/club/${clubId}/events/${row.id ?? row._id}`)} className="text-navy hover:bg-gray-100 p-1.5 rounded" title="Edit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button onClick={() => setDeleteTarget(row)} className="text-red-500 hover:bg-red-50 p-1.5 rounded" title="Delete">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      ) }
  ]

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Events</h1>
        <button
          className="btn-primary"
          onClick={() => setIsModalOpen(true)}
        >
          + New Event
        </button>
      </div>
      <DataTable
        columns={eventColumns}
        data={events ?? []}
        isLoading={isLoading}
        emptyMessage="No events yet. Click '+ New Event' to create one."
        searchable
        searchPlaceholder="Search events…"
      />

      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy">Create New Event</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close modal">x</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="form-label" htmlFor="title">Event Name *</label>
                <input id="title" type="text" className={`form-input ${errors.name ? 'form-input-error' : ''}`} placeholder="e.g. Hackathon 2024" {...register('name', { required: 'Event name is required' })} />
                {errors.name && <p className="form-error">{errors.name.message}</p>}
              </div>
              <div>
                <label className="form-label" htmlFor="date">Event Date</label>
                <input id="date" type="date" className="form-input" {...register('event_date')} />
              </div>
              <div>
                <label className="form-label" htmlFor="academic_year">Academic Year *</label>
                <select
                  id="academic_year"
                  className={`form-input ${errors.academic_year ? 'form-input-error' : ''}`}
                  {...register('academic_year', { required: 'Academic year is required' })}
                  defaultValue=""
                >
                  <option value="" disabled>Select academic year</option>
                  <option value="2025-2026(EVEN)">2025-2026(EVEN)</option>
                  <option value="2026-2027(ODD)">2026-2027(ODD)</option>
                  <option value="2026-27 ODD">2026-27 ODD</option>
                  <option value="2026-27 EVEN">2026-27 EVEN</option>
                </select>
                {errors.academic_year && <p className="form-error">{errors.academic_year.message}</p>}
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">{isSubmitting ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Event"
        message={`Are you sure you want to delete '${deleteTarget?.name}'? This will remove all associated certificates and history.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isLoading={deleteEvent.isPending}
      />
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// Templates tab  —  shows the PNG image template gallery (read-only)
// ═══════════════════════════════════════════════════════════════════════════════
function TemplatesTab() {
  const { data: templates, isLoading, error, refetch } = useImageTemplates()

  if (isLoading) return <LoadingSpinner fullPage label="Loading templates…" />

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-red-500">Failed to load templates.</p>
        <button className="btn-secondary text-xs" onClick={() => refetch()}>Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Certificate Templates</h1>
        <p className="text-sm text-gray-500 mt-1">
          These are the pre-built templates available for your events.
        </p>
      </div>

      {(!templates || templates.length === 0) ? (
        <div className="card p-12 text-center text-gray-400">
          <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-lg font-semibold">No templates found</p>
          <p className="text-sm mt-2 max-w-sm mx-auto text-gray-400">
            Add PNG files to{' '}
            <code className="bg-gray-100 px-1 rounded text-xs">
              backend/app/static/certificate_templates/
            </code>{' '}
            and restart the backend server.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {templates.map((t) => (
            <div
              key={t.id}
              className="group flex flex-col rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white hover:shadow-md hover:border-indigo-300 transition-all duration-200"
            >
              {/* Preview */}
              <div className="w-full bg-gray-50 overflow-hidden" style={{ aspectRatio: '210/297' }}>
                {t.preview_url ? (
                  <img
                    src={BACKEND_URL + t.preview_url}
                    alt={t.display_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                  />
                ) : null}
                <div
                  className="w-full h-full items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50"
                  style={{ display: t.preview_url ? 'none' : 'flex' }}
                >
                  <svg className="h-10 w-10 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              {/* Info */}
              <div className="px-3 py-2.5 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-800 truncate">{t.display_name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{t.filename}</p>
                <span className="inline-flex mt-1.5 items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                  Read-only
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Settings tab
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsTab({ club, clubId, clubLoading, dashboardError, missingClubAssignment }) {
  const changePassword = useChangePassword()
  const { data: assetState, isLoading: assetsLoading } = useClubAssets(clubId)
  const updateAssets = useUpdateClubAssets(clubId)

  const [logoFile, setLogoFile] = useState(null)
  const [signatureFile, setSignatureFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [sigPreview, setSigPreview] = useState(null)

  const toAssetSrc = (url, hash) => {
    if (!url) return null
    const withVersion = hash ? `${url}${url.includes('?') ? '&' : '?'}v=${hash}` : url
    if (withVersion.startsWith('blob:') || withVersion.startsWith('http')) return withVersion
    return `${BACKEND_URL}${withVersion}`
  }

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(toAssetSrc(assetState?.logo_url, assetState?.logo_hash))
      return undefined
    }
    const objectUrl = URL.createObjectURL(logoFile)
    setLogoPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [logoFile, assetState?.logo_url, assetState?.logo_hash])

  useEffect(() => {
    if (!signatureFile) {
      setSigPreview(toAssetSrc(assetState?.signature_url, assetState?.signature_hash))
      return undefined
    }
    const objectUrl = URL.createObjectURL(signatureFile)
    setSigPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [signatureFile, assetState?.signature_url, assetState?.signature_hash])

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({ defaultValues: { current_password: '', new_password: '', confirm_password: '' } })

  const onSubmit = (values) => {
    changePassword.mutate(
      { current_password: values.current_password, new_password: values.new_password },
      { onSuccess: () => reset() },
    )
  }

  const onAssetSubmit = async () => {
    if (!logoFile && !signatureFile) return
    await updateAssets.mutateAsync({ logoFile, signatureFile })
    setLogoFile(null)
    setSignatureFile(null)
  }

  if (clubLoading) return <LoadingSpinner fullPage label="Loading club info…" />

  return (
    <div className="space-y-8">
      {(missingClubAssignment || dashboardError) && (
        <div className="max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {missingClubAssignment
            ? 'Your account is not linked to a club yet. Ask Super Admin to assign a club to this coordinator account.'
            : (dashboardError?.response?.data?.detail || 'Unable to load club information. Check your club access and URL.')} 
        </div>
      )}

      {/* Club info (read-only) */}
      <div className="max-w-2xl">
        <h2 className="section-title mb-3">Club Information</h2>
        <div className="card divide-y divide-gray-100 overflow-hidden">
          {[
            ['Club Name', club?.name],
            ['Slug', club?.slug],
            ['Contact Email', club?.contact_email],
            ['Created', fmtDate(club?.created_at)],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-5 py-4">
              <span className="text-sm font-medium text-gray-500">{label}</span>
              <span className="text-sm text-foreground font-semibold">{value ?? '—'}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">Contact admin to make changes.</p>
      </div>

      {/* Logo + signature */}
      <div className="max-w-3xl">
        <h2 className="section-title mb-3">Logo and Signature</h2>
        {assetsLoading ? (
          <LoadingSpinner label="Loading current assets…" />
        ) : (
          <div className="card p-5 space-y-5">
            <p className="text-sm text-gray-500">
              Upload your club logo and faculty coordinator signature. These assets are reused in certificates.
            </p>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Club Logo</p>
                {logoPreview && (
                  <img
                    src={logoPreview}
                    alt="Club logo preview"
                    className="h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50 p-2"
                  />
                )}
                <FileUpload
                  id="club-logo-upload"
                  accept="image/*"
                  label="Drop logo here"
                  hint="PNG / JPG / SVG, max 5 MB"
                  maxSizeMB={5}
                  onFile={setLogoFile}
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Faculty Signature</p>
                {sigPreview && (
                  <img
                    src={sigPreview}
                    alt="Signature preview"
                    className="h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50 p-2"
                  />
                )}
                <FileUpload
                  id="club-signature-upload"
                  accept="image/*"
                  label="Drop signature here"
                  hint="PNG / JPG, max 5 MB"
                  maxSizeMB={5}
                  onFile={setSignatureFile}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={onAssetSubmit}
              disabled={updateAssets.isPending || (!logoFile && !signatureFile)}
            >
              {updateAssets.isPending ? <LoadingSpinner size="sm" label="" /> : 'Update Logo/Signature'}
            </button>
          </div>
        )}
      </div>

      {/* Change password */}
      <div className="max-w-lg">
        <h2 className="section-title mb-3">Change Password</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="card p-5 space-y-4">
          <div>
            <label className="form-label">Current Password *</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                className={`form-input pr-14 ${errors.current_password ? 'form-input-error' : ''}`}
                {...register('current_password', { required: 'Required' })}
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                {showCurrent ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.current_password && <p className="form-error">{errors.current_password.message}</p>}
          </div>
          <div>
            <label className="form-label">New Password *</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                className={`form-input pr-14 ${errors.new_password ? 'form-input-error' : ''}`}
                {...register('new_password', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })}
              />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                {showNew ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.new_password && <p className="form-error">{errors.new_password.message}</p>}
          </div>
          <div>
            <label className="form-label">Confirm New Password *</label>
            <input
              type="password"
              className={`form-input ${errors.confirm_password ? 'form-input-error' : ''}`}
              {...register('confirm_password', {
                required: 'Required',
                validate: (v) => v === watch('new_password') || 'Passwords do not match',
              })}
            />
            {errors.confirm_password && <p className="form-error">{errors.confirm_password.message}</p>}
          </div>
          <button type="submit" className="btn-primary" disabled={changePassword.isPending}>
            {changePassword.isPending ? <LoadingSpinner size="sm" label="" /> : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ClubDashboard (main export)
// ═══════════════════════════════════════════════════════════════════════════════
export default function ClubDashboard() {
  const navigate = useNavigate()
  const { club_id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const requiresProfileSetup = useAuthStore((s) => s.requires_profile_setup)
  const role = useAuthStore((s) => s.role)
  const authClubId = useAuthStore((s) => s.club_id)
  const setAuth = useAuthStore((s) => s.setAuth)

  const normalizedRole = String(role || '').trim().toLowerCase().replace(/\s+/g, '_')
  const isClubCoordinator = normalizedRole === 'club_coordinator'

  const effectiveClubId = isClubCoordinator && authClubId ? authClubId : club_id

  const activeTab = TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'events'

  const setTab = (tab) =>
    setSearchParams({ tab }, { replace: true })

  const { data: dashboard, isLoading: dashLoading, error: dashboardError } = useClubDashboard(effectiveClubId)
  const club = dashboard?.club || null
  const missingClubAssignment = isClubCoordinator && !effectiveClubId

  useEffect(() => {
    if (isClubCoordinator && authClubId && club_id && authClubId !== club_id) {
      navigate(`/club/${authClubId}`, { replace: true })
    }
  }, [isClubCoordinator, authClubId, club_id, navigate])

  useEffect(() => {
    // Refresh persisted auth snapshot so dashboard uses the latest club assignment.
    if (!isClubCoordinator) return
    let cancelled = false

    ;(async () => {
      try {
        const { data } = await axiosInstance.get('/auth/me')
        if (!cancelled && data?.role) {
          setAuth(data)
        }
      } catch {
        // ProtectedRoute will handle auth failures.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isClubCoordinator, setAuth])

  useEffect(() => {
    if (requiresProfileSetup && activeTab !== 'settings') {
      setSearchParams({ tab: 'settings' }, { replace: true })
    }
  }, [requiresProfileSetup, activeTab, setSearchParams])

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container">
            {/* Club identity header */}
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-foreground">
                {club?.name || 'Club Dashboard'}
              </h1>
              {club?.slug && (
                <p className="mt-1 text-sm text-gray-500">{club.slug}</p>
              )}
            </div>

            {/* Tab bar */}
            <div className="mb-6 flex gap-1 border-b border-gray-200">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  id={`club-tab-${tab}`}
                  onClick={() => setTab(tab)}
                  className={`
                    relative px-4 py-2.5 text-sm font-medium capitalize transition-colors
                    ${activeTab === tab
                      ? 'text-navy after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-navy after:rounded-t-full'
                      : 'text-gray-500 hover:text-navy'
                    }
                  `}
                >
                  {TAB_LABELS[tab] || tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {requiresProfileSetup && (
              <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                First login setup pending. Please upload club logo and faculty signature in Settings.
              </div>
            )}

            {missingClubAssignment && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                No club is assigned to this coordinator account. Contact Super Admin to assign a club.
              </div>
            )}

            {activeTab === 'events' && <EventsTab clubId={effectiveClubId} />}
            {activeTab === 'settings' && (
              <SettingsTab
                club={club}
                clubId={effectiveClubId}
                clubLoading={dashLoading}
                dashboardError={dashboardError}
                missingClubAssignment={missingClubAssignment}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
