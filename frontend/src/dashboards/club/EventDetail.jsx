import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import StatusBadge from '../../components/StatusBadge'
import FileUpload from '../../components/FileUpload'
import LoadingSpinner from '../../components/LoadingSpinner'
import DataTable from '../../components/DataTable'
import GuestWizard from '../../components/GuestWizard'
import { useEvent, eventKeys } from './eventsApi'
import { useToastStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'

import CertificateIssue from './CertificateIssue'
import { BACKEND_URL } from '../../utils/axiosInstance'

// ─── Tab ids ──────────────────────────────────────────────────────────────────
const TABS = ['overview', 'participants', 'certificates']

const CERT_TYPES = [
  'participant',
  'coordinator',
  'winner_1st',
  'winner_2nd',
  'winner_3rd',
  'mentor',
  'judge',
  'volunteer',
]

const IST_TIMEZONE = 'Asia/Kolkata'
const HAS_TZ_RE = /(Z|[+\-]\d{2}:\d{2})$/i

function parseApiDateTime(value) {
  if (!value) return null
  const raw = String(value)
  const parsed = new Date(HAS_TZ_RE.test(raw) ? raw : `${raw}Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDateTime(value) {
  const dt = parseApiDateTime(value)
  if (!dt) return '—'
  return dt.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: IST_TIMEZONE,
  })
}

function formatDateOnly(value) {
  if (!value) return '—'
  const raw = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }
  const dt = parseApiDateTime(raw)
  if (!dt) return '—'
  return dt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: IST_TIMEZONE,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ event, clubId, eventId, onNextStep }) {
  const logoPreview = event?.assets?.logo_url ?? null
  const sigPreview = event?.assets?.signature_url ?? null

  const toAssetSrc = (url, hash) => {
    if (!url) return null
    const withVersion = hash ? `${url}${url.includes('?') ? '&' : '?'}v=${hash}` : url
    if (withVersion.startsWith('blob:') || withVersion.startsWith('http')) return withVersion
    return `${BACKEND_URL}${withVersion}`
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* ── Event details card ─────────────────────────────────────────── */}
      <section className="card p-6">
        <h2 className="section-title mb-4">Event Details</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            ['Name',        event?.name],
            ['Date',        event?.event_date
                              ? formatDateOnly(event.event_date)
                              : '—'],
            ['Academic Year', event?.academic_year || '—'],
            ['Status',      <StatusBadge key="s" status={event?.status ?? 'draft'} />],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {label}
              </dt>
              <dd className="text-sm text-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Assets section ─────────────────────────────────────────────── */}
      <section className="card p-6">
        <h2 className="section-title mb-1">Assets</h2>
        <p className="mb-5 text-sm text-gray-500">
          The following club-level assets are used for this event.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Logo */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Club Logo</p>
            {logoPreview && (
              <img
                src={toAssetSrc(logoPreview, event?.assets?.logo_hash)}
                alt="Logo preview"
                className="h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50 p-2"
              />
            )}
          </div>

          {/* Signature */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Organiser Signature</p>
            {sigPreview && (
              <img
                src={toAssetSrc(sigPreview, event?.assets?.signature_hash)}
                alt="Signature preview"
                className="h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50 p-2"
              />
            )}
          </div>
        </div>
        <p className="mt-5 text-xs text-gray-500">
          If you want to change these assets, change it in Settings.
        </p>
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel Upload Sub-tab
// ─────────────────────────────────────────────────────────────────────────────
function ExcelUploadTab({ clubId, eventId }) {
  const addToast = useToastStore((s) => s.addToast)
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      const a = document.createElement('a')
      a.href = `${BACKEND_URL}/clubs/${clubId}/events/${eventId}/excel-template`
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.download = ''
      a.click()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to download template.'
      addToast({ type: 'error', message: msg })
    } finally {
      setDownloading(false)
    }
  }

  const uploadExcel = async () => {
    if (!file) {
      addToast({ type: 'warning', message: 'Please select an Excel file first.' })
      return
    }
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/participants/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      setResult(data)
      addToast({
        type: 'success',
        message: `${data.created ?? 0} participant(s) imported successfully.`,
      })
      if ((data.created ?? 0) > 0) {
        addToast({ type: 'info', message: 'Participants imported. Proceed to Certificates.' })
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Upload failed.'
      addToast({ type: 'error', message: msg })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      {/* Step 1 — download template */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-sm font-bold text-navy">
            1
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Download the Excel template
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Fill in the downloaded file with participant data and re-upload below.
            </p>
            <button
              id="download-excel-template"
              className="btn-secondary mt-3 text-sm"
              onClick={downloadTemplate}
              disabled={downloading}
            >
              {downloading ? (
                <><LoadingSpinner size="sm" label="" /> Downloading…</>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Template
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Step 2 — upload filled file */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-sm font-bold text-navy">
            2
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">Upload filled file</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Accepts .xlsx or .xls files up to 10 MB.
              </p>
            </div>
            <FileUpload
              id="participant-excel-upload"
              accept=".xlsx,.xls"
              label="Drop Excel file here"
              hint=".xlsx or .xls · max 10 MB"
              maxSizeMB={10}
              onFile={setFile}
            />
            <div className="flex justify-end">
              <button
                id="upload-excel-btn"
                className="btn-primary"
                onClick={uploadExcel}
                disabled={uploading || !file}
              >
                {uploading ? (
                  <><LoadingSpinner size="sm" label="" /> Uploading…</>
                ) : (
                  'Upload & Import'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Result panel */}
      {result && (
        <div className={`card p-5 border-l-4 ${
          (result.errors?.length ?? 0) > 0 ? 'border-amber-400' : 'border-green-500'
        }`}>
          <p className="text-sm font-semibold text-foreground mb-2">Upload Result</p>
          <p className="text-sm text-gray-600">
            ✅ <strong>{result.created ?? 0}</strong> participant(s) imported
            {(result.skipped ?? 0) > 0 && (
              <span> · ⚠️ <strong>{result.skipped}</strong> skipped (duplicate)</span>
            )}
          </p>
          {result.errors?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">
                Rows with errors ({result.errors.length}):
              </p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                    Row {e.row ?? i + 2}: {e.message ?? e}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(result.created ?? 0) > 0 && null}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual Entry Sub-tab
// ─────────────────────────────────────────────────────────────────────────────
function ManualEntryTab({ clubId, eventId, event }) {
  const addToast = useToastStore((s) => s.addToast)
  const qc = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      email: '',
      registration_number: '',
      cert_type: 'participant',
    },
  })

  const onSubmit = async (values) => {
    try {
      await axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/participants`,
        {
          name: values.name,
          email: values.email,
          registration_number: values.registration_number,
          cert_type: values.cert_type,
          fields: {
            Name: values.name,
            Email: values.email,
            'Registration Number': values.registration_number,
          },
        },
      )
      qc.invalidateQueries({ queryKey: ['participants', clubId, eventId] })
      addToast({ type: 'success', message: 'Participant added.' })
      reset()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to add participant.'
      addToast({ type: 'error', message: msg })
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-4">
        {/* Name */}
        <div>
          <label className="form-label" htmlFor="manual-name">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id="manual-name"
            type="text"
            className={`form-input ${errors.name ? 'form-input-error' : ''}`}
            placeholder="John Doe"
            {...register('name', { required: 'Name is required.' })}
          />
          {errors.name && <p className="form-error">{errors.name.message}</p>}
        </div>

        {/* Registration Number */}
        <div>
          <label className="form-label" htmlFor="manual-regno">
            Registration Number <span className="text-red-500">*</span>
          </label>
          <input
            id="manual-regno"
            type="text"
            className={`form-input ${errors.registration_number ? 'form-input-error' : ''}`}
            placeholder="21CS001"
            {...register('registration_number', { required: 'Registration number is required.' })}
          />
          {errors.registration_number && (
            <p className="form-error">{errors.registration_number.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="form-label" htmlFor="manual-email">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="manual-email"
            type="email"
            className={`form-input ${errors.email ? 'form-input-error' : ''}`}
            placeholder="participant@example.com"
            {...register('email', {
              required: 'Email is required.',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email.' },
            })}
          />
          {errors.email && <p className="form-error">{errors.email.message}</p>}
        </div>

        {/* Role / Cert Type */}
        <div>
          <label className="form-label" htmlFor="manual-cert-type">
            Role (Certificate Type)
          </label>
          <select
            id="manual-cert-type"
            className="form-input"
            {...register('cert_type')}
          >
            {CERT_TYPES.map((ct) => (
              <option key={ct} value={ct}>
                {ct.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">This determines which certificate template is used.</p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding…' : 'Add Participant'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Participants Tab (with 2 sub-tabs)
// ─────────────────────────────────────────────────────────────────────────────
const PARTICIPANT_SUBTABS = [
  { id: 'excel',  label: 'Excel Upload' },
  { id: 'manual', label: 'Manual Entry' },
]

function ParticipantsTab({ clubId, eventId, event }) {
  const [subTab, setSubTab] = useState('excel')

  return (
    <div className="space-y-6">
      {/* Sub-tab bar */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {PARTICIPANT_SUBTABS.map((st) => (
          <button
            key={st.id}
            id={`participants-subtab-${st.id}`}
            onClick={() => setSubTab(st.id)}
            className={`
              rounded-md px-4 py-1.5 text-sm font-medium transition-colors
              ${subTab === st.id
                ? 'bg-white text-navy shadow-sm'
                : 'text-gray-500 hover:text-navy'
              }
            `}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === 'excel' && (
        <ExcelUploadTab
          clubId={clubId}
          eventId={eventId}
        />
      )}
      {subTab === 'manual' && (
        <ManualEntryTab
          clubId={clubId}
          eventId={eventId}
          event={event}
        />
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// EventDetail (main export)
// ─────────────────────────────────────────────────────────────────────────────
export default function EventDetail() {
  const { club_id, event_id } = useParams()
  const [activeTab, setActiveTab] = useState('overview')
  const role = useAuthStore((s) => s.role)

  const navigate = useNavigate()
  const { data: event, isLoading } = useEvent(club_id, event_id)

  if (isLoading) {
    return (
      <div className="flex h-dvh flex-col">
        <Navbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 bg-background">
            <LoadingSpinner fullPage label="Loading event…" />
          </main>
        </div>
      </div>
    )
  }

  // ── Guest user — render the 5-step wizard ──────────────────────────────────
  if (role === 'guest') {
    return (
      <div className="flex h-dvh flex-col overflow-hidden">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="page-container">
              {/* Heading */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-foreground">
                  {event?.name ?? 'Certificate Wizard'}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  Follow the steps below to generate and distribute certificates for this event.
                </p>
              </div>
              <GuestWizard clubId={club_id} eventId={event_id} />
            </div>
          </main>
        </div>
      </div>
    )
  }

  // ── All other roles — standard tabbed interface ────────────────────────────
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container">
            {/* Breadcrumb */}
            <nav className="mb-4 flex items-center gap-1.5 text-xs text-gray-400">
              <span
                className="cursor-pointer hover:text-navy transition-colors"
                onClick={() => window.history.back()}
              >
                Events
              </span>
              <span>›</span>
              <span className="font-medium text-foreground truncate max-w-xs">
                {event?.name ?? 'Event'}
              </span>
            </nav>

            {/* Page heading */}
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {event?.name ?? 'Event Detail'}
                </h1>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={event?.status ?? 'draft'} />
                  {event?.event_date && (
                    <span className="text-xs text-gray-500">
                      {formatDateOnly(event.event_date)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tab bar */}
            <div className="mb-6 flex gap-1 border-b border-gray-200 overflow-x-auto scrollbar-hide">
              {TABS.map((tab) => {
                const labels = {
                  overview: 'Overview',
                  participants: 'Participants',
                  'field-mapping': 'Field Mapping',
                  certificates: 'Certificates',
                }
                return (
                  <button
                    key={tab}
                    id={`event-tab-${tab}`}
                    onClick={() => setActiveTab(tab)}
                    className={`
                      relative whitespace-nowrap shrink-0 px-4 py-2.5 text-sm font-medium transition-colors
                      ${activeTab === tab
                        ? 'text-navy after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-navy after:rounded-t-full'
                        : 'text-gray-500 hover:text-navy'
                      }
                    `}
                  >
                    {labels[tab]}
                  </button>
                )
              })}
            </div>

            {/* Tab content */}
            {activeTab === 'overview' && (
              <OverviewTab
                event={event}
                clubId={club_id}
                eventId={event_id}
                onNextStep={() => setActiveTab('participants')}
              />
            )}
            {activeTab === 'participants' && (
              <ParticipantsTab
                clubId={club_id}
                eventId={event_id}
                event={event}
              />
            )}
            {activeTab === 'certificates' && (
              <CertificateIssue
                embedded
                clubId={club_id}
                eventId={event_id}
                event={event}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
