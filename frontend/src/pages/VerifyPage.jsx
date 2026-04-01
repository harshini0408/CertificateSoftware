import { useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useVerifyCert } from '../api/verify'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Cert type display map ─────────────────────────────────────────────────────
const CERT_TYPE_LABELS = {
  participant:  'Participant',
  coordinator:  'Coordinator',
  winner_1st:   '1st Place Winner',
  winner_2nd:   '2nd Place Winner',
  winner_3rd:   '3rd Place Winner',
  mentor:       'Mentor',
  judge:        'Judge',
  volunteer:    'Volunteer',
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  generated: { valid: true,  label: 'VALID',   icon: '✓', bg: 'bg-green-50',  border: 'border-green-400', text: 'text-green-700',  ring: 'ring-green-300' },
  emailed:   { valid: true,  label: 'VALID',   icon: '✓', bg: 'bg-green-50',  border: 'border-green-400', text: 'text-green-700',  ring: 'ring-green-300' },
  revoked:   { valid: false, label: 'REVOKED', icon: '✗', bg: 'bg-red-50',    border: 'border-red-400',   text: 'text-red-700',    ring: 'ring-red-300' },
  pending:   { valid: false, label: 'PENDING', icon: '⏳', bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-700',  ring: 'ring-amber-300' },
}

// ── Detail row ────────────────────────────────────────────────────────────────
function DetailRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-gray-100 last:border-0">
      <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </dt>
      <dd className="text-sm font-medium text-gray-800">{value}</dd>
    </div>
  )
}

// ── VerifyPage ────────────────────────────────────────────────────────────────
export default function VerifyPage() {
  const params          = useParams()
  const [searchParams]  = useSearchParams()
  const [manualInput, setManualInput] = useState('')
  const [queryValue,  setQueryValue]  = useState('')

  // Priority: URL param → ?c= query string
  const paramCertNo  = params.cert_number
  const queryCertNo  = searchParams.get('c')
  const activeCertNo = paramCertNo ?? queryCertNo ?? queryValue ?? ''

  const { data, isLoading, isError, error } = useVerifyCert(
    activeCertNo.trim(),
  )

  const handleManualSearch = (e) => {
    e.preventDefault()
    setQueryValue(manualInput.trim())
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  const renderBadge = () => {
    if (!data) return null
    const cfg = data.valid
      ? (STATUS_CONFIG[data.status] ?? STATUS_CONFIG.generated)
      : { valid: false, label: 'INVALID', icon: '✗', bg: 'bg-red-50', border: 'border-red-400', text: 'text-red-700', ring: 'ring-red-300' }

    return (
      <div
        className={`
          flex flex-col items-center justify-center gap-2 rounded-2xl border-2 px-8 py-6
          ${cfg.bg} ${cfg.border} ring-4 ${cfg.ring}/20
        `}
        style={{ animation: 'fadeIn 0.3s ease-out' }}
      >
        <span className={`text-5xl font-black ${cfg.text}`}>{cfg.icon}</span>
        <span className={`text-xl font-bold tracking-widest uppercase ${cfg.text}`}>
          {cfg.label}
        </span>
        {data.valid && data.status === 'revoked' && (
          <p className="text-xs text-red-600 mt-1">
            This certificate has been revoked by the issuing organisation.
          </p>
        )}
      </div>
    )
  }

  const renderDetails = () => {
    if (!data?.valid) return null

    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Certificate header */}
        <div className="bg-navy px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold/80">
            Certificate of {CERT_TYPE_LABELS[data.cert_type] ?? (data.cert_type ?? 'Achievement')}
          </p>
          <h2 className="mt-0.5 text-lg font-bold text-white">
            {data.participant_name ?? data.participant_email}
          </h2>
        </div>

        <dl className="px-6 divide-y divide-gray-50">
          <DetailRow label="Certificate No."  value={data.cert_number} />
          <DetailRow label="Event"            value={data.event_name} />
          <DetailRow label="Club / Society"   value={data.club_name} />
          <DetailRow
            label="Event Date"
            value={data.event_date
              ? new Date(data.event_date).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })
              : undefined}
          />
          <DetailRow
            label="Issued On"
            value={data.issued_at
              ? new Date(data.issued_at).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })
              : undefined}
          />
          <DetailRow label="Registration No." value={data.registration_number} />
          <DetailRow label="Email"            value={data.participant_email} />
        </dl>

        {/* Download PDF */}
        {data.pdf_url && (
          <div className="px-6 py-4 border-t border-gray-100">
            <a
              id="verify-download-pdf"
              href={data.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Certificate PDF
            </a>
          </div>
        )}
      </div>
    )
  }

  const renderInvalid = () => {
    if (data?.valid !== false && !isError) return null
    const msg = data?.message
      ?? error?.response?.data?.detail
      ?? 'No certificate found with this number.'

    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-center"
        style={{ animation: 'fadeIn 0.3s ease-out' }}
      >
        <p className="text-sm font-semibold text-red-700">{msg}</p>
        <p className="mt-1 text-xs text-red-500">
          Double-check the certificate number and try again.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#0f2540] via-[#1E3A5F] to-[#0f2540] flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold">
            <svg className="h-5 w-5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">PSG iTech</p>
            <p className="text-[10px] text-white/50 leading-none mt-0.5">Certificate Verification</p>
          </div>
        </div>
        <Link
          to="/login"
          className="text-xs text-white/50 hover:text-white transition-colors"
        >
          Staff Login →
        </Link>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-start justify-center px-4 py-10 md:py-16">
        <div className="w-full max-w-md space-y-6">

          {/* Page title */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Verify Certificate</h1>
            <p className="mt-1 text-sm text-white/60">
              Enter a certificate number to check its authenticity.
            </p>
          </div>

          {/* Search form */}
          <form
            onSubmit={handleManualSearch}
            className="flex gap-2"
            id="verify-search-form"
          >
            <input
              id="verify-cert-input"
              type="text"
              className="form-input flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:bg-white/15"
              placeholder="e.g. PSGIT-2025-001234"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              autoComplete="off"
              autoFocus={!activeCertNo}
            />
            <button
              type="submit"
              id="verify-search-btn"
              className="btn-primary shrink-0"
              disabled={!manualInput.trim()}
            >
              Verify
            </button>
          </form>

          {/* Results */}
          {isLoading && <LoadingSpinner fullPage={false} label="Verifying…" />}

          {!isLoading && activeCertNo && (
            <div className="space-y-4">
              {renderBadge()}
              {renderDetails()}
              {renderInvalid()}
            </div>
          )}

          {/* Footer note */}
          <p className="text-center text-xs text-white/30">
            Certificates are issued by PSG College of Technology via PSG iTech platform.
            <br />For queries, contact your club coordinator.
          </p>
        </div>
      </main>
    </div>
  )
}
