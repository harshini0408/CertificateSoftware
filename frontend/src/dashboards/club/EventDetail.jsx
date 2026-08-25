import { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import FileUpload from '../../components/FileUpload'
import LoadingSpinner from '../../components/LoadingSpinner'
import DataTable from '../../components/DataTable'
import {
  useEvent,
  eventKeys,
  useUploadReport,
  useUploadPoster,
  useClubCreditRules,
  useVolunteerRequests,
  useUpdateVolunteerStatus,
  useUpdateVolunteerCount,
  useUpdateEvent,
} from './eventsApi'
import { participantKeys, useParticipants, useUpdateParticipantType, useVerifyParticipant } from './participantsApi'
import { certKeys } from './certificatesApi'
import { useToastStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'

import CertificateIssue from './CertificateIssue'
import axiosInstance, { BACKEND_URL } from '../../utils/axiosInstance'

// ─── Tab ids ──────────────────────────────────────────────────────────────────
const TABS = ['overview', 'volunteer-requests', 'participants', 'certificates']

// The roles will be fetched dynamically via useClubCreditRules

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
  const uploadPoster = useUploadPoster(clubId, eventId)
  const uploadReport = useUploadReport(clubId, eventId)
  const updateEvent = useUpdateEvent(clubId, eventId)
  const [selectedReportFile, setSelectedReportFile] = useState(null)
  const [selectedPosterFile, setSelectedPosterFile] = useState(null)

  const toAssetSrc = (url, hash) => {
    if (!url) return null
    const withVersion = hash ? `${url}${url.includes('?') ? '&' : '?'}v=${hash}` : url
    if (withVersion.startsWith('blob:') || withVersion.startsWith('http')) return withVersion
    const normalized = withVersion.startsWith('/') ? withVersion : `/${withVersion}`
    return `${BACKEND_URL}${normalized}`
  }

  const handleReportUpload = () => {
    if (!selectedReportFile) return
    uploadReport.mutate(selectedReportFile, {
      onSuccess: () => setSelectedReportFile(null),
    })
  }

  const handlePosterUpload = () => {
    if (!selectedPosterFile) return
    uploadPoster.mutate(selectedPosterFile, {
      onSuccess: () => setSelectedPosterFile(null),
    })
  }

  const reportStatus = event?.report_status || 'not_submitted'
  const reportStatusLabels = {
    not_submitted: { text: 'Not Submitted', cls: 'bg-gray-100 text-gray-600' },
    pending_review: { text: 'Under Review by Student Affairs', cls: 'bg-amber-100 text-amber-700' },
    accepted: { text: 'Report Accepted', cls: 'bg-green-100 text-green-700' },
    rejected: { text: 'Report Rejected', cls: 'bg-red-100 text-red-700' },
  }
  const currentReportStatus = reportStatusLabels[reportStatus] || reportStatusLabels.not_submitted

  return (
    <div className="space-y-8 max-w-3xl">
      {/* ── Event details card ─────────────────────────────────────────── */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Event Details</h2>
          <div className="flex items-center gap-2">
            {event?.is_published && (
              <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                Published Upcoming
              </span>
            )}
            <select
              value={event?.status || 'draft'}
              onChange={(e) => updateEvent.mutate({ status: e.target.value })}
              disabled={updateEvent.isPending}
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase border focus:outline-none focus:ring-2 focus:ring-navy/20 cursor-pointer transition-colors ${
                event?.status === 'active' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                event?.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
                event?.status === 'closed' ? 'bg-red-100 text-red-700 border-red-200' :
                'bg-gray-100 text-gray-700 border-gray-300'
              }`}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            ['Name', event?.name],
            ['Date', event?.event_date ? formatDateOnly(event.event_date) : '—'],
            ['Time', event?.event_time || '—'],
            ['Venue', event?.venue || '—'],
            ['Category', event?.category || '—'],
            ['Academic Year', event?.academic_year || '—'],
            ['Participants', (event?.participant_count ?? 0).toLocaleString()],
            ['Certificates Issued', (event?.cert_count ?? 0).toLocaleString()],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {label}
              </dt>
              <dd className="text-sm font-medium text-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {event?.description && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Description</dt>
            <dd className="mt-1 text-sm text-gray-600">{event.description}</dd>
          </div>
        )}
      </section>

      {/* ── Event Report Section ───────────────────────────────────────── */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Event Report</h2>
            <p className="text-xs text-gray-500 mt-0.5">Submit an event completion report to Student Affairs for review.</p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${currentReportStatus.cls}`}>
            {currentReportStatus.text}
          </span>
        </div>

        {/* Rejection Alert */}
        {reportStatus === 'rejected' && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 space-y-1">
            <p className="text-xs font-bold text-red-800 uppercase tracking-wide">Student Affairs Review Remarks:</p>
            <p className="text-sm text-red-700">{event?.report_rejection_reason || 'Please review and re-upload the event report.'}</p>
          </div>
        )}

        {/* Existing report link */}
        {event?.report_url && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl">📄</span>
              <div className="truncate">
                <p className="text-sm font-medium text-foreground truncate">{event.report_filename || 'Event Report'}</p>
                <p className="text-xs text-gray-400">
                  {event.report_uploaded_at ? `Uploaded ${new Date(event.report_uploaded_at).toLocaleDateString('en-IN')}` : ''}
                </p>
              </div>
            </div>
            <a
              href={`${BACKEND_URL}${event.report_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs shrink-0"
            >
              View / Download
            </a>
          </div>
        )}

        {/* Upload form if not submitted or rejected */}
        {(reportStatus === 'not_submitted' || reportStatus === 'rejected') && (
          <div className="pt-2 space-y-3">
            <label className="block text-xs font-semibold text-gray-600 uppercase">
              {reportStatus === 'rejected' ? 'Re-upload Revised Report' : 'Upload Event Report (PDF, DOCX, PNG)'}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={(e) => setSelectedReportFile(e.target.files?.[0] || null)}
                className="form-input text-xs flex-1"
              />
              <button
                type="button"
                onClick={handleReportUpload}
                disabled={!selectedReportFile || uploadReport.isPending}
                className="btn-primary text-xs shrink-0"
              >
                {uploadReport.isPending ? 'Uploading…' : reportStatus === 'rejected' ? 'Re-submit Report' : 'Submit Report'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Event Poster Section ────────────────────────────────────────── */}
      <section className="card p-6 space-y-4">
        <h2 className="section-title">Event Poster</h2>
        {event?.poster_url ? (
          <div className="space-y-3">
            <img
              src={event.poster_url.startsWith('/') ? `${BACKEND_URL}${event.poster_url}` : event.poster_url}
              alt="Event Poster"
              className="max-h-64 rounded-lg border border-gray-200 object-contain bg-gray-50"
            />
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedPosterFile(e.target.files?.[0] || null)}
                className="form-input text-xs flex-1"
              />
              <button
                type="button"
                onClick={handlePosterUpload}
                disabled={!selectedPosterFile || uploadPoster.isPending}
                className="btn-secondary text-xs shrink-0"
              >
                {uploadPoster.isPending ? 'Updating…' : 'Change Poster'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Add an event poster to be displayed on the Student and Student Affairs upcoming event feeds.</p>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedPosterFile(e.target.files?.[0] || null)}
                className="form-input text-xs flex-1"
              />
              <button
                type="button"
                onClick={handlePosterUpload}
                disabled={!selectedPosterFile || uploadPoster.isPending}
                className="btn-primary text-xs shrink-0"
              >
                {uploadPoster.isPending ? 'Uploading…' : 'Upload Poster'}
              </button>
            </div>
          </div>
        )}
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
// Volunteer Requests Tab
// ─────────────────────────────────────────────────────────────────────────────
function VolunteerRequestsTab({ clubId, eventId, event }) {
  const { data: volunteerRequests, isLoading } = useVolunteerRequests(clubId, eventId)
  const updateStatus = useUpdateVolunteerStatus(clubId, eventId)
  const updateCount = useUpdateVolunteerCount(clubId, eventId)
  const [isEditingCount, setIsEditingCount] = useState(false)
  const [countInput, setCountInput] = useState(event?.volunteers_required ?? 0)

  useEffect(() => {
    setCountInput(event?.volunteers_required ?? 0)
  }, [event?.volunteers_required])

  const requests = Array.isArray(volunteerRequests) ? volunteerRequests : []
  const acceptedCount = requests.filter((r) => r.status === 'accepted' || (r.verified && r.status !== 'rejected')).length
  const pendingCount = requests.filter((r) => r.status === 'pending' || (!r.verified && r.status !== 'rejected')).length
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length
  const volunteersRequired = event?.volunteers_required ?? 0

  const handleSaveCount = () => {
    const num = Math.max(0, parseInt(countInput, 10) || 0)
    updateCount.mutate(num, {
      onSuccess: () => setIsEditingCount(false),
    })
  }

  const columns = [
    {
      key: 'student_name',
      header: 'Student Name',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <div>
          <div className="font-semibold text-foreground">{v || row.student_email || '—'}</div>
          {row.registration_number && (
            <div className="text-xs font-mono text-gray-400">{row.registration_number}</div>
          )}
        </div>
      ),
    },
    {
      key: 'student_email',
      header: 'Email',
      sortable: true,
      searchKey: true,
      render: (v) => <span className="text-xs text-gray-600">{v}</span>,
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
      searchKey: true,
      render: (v) => <span className="text-xs text-gray-600">{v || '—'}</span>,
    },
    {
      key: 'registered_at',
      header: 'Applied Date',
      sortable: true,
      render: (v) => <span className="text-xs text-gray-500">{formatDateTime(v)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (v, row) => {
        const isAccepted = v === 'accepted' || (row.verified && v !== 'rejected')
        const isRejected = v === 'rejected'
        if (isAccepted) {
          return (
            <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              Accepted
            </span>
          )
        }
        if (isRejected) {
          return (
            <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
              Rejected
            </span>
          )
        }
        return (
          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            Pending Review
          </span>
        )
      },
    },
    {
      key: '_actions',
      header: 'Actions',
      align: 'center',
      searchKey: false,
      render: (_, row) => {
        const isAccepted = row.status === 'accepted' || (row.verified && row.status !== 'rejected')
        const isRejected = row.status === 'rejected'
        const itemId = row.participant_id || row.registration_id || row.id

        return (
          <div className="flex items-center justify-center gap-2">
            {!isAccepted && (
              <button
                type="button"
                className="btn-primary text-xs py-1 px-2.5 h-auto bg-green-600 hover:bg-green-700"
                onClick={() => updateStatus.mutate({ itemId, status: 'accepted' })}
                disabled={updateStatus.isPending}
                title="Accept volunteer request"
              >
                Accept
              </button>
            )}
            {!isRejected && (
              <button
                type="button"
                className="btn-secondary text-xs py-1 px-2.5 h-auto text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => updateStatus.mutate({ itemId, status: 'rejected' })}
                disabled={updateStatus.isPending}
                title="Reject volunteer request"
              >
                Reject
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      {/* Volunteer Capacity & Stats Header */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Volunteers Required</span>
            {!isEditingCount ? (
              <button
                type="button"
                onClick={() => setIsEditingCount(true)}
                className="text-xs text-navy hover:underline font-semibold flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Count
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsEditingCount(false)
                  setCountInput(volunteersRequired)
                }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
            )}
          </div>
          {isEditingCount ? (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={countInput}
                onChange={(e) => setCountInput(e.target.value)}
                className="form-input text-lg font-bold py-1 px-2 w-24 h-auto"
                autoFocus
              />
              <button
                type="button"
                className="btn-primary text-xs py-1.5 px-3 h-auto"
                onClick={handleSaveCount}
                disabled={updateCount.isPending}
              >
                {updateCount.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-navy">{volunteersRequired}</span>
              <span className="text-xs text-gray-500">slots needed</span>
            </div>
          )}
        </div>

        <div className="card p-5 flex flex-col justify-between border-l-4 border-green-500">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Accepted Volunteers</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-green-700">{acceptedCount}</span>
            <span className="text-xs text-gray-500">/ {volunteersRequired} filled</span>
          </div>
        </div>

        <div className="card p-5 flex flex-col justify-between border-l-4 border-amber-400">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Pending Requests</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">{pendingCount}</span>
            <span className="text-xs text-gray-500">awaiting decision</span>
          </div>
        </div>
      </div>

      {/* Volunteer Requests Table */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Volunteer Requests</h2>
            <p className="text-xs text-gray-500">Review, accept, or reject student requests to volunteer for this event.</p>
          </div>
          {acceptedCount >= volunteersRequired && volunteersRequired > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              ✓ Required volunteer capacity reached
            </span>
          )}
        </div>

        <DataTable
          columns={columns}
          data={requests}
          isLoading={isLoading}
          emptyMessage="No volunteer requests received yet for this event."
          searchable
          searchPlaceholder="Search volunteer applicants…"
          rowKey="id"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel Upload Sub-tab
// ─────────────────────────────────────────────────────────────────────────────
function ExcelUploadTab({ clubId, eventId }) {
  const addToast = useToastStore((s) => s.addToast)
  const qc = useQueryClient()
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

      // Keep all dependent screens in sync without manual page refresh.
      await Promise.all([
        qc.invalidateQueries({ queryKey: participantKeys.list(clubId, eventId) }),
        qc.invalidateQueries({ queryKey: certKeys.list(clubId, eventId) }),
        qc.invalidateQueries({ queryKey: eventKeys.detail(clubId, eventId) }),
      ])

      setResult(data)
      addToast({
        type: 'success',
        message: `${data.created ?? 0} participant(s) imported successfully.`,
      })
      if ((data.created ?? 0) > 0) {
        addToast({ type: 'info', message: 'Participants imported. Proceed to Certificates.' })
      }
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        'Upload failed.'
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
  const { data: creditRules } = useClubCreditRules(clubId)
  const dynamicRoles = creditRules?.map(r => r.cert_type) || ['participant']

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
            placeholder="participant@psgitech.ac.in"
            {...register('email', {
              required: 'Email is required.',
              pattern: { value: /^[a-zA-Z0-9._%+-]+@psgitech\.ac\.in$/i, message: 'Only @psgitech.ac.in emails are allowed.' },
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
            {dynamicRoles.map((ct) => (
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
  { id: 'list',   label: 'Registered List' },
  { id: 'excel',  label: 'Excel Upload' },
  { id: 'manual', label: 'Manual Entry' },
]

function ParticipantsTab({ clubId, eventId, event }) {
  const [subTab, setSubTab] = useState('list')

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
      {subTab === 'list' && (
        <ParticipantListTab
          clubId={clubId}
          eventId={eventId}
        />
      )}
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
// Participant List Sub-tab
// ─────────────────────────────────────────────────────────────────────────────
function ParticipantListTab({ clubId, eventId }) {
  const { data: participants, isLoading } = useParticipants(clubId, eventId)
  const updateType = useUpdateParticipantType(clubId, eventId)
  const verifyParticipant = useVerifyParticipant(clubId, eventId)
  const { data: creditRules } = useClubCreditRules(clubId)
  const dynamicRoles = creditRules?.map(r => r.cert_type) || ['participant']
  
  const columns = [
    { key: 'name', header: 'Name', searchKey: true, sortable: true, render: (_, row) => row.fields?.Name || '—' },
    { key: 'email', header: 'Email', searchKey: true, sortable: true },
    { key: 'registration_number', header: 'Reg No.', searchKey: true, sortable: true, render: (v) => v || '—' },
    {
      key: 'cert_type',
      header: 'Type',
      sortable: true,
      render: (v, row) => (
        <select
          className="form-input text-xs py-1 h-auto"
          value={v || 'participant'}
          onChange={(e) => updateType.mutate({ participantId: row.id, cert_type: e.target.value })}
          disabled={updateType.isPending}
        >
          {dynamicRoles.map((ct) => (
            <option key={ct} value={ct}>
              {ct.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
      )
    },
    { key: 'source', header: 'Source', sortable: true, render: (v) => <span className="capitalize">{v}</span> },
    { key: 'registered_at', header: 'Added On', sortable: true, render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    {
      key: 'verified',
      header: 'Status',
      render: (v, row) => (
        v ? (
          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Verified</span>
        ) : (
          <button
            className="btn-primary text-xs py-1 px-2 h-auto"
            onClick={() => verifyParticipant.mutate(row.id)}
            disabled={verifyParticipant.isPending}
          >
            Accept Request
          </button>
        )
      )
    }
  ]

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={participants || []}
        isLoading={isLoading}
        emptyMessage="No participants found. Students who register or get uploaded will appear here."
        searchable
        searchPlaceholder="Search participants..."
        rowKey="id"
      />
    </div>
  )
}


export default function EventDetail() {
  const { club_id, event_id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const role = useAuthStore((s) => s.role)

  const navigate = useNavigate()
  const { data: event, isLoading } = useEvent(club_id, event_id)
  const deriveDefaultTab = (evt) => {
    if ((evt?.cert_count ?? 0) > 0) return 'certificates'
    if ((evt?.participant_count ?? 0) > 0) return 'participants'
    return 'overview'
  }
  const requestedTab = searchParams.get('tab')
  const activeTab = TABS.includes(requestedTab) ? requestedTab : deriveDefaultTab(event)

  const setActiveTab = (tab) => {
    setSearchParams({ tab }, { replace: true })
  }

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
                {event?.event_date && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {formatDateOnly(event.event_date)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Tab bar */}
            <div className="mb-6 flex gap-1 border-b border-gray-200 overflow-x-auto scrollbar-hide">
              {TABS.map((tab) => {
                const labels = {
                  overview: 'Overview',
                  'volunteer-requests': 'Volunteer Requests',
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
                    {labels[tab] || tab}
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
                onNextStep={() => setActiveTab('volunteer-requests')}
              />
            )}
            {activeTab === 'volunteer-requests' && (
              <VolunteerRequestsTab
                clubId={club_id}
                eventId={event_id}
                event={event}
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
