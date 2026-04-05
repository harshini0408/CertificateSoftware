import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  useCertificates,
  useGenerateCerts,
  useSendRemaining,
  useResendCert,
} from '../api/certificates'
import { BACKEND_URL } from '../utils/axiosInstance'
import axiosInstance from '../utils/axiosInstance'
import { useParticipants } from '../api/participants'

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

// ── Pre-flight checklist ──────────────────────────────────────────────────────
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

// ── Generation progress bar ───────────────────────────────────────────────────
function GenerationProgress({ certs }) {
  if (!certs?.length) return null

  const total     = certs.length
  const generated = certs.filter((c) => ['generated', 'emailed'].includes(c.status)).length
  const emailed   = certs.filter((c) => c.status === 'emailed').length
  const failed    = certs.filter((c) => c.status === 'failed').length
  const pending   = certs.filter((c) => c.status === 'pending').length

  const pct = Math.round((generated / total) * 100)
  const isRunning = pending > 0

  const stats = [
    { label: 'Generated', value: generated, color: 'text-navy' },
    { label: 'Emailed',   value: emailed,   color: 'text-green-600' },
    { label: 'Pending',   value: pending,   color: 'text-amber-500' },
    { label: 'Failed',    value: failed,    color: 'text-red-500' },
  ]

  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {isRunning ? 'Generating…' : pct === 100 ? 'Generation Complete ✓' : 'Generation Progress'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {generated} of {total} certificate{total !== 1 ? 's' : ''} generated
          </p>
        </div>
        {isRunning && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            Processing
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
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

// ── CertificateIssue ──────────────────────────────────────────────────────────
/**
 * Used as:
 *   1. Inline tab inside EventDetail (`embedded` prop)
 *   2. Standalone page (uses useParams)
 */
export default function CertificateIssue({ embedded = false, clubId: propClubId, eventId: propEventId, event }) {
  const params  = useParams()
  const clubId  = propClubId  ?? params.club_id
  const eventId = propEventId ?? params.event_id

  // Poll every 4 s while there are pending certs
  const [polling, setPolling] = useState(false)

  const {
    data: certs,
    isLoading,
  } = useCertificates(clubId, eventId, {
    refetchInterval: polling ? 4000 : false,
  })
  const { data: participants, isLoading: participantsLoading } = useParticipants(clubId, eventId)
  const { data: fieldPositions } = useQuery({
    queryKey: ['field-positions', clubId, eventId],
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/clubs/${clubId}/events/${eventId}/field-positions`,
      )
      return data
    },
    enabled: !!clubId && !!eventId,
  })

  const generateMutation = useGenerateCerts(clubId, eventId)
  const sendMutation      = useSendRemaining(clubId, eventId)
  const resendMutation    = useResendCert(clubId, eventId)

  // Preflight checks (derived from event prop or certs meta)
  const hasParticipants = (certs?.length ?? 0) > 0 || (event?.participant_count ?? 0) > 0
  const hasAssets       = !!(event?.assets?.logo_url)
  const hasTemplates = Array.isArray(fieldPositions)
    ? fieldPositions.some((fp) => !!fp.template_filename)
    : !!(event?.template_map && Object.keys(event.template_map).length > 0)
  const hasMapping      = !!(event?.mapping_confirmed)
  const allReady        = hasParticipants && hasAssets && hasTemplates && hasMapping

  const pendingCount    = (certs ?? []).filter((c) => c.status === 'pending').length
  const failedCount     = (certs ?? []).filter((c) => c.status === 'failed').length
  const generatedCount  = (certs ?? []).filter((c) =>
    ['generated', 'emailed'].includes(c.status)).length
  const emailedCount    = (certs ?? []).filter((c) => c.status === 'emailed').length
  const pendingEmailCount = (certs ?? []).filter((c) => c.status === 'generated').length

  const handleGenerate = async () => {
    await generateMutation.mutateAsync()
    setPolling(true)
    // Stop polling after 60 s regardless
    setTimeout(() => setPolling(false), 60_000)
  }

  // Stop polling once no pending
  if (polling && pendingCount === 0 && !isLoading) {
    setPolling(false)
  }

  // ── Table columns ─────────────────────────────────────────────────────────
  const participantColumns = [
    { key: 'name', header: 'Name', searchKey: true, render: (_, row) => row.fields?.Name || '—' },
    { key: 'email', header: 'Email', searchKey: true },
    { key: 'registration_number', header: 'Reg No.', searchKey: true, render: (v) => v || '—' },
    { key: 'cert_type', header: 'Type', render: (v) => (v ?? 'participant').replace(/_/g, ' ') },
    { key: 'source', header: 'Source' },
    { key: 'verified', header: 'Verified', align: 'center', render: (v) => (v ? 'Yes' : 'No') },
  ]

  const certColumns = [
    {
      key: 'cert_number',
      header: 'Cert No.',
      sortable: true,
      searchKey: true,
      render: (v) => (
        <span className="font-mono text-xs font-semibold text-navy">{v ?? '—'}</span>
      ),
    },
    {
      key: 'participant_email',
      header: 'Participant',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <div className="flex flex-col">
          <span className="text-sm text-foreground">
            {row.participant_name ?? v}
          </span>
          {row.participant_name && (
            <span className="text-xs text-gray-400">{v}</span>
          )}
        </div>
      ),
    },
    {
      key: 'cert_type',
      header: 'Type',
      render: (v) => (
        <span className="text-xs font-medium capitalize text-gray-600">
          {(v ?? 'participant').replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (v, row) => (
        <div className="flex flex-col gap-0.5">
          <StatusBadge status={v} />
          {v === 'failed' && row.failure_reason && (
            <span className="max-w-[260px] truncate text-[11px] text-red-500" title={row.failure_reason}>
              {row.failure_reason}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'generated_at',
      header: 'Generated',
      render: (v) => formatDateTime(v),
    },
    {
      key: 'id',
      header: 'Actions',
      align: 'center',
      render: (certId, row) => (
        <div className="flex items-center justify-center gap-2">
          {/* Preview certificate */}
          {['generated', 'emailed'].includes(row.status) && row.pdf_url && (
            <a
              href={`${BACKEND_URL}${row.pdf_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-1 text-navy hover:bg-navy/10 transition-colors"
              title="Preview certificate"
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7s-8.268-2.943-9.542-7z" />
              </svg>
            </a>
          )}
          {/* Resend email for failed / generated(not-emailed) */}
          {['failed', 'generated'].includes(row.status) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                resendMutation.mutate(certId)
              }}
              disabled={resendMutation.isPending}
              className="rounded p-1 text-amber-500 hover:bg-amber-50 transition-colors"
              title={row.status === 'failed' ? 'Retry email' : 'Send email'}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4l16 8-16 8V4z" />
              </svg>
            </button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Participant review list ─────────────────────────────────────── */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Participant Review Before Generation</p>
          <span className="text-xs text-gray-500">
            {(participants ?? []).length} participant{(participants ?? []).length !== 1 ? 's' : ''}
          </span>
        </div>

        <DataTable
          columns={participantColumns}
          data={participants ?? []}
          isLoading={participantsLoading}
          emptyMessage="No participants found for this event."
          searchable
          searchPlaceholder="Search participants by name, email, reg no..."
          rowKey="id"
        />
      </div>

      {/* ── Pre-flight checklist ───────────────────────────────────────── */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground mb-3">
              Pre-flight Checklist
            </p>
            <div className="space-y-2">
              <PreflightItem ok={hasParticipants} label="Participants imported" />
              <PreflightItem ok={hasAssets}       label="Logo & signature uploaded" />
              <PreflightItem ok={hasTemplates}    label="Certificate templates assigned" />
              <PreflightItem ok={hasMapping}      label="Field mapping confirmed" />
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
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
                ⚠ {failedCount} delivery failure{failedCount !== 1 ? 's' : ''} — use "Retry" per row
              </p>
            )}
          </div>
        </div>

        {!allReady && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-100 px-4 py-2.5">
            <p className="text-xs text-amber-700">
              Complete all checklist items before generating certificates.
            </p>
          </div>
        )}
      </div>

      {/* ── Generation progress ─────────────────────────────────────────── */}
      {certs && certs.length > 0 && (
        <GenerationProgress certs={certs} />
      )}

      {/* ── Certificates table ──────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">
            Certificates
            {certs?.length ? (
              <span className="ml-2 rounded-full bg-navy/10 px-2 py-0.5 text-xs font-semibold text-navy">
                {certs.length}
              </span>
            ) : null}
          </h2>

          {/* Quick stats */}
          {certs?.length > 0 && (
            <div className="flex items-center gap-4 text-xs">
              {[
                { label: 'Generated', n: generatedCount,  color: 'text-navy' },
                { label: 'Emailed',   n: emailedCount,    color: 'text-green-600' },
                { label: 'Failed',    n: failedCount,     color: 'text-red-500' },
              ].map((s) => s.n > 0 && (
                <span key={s.label} className={`font-semibold ${s.color}`}>
                  {s.n} {s.label}
                </span>
              ))}
            </div>
          )}
        </div>

        <DataTable
          columns={certColumns}
          data={certs ?? []}
          isLoading={isLoading}
          emptyMessage={
            allReady
              ? "No certificates yet. Click 'Generate All Certificates' to start."
              : 'Complete the checklist above to enable certificate generation.'
          }
          searchable
          searchPlaceholder="Search by cert no., email, or name…"
          rowKey="id"
        />
      </div>
    </div>
  )
}
