import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import FileUpload from '../../components/FileUpload'
import {
  useCertificates,
  useGenerateCerts,
  useSendRemaining,
  useResendCert,
  certKeys,
} from './certificatesApi'
import { BACKEND_URL } from '../../utils/axiosInstance'
import { useParticipants, useDeleteParticipant, participantKeys } from './participantsApi'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'

const IST_TIMEZONE = 'Asia/Kolkata'
const HAS_TZ_RE = /(Z|[+\-]\d{2}:\d{2})$/i

function formatDateTime(value) {
  if (!value) return '—'
  const raw = String(value)
  const dt = new Date(HAS_TZ_RE.test(raw) ? raw : `${raw}Z`)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: IST_TIMEZONE,
  })
}

// ── Pre-flight checklist ───────────────────────────────────────────────────
function PreflightItem({ ok, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`
          flex h-5 w-5 shrink-0 items-center justify-center rounded-full
          ${ok ? 'bg-green-100' : 'bg-gray-100'}
        `}
      >
        {ok ? (
          <svg className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      <span className={`text-sm ${ok ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
    </div>
  )
}

// ── Generation progress bar ────────────────────────────────────────────────
function GenerationProgress({ certs }) {
  if (!certs?.length) return null

  const total     = certs.length
  const generated = certs.filter((c) => ['generated', 'emailed'].includes(c.status)).length
  const emailed   = certs.filter((c) => c.status === 'emailed').length
  const failed    = certs.filter((c) => c.status === 'failed').length
  const pct       = Math.round((generated / total) * 100)

  const stats = [
    { label: 'Total',     value: total,     color: 'text-gray-700' },
    { label: 'Generated', value: generated, color: 'text-navy' },
    { label: 'Emailed',   value: emailed,   color: 'text-green-600' },
    ...(failed > 0 ? [{ label: 'Failed', value: failed, color: 'text-red-500' }] : []),
  ]

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="font-medium text-foreground">Generation Progress</span>
        <span>{pct}% complete</span>
      </div>

      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full bg-navy rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Stat pills */}
      <div className="flex items-center gap-4 flex-wrap">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
            <span className="text-xs text-gray-400">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Excel Upload Modal ─────────────────────────────────────────────────────
function ExcelUploadModal({ isOpen, onClose, societyId, eventId }) {
  const addToast = useToastStore((s) => s.addToast)
  const qc = useQueryClient()
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  if (!isOpen) return null

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      const a = document.createElement('a')
      a.href = `${BACKEND_URL}/societies/${societyId}/events/${eventId}/excel-template`
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
        `/societies/${societyId}/events/${eventId}/participants/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )

      await Promise.all([
        qc.invalidateQueries({ queryKey: ['participants', societyId, eventId] }),
        qc.invalidateQueries({ queryKey: participantKeys.list(societyId, eventId) }),
        qc.invalidateQueries({ queryKey: certKeys.list(societyId, eventId) }),
        qc.invalidateQueries({ queryKey: ['events', societyId, eventId] }),
        qc.invalidateQueries({ queryKey: ['society-events', societyId] }),
      ])

      setResult(data)
      addToast({
        type: 'success',
        message: `${data.created ?? 0} participant(s) imported successfully.`,
      })
      setTimeout(() => {
        onClose()
      }, 1200)
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || 'Upload failed.'
      addToast({ type: 'error', message: msg })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="card w-full max-w-xl p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="text-base font-bold text-foreground">Upload Participants Excel</h3>
            <p className="text-xs text-gray-500">Import participants to issue certificates</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step 1: Download Template */}
        <div className="card p-4 border border-gray-100">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy/10 text-xs font-bold text-navy">
              1
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground">Step 1 — Download Excel Template</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Standard columns: Name, Email, Registration Number, Role.
              </p>
              <button
                type="button"
                onClick={downloadTemplate}
                disabled={downloading}
                className="btn-secondary mt-2 text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {downloading ? 'Downloading…' : 'Download Template (.xlsx)'}
              </button>
            </div>
          </div>
        </div>

        {/* Step 2: Upload Filled File */}
        <div className="card p-4 border border-gray-100">
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy/10 text-xs font-bold text-navy">
              2
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Step 2 — Upload Filled Sheet</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Accepts .xlsx or .xls files up to 10 MB.</p>
              </div>

              <FileUpload
                id="modal-participant-excel-upload"
                accept=".xlsx,.xls"
                label="Drop Excel file here"
                hint=".xlsx or .xls · max 10 MB"
                maxSizeMB={10}
                onFile={setFile}
              />

              {file && (
                <div className="flex items-center justify-between text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-green-600 font-bold">📄</span>
                    <span className="font-medium truncate">{file.name}</span>
                    <span className="text-gray-400 shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-xs text-red-500 hover:text-red-700 ml-2 shrink-0 font-medium"
                  >
                    Remove
                  </button>
                </div>
              )}

              {result && (
                <div className={`p-3 rounded-lg text-xs space-y-1 ${
                  (result.errors?.length ?? 0) > 0 ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-green-50 text-green-800 border border-green-200'
                }`}>
                  <p className="font-semibold">✓ Upload Processed:</p>
                  <p>• Added: {result.created ?? 0} participant(s)</p>
                  {(result.skipped ?? 0) > 0 && <p>• Skipped duplicates: {result.skipped}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="button"
            id="modal-upload-excel-btn"
            onClick={uploadExcel}
            disabled={uploading || !file}
            className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
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
  )
}

// ── CertificateIssue ───────────────────────────────────────────────────────
/**
 * Used as:
 *   1. Inline tab inside EventDetail (`embedded` prop)
 *   2. Standalone page (uses useParams)
 */
export default function CertificateIssue({
  embedded = false,
  societyId: propSocietyId,
  clubId: propClubId,
  eventId: propEventId,
  event,
}) {
  const params    = useParams()
  const societyId = propSocietyId ?? propClubId ?? params.society_id ?? params.club_id
  const eventId   = propEventId ?? params.event_id
  const addToast  = useToastStore((s) => s.addToast)

  // Poll every 4 s while there are pending certs
  const [polling, setPolling] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  const {
    data: certs,
    isLoading,
  } = useCertificates(societyId, eventId, {
    refetchInterval: polling ? 4000 : false,
  })
  const { data: participants, isLoading: participantsLoading } = useParticipants(societyId, eventId)
  const generateMutation = useGenerateCerts(societyId, eventId)
  const sendMutation      = useSendRemaining(societyId, eventId)
  const resendMutation    = useResendCert(societyId, eventId)

  const { data: societyAssets } = useQuery({
    queryKey: ['society-assets', societyId],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/societies/${societyId}/assets`)
      return data
    },
    enabled: !!societyId,
    staleTime: 60 * 1000,
  })

  // Preflight checks (event report requirement is removed for professional societies)
  const verifiedParticipantsCount = (participants ?? []).filter((p) => p.verified).length
  const hasParticipants = verifiedParticipantsCount > 0 || (certs?.length ?? 0) > 0
  const hasAssets = Boolean(
    event?.assets?.logo_url ||
    event?.assets?.signature_url ||
    event?.assets?.is_configured ||
    societyAssets?.logo_url ||
    societyAssets?.signature_url ||
    societyAssets?.is_configured
  )
  const allReady        = hasParticipants && hasAssets

  const pendingCount    = (certs ?? []).filter((c) => c.status === 'pending').length
  const failedCount     = (certs ?? []).filter((c) => c.status === 'failed').length
  const generatedCount  = (certs ?? []).filter((c) =>
    ['generated', 'emailed'].includes(c.status)).length
  const emailedCount    = (certs ?? []).filter((c) => c.status === 'emailed').length
  const pendingEmailCount = (certs ?? []).filter((c) => c.status === 'generated').length

  const handleGenerate = async () => {
    await generateMutation.mutateAsync()
    setPolling(true)
    setTimeout(() => setPolling(false), 60_000)
  }

  // Stop polling once no pending
  if (polling && pendingCount === 0 && !isLoading) {
    setPolling(false)
  }

  const deleteParticipant = useDeleteParticipant(societyId, eventId)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // Download all zip handler
  const handleDownloadAllZip = async () => {
    try {
      setDownloadingZip(true)
      const res = await axiosInstance.get(
        `/societies/${societyId}/events/${eventId}/certificates/download-all`,
        { responseType: 'blob' },
      )
      const blob = new Blob([res.data], { type: 'application/zip' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${event?.name || 'society-event'}-certificates.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
      addToast({ type: 'success', message: 'Certificates ZIP downloaded successfully.' })
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to download certificates ZIP.' })
    } finally {
      setDownloadingZip(false)
    }
  }

  // ── Table columns ────────────────────────────────────────────────────────
  const participantColumns = [
    { key: 'name', header: 'Name', searchKey: true, render: (_, row) => row.fields?.Name || '—' },
    { key: 'email', header: 'Email', searchKey: true },
    { key: 'registration_number', header: 'Reg No.', searchKey: true, render: (v) => v || '—' },
    { key: 'cert_type', header: 'Type', render: (v) => (v ?? 'participant').replace(/_/g, ' ') },
    { key: 'source', header: 'Source', render: (v) => <span className="capitalize">{v}</span> },
    {
      key: 'verified',
      header: 'Eligible',
      align: 'center',
      render: (v, row) =>
        v ? (
          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
            {row.source === 'registration' ? '✓ Attended' : 'Verified'}
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            Pending
          </span>
        ),
    },
    {
      key: '_delete',
      header: '',
      align: 'center',
      searchKey: false,
      render: (_, row) =>
        confirmDeleteId === row.id ? (
          <div className="flex items-center gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
            <button
              className="text-xs text-red-600 hover:text-red-800 font-semibold px-1 py-0.5 rounded bg-red-50 hover:bg-red-100 transition-colors"
              disabled={deleteParticipant.isPending}
              onClick={() => {
                deleteParticipant.mutate(row.id, {
                  onSettled: () => setConfirmDeleteId(null),
                })
              }}
            >
              {deleteParticipant.isPending ? '…' : 'Yes'}
            </button>
            <button
              className="text-xs text-gray-500 hover:text-gray-700 px-1 py-0.5 rounded hover:bg-gray-100 transition-colors"
              onClick={() => setConfirmDeleteId(null)}
            >
              No
            </button>
          </div>
        ) : (
          <button
            title="Remove participant"
            className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation()
              setConfirmDeleteId(row.id)
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        ),
    },
  ]

  const certColumns = [
    {
      key: 'cert_number',
      header: 'Cert Number',
      searchKey: true,
      render: (v) => <span className="font-mono text-xs font-semibold text-foreground">{v}</span>,
    },
    {
      key: 'recipient_name',
      header: 'Recipient',
      searchKey: true,
      render: (v, row) => (
        <div>
          <p className="font-medium text-foreground">{v}</p>
          <p className="text-xs text-gray-400">{row.recipient_email}</p>
        </div>
      ),
    },
    {
      key: 'cert_type',
      header: 'Type',
      render: (v) => <span className="capitalize">{v?.replace(/_/g, ' ')}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'generated_at',
      header: 'Generated',
      render: (v) => formatDateTime(v),
    },
    {
      key: 'emailed_at',
      header: 'Emailed',
      render: (v) => formatDateTime(v),
    },
    {
      key: '_actions',
      header: 'Actions',
      align: 'right',
      searchKey: false,
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          {/* Retry email if failed */}
          {row.status === 'failed' && (
            <button
              id={`retry-cert-${row.id}`}
              className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors"
              disabled={resendMutation.isPending}
              onClick={() => resendMutation.mutate(row.id)}
            >
              Retry
            </button>
          )}

          {/* Download cert */}
          {row.png_url && (
            <a
              id={`download-cert-${row.id}`}
              href={`${BACKEND_URL}${row.png_url}`}
              download={`${row.cert_number}.png`}
              className="text-xs font-semibold text-navy hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Download
            </a>
          )}
        </div>
      ),
    },
  ]

  const showCertTable = (certs?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      {/* ── Summary Stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="stat-card">
          <p className="stat-card-label">Eligible Participants</p>
          <p className="stat-card-value text-blue-600">{verifiedParticipantsCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Certificates Generated</p>
          <p className="stat-card-value text-navy">{generatedCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Emails Dispatched</p>
          <p className="stat-card-value text-green-600">{emailedCount}</p>
        </div>
        <div className="stat-card">
          <p className="stat-card-label">Pending / In-Progress</p>
          <p className="stat-card-value text-amber-500">{pendingCount + pendingEmailCount}</p>
        </div>
      </div>

      {/* ── Progress bar (visible while generating/emailing) ──────────────── */}
      <GenerationProgress certs={certs} />

      {/* ── Pre-flight checklist ─────────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground mb-3">
              Pre-flight Checklist
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <PreflightItem ok={hasParticipants} label="Participants imported & eligible" />
                {!hasParticipants && (
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(true)}
                    className="text-xs font-semibold text-navy hover:underline flex items-center gap-1 ml-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Upload Excel
                  </button>
                )}
              </div>
              <PreflightItem ok={hasAssets}       label="Logo & signature configured" />
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            {/* Action buttons row */}
            <div className="flex items-center gap-3">
              <button
                id="upload-excel-cert-tab-btn"
                type="button"
                className="btn-secondary flex items-center gap-2"
                onClick={() => setShowUploadModal(true)}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Upload Excel Sheet
              </button>

              {generatedCount > 0 && (
                <button
                  id="download-all-zip-btn"
                  className="btn-secondary"
                  disabled={downloadingZip}
                  onClick={handleDownloadAllZip}
                >
                  {downloadingZip ? (
                    <><LoadingSpinner size="sm" label="" /> Preparing ZIP…</>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download All (ZIP)
                    </>
                  )}
                </button>
              )}

              {/* Generate button */}
              <button
                id="generate-certs-btn"
                className="btn-primary"
                disabled={generateMutation.isPending || !allReady}
                onClick={handleGenerate}
                title={!allReady ? 'Complete the checklist before generating' : ''}
              >
                {generateMutation.isPending ? (
                  <><LoadingSpinner size="sm" label="" /> Generating…</>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Generate All Certificates
                  </>
                )}
              </button>
            </div>

            {/* Send remaining emails */}
            {pendingEmailCount > 0 && (
              <button
                id="send-remaining-btn"
                className="btn-secondary text-sm"
                disabled={sendMutation.isPending}
                onClick={() => sendMutation.mutate()}
              >
                {sendMutation.isPending ? (
                  <><LoadingSpinner size="sm" label="" /> Sending…</>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Approve & Send {pendingEmailCount} Pending Email{pendingEmailCount !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}

            {/* Failed resend alert */}
            {failedCount > 0 && (
              <p className="text-xs text-red-500 font-medium">
                ⚠️ {failedCount} delivery failure{failedCount !== 1 ? 's' : ''} — use "Retry" per row
              </p>
            )}
          </div>
        </div>

        {!allReady && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5">
            <p className="text-xs text-amber-800 font-medium">
              ⚠️ Complete all checklist items above before generating certificates.
            </p>
          </div>
        )}
      </div>

      {/* ── Email Delivery Speed & Calculation Notice ──────────────────────── */}
      <div className="card p-5 border-l-4 border-l-blue-600 bg-gradient-to-r from-blue-50/60 via-white to-white">
        <div className="flex items-start gap-3.5">
          <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700 shrink-0 mt-0.5 shadow-xs">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="space-y-1.5 flex-1">
            <h4 className="text-sm font-bold text-gray-900 tracking-tight">Email Dispatch Throughput Notice</h4>
            <p className="text-xs leading-relaxed text-gray-600">
              Certificates are queued and dispatched safely via SMTP in background batches. Dispatch throughput averages approximately <span className="font-semibold text-gray-900">5 to 10 certificates per minute</span> to ensure deliverability and comply with mail server rate limits.
            </p>
          </div>
        </div>
      </div>

      {/* ── Table (shows participants before generation, certificates after) ─ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {showCertTable
              ? `Issued Certificates (${certs.length})`
              : `Participants (${participants?.length ?? 0})`}
          </h3>
          <div className="flex items-center gap-2">
            {!showCertTable && (
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 font-medium"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Upload Excel Sheet
              </button>
            )}
            {showCertTable && (
              <span className="text-xs text-gray-400">
                Auto-refreshing while jobs are running
              </span>
            )}
          </div>
        </div>

        {showCertTable ? (
          <DataTable
            columns={certColumns}
            data={certs}
            keyField="id"
            searchPlaceholder="Search certificates by name, email, cert number…"
            pagination
            emptyMessage="No certificates found."
          />
        ) : (
          <DataTable
            columns={participantColumns}
            data={participants ?? []}
            keyField="id"
            searchPlaceholder="Search participants by name, email, reg no…"
            pagination
            loading={participantsLoading}
            emptyMessage={
              <div className="py-8 text-center space-y-3">
                <p className="text-sm text-gray-500">No participants added yet.</p>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="btn-primary text-xs mx-auto flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Upload Participants Excel
                </button>
              </div>
            }
          />
        )}
      </div>

      {/* ── Excel Upload Modal ─────────────────────────────────────────────── */}
      <ExcelUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        societyId={societyId}
        eventId={eventId}
      />
    </div>
  )
}
