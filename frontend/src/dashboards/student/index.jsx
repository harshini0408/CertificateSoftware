import { useState } from 'react'

import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import StatCard from '../../components/StatCard'
import LoadingSpinner from '../../components/LoadingSpinner'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'
import {
  useMyCredits,
  useMyCertificates,
  useMyProfile,
  CREDIT_WEIGHTS,
} from './api'

// ── Icon helpers ──────────────────────────────────────────────────────────────
const Icons = {
  cert: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  star: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
}

// ── Credit type badge colours ─────────────────────────────────────────────────
const TYPE_COLORS = {
  participant: 'bg-blue-100 text-blue-700',
  coordinator: 'bg-purple-100 text-purple-700',
  winner_1st:  'bg-amber-100 text-amber-700',
  winner_2nd:  'bg-gray-100 text-gray-600',
  winner_3rd:  'bg-orange-100 text-orange-700',
  mentor:      'bg-green-100 text-green-700',
  judge:       'bg-red-100 text-red-700',
  volunteer:   'bg-teal-100 text-teal-700',
}

// ── Credits breakdown bar ─────────────────────────────────────────────────────
function CreditsBreakdown({ breakdown, total }) {
  if (!breakdown?.length) return null

  const PALETTE = [
    '#1E3A5F', '#C9A84C', '#3B82F6', '#10B981',
    '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4',
  ]

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Credit Breakdown</h2>
        <span className="text-2xl font-black text-navy">{total}</span>
      </div>

      <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
        {breakdown.map((item, i) => {
          const pct = total > 0 ? (item.credits / total) * 100 : 0
          if (pct < 1) return null
          return (
            <div
              key={item.cert_type}
              title={`${item.cert_type}: ${item.credits} credits`}
              style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
              className="rounded-sm transition-all duration-500"
            />
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {breakdown.map((item, i) => (
          <div key={item.cert_type} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
            />
            <span className="text-xs text-gray-600 capitalize truncate">
              {item.cert_type.replace(/_/g, ' ')}
            </span>
            <span className="text-xs font-bold text-navy ml-auto">{item.credits}</span>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-1.5">Credit weights per cert type:</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CREDIT_WEIGHTS).map(([type, weight]) => (
            <span
              key={type}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium
                ${TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {type.replace(/_/g, ' ')} × {weight}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function StudentDashboard() {
  const [downloadingId, setDownloadingId] = useState(null)
  const addToast = useToastStore((s) => s.addToast)

  const { data: profile,  isLoading: profileLoading  } = useMyProfile()
  const { data: credits,  isLoading: creditsLoading  } = useMyCredits()
  const { data: certs,    isLoading: certsLoading    } = useMyCertificates()

  const totalCerts   = certs?.length ?? 0
  const totalCredits = credits?.total_credits ?? 0

  const handleDownload = async (certNumber, certId) => {
    setDownloadingId(certId)
    try {
      const response = await axiosInstance.get(
        `/students/me/certificates/${certNumber}/download`,
        { responseType: 'blob' }
      )
      const blob = new Blob([response.data], { type: 'image/png' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${certNumber}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      const status = err?.response?.status
      const msg =
        status === 404
          ? 'Certificate file is not available yet. Try again after generation completes.'
          : 'Download failed. Please try again.'
      addToast({ type: 'error', message: msg })
    } finally {
      setDownloadingId(null)
    }
  }

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
      key: 'event_name',
      header: 'Event',
      sortable: true,
      searchKey: true,
    },
    {
      key: 'club_name',
      header: 'Club',
      sortable: true,
      searchKey: true,
      render: (v) => (
        <span className="text-xs text-gray-500">{v ?? '—'}</span>
      ),
    },
    {
      key: 'cert_type',
      header: 'Type',
      render: (v) => (
        <span
          className={`
            inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize
            ${TYPE_COLORS[v] ?? 'bg-gray-100 text-gray-600'}
          `}
        >
          {(v ?? 'participant').replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'issued_at',
      header: 'Issued On',
      sortable: true,
      render: (v) =>
        v
          ? new Date(v).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
            })
          : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'cert_number',
      header: 'Download',
      align: 'center',
      render: (certNumber, row) => {
        const isDownloading = downloadingId === row._id
        const canDownload = row.status === 'generated' || row.status === 'emailed'

        if (!canDownload) {
          return <span className="text-xs text-gray-300">Not ready</span>
        }

        return (
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDownload(certNumber, row._id)
            }}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium
              text-navy border border-navy/30 hover:bg-navy hover:text-white
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download certificate as PNG"
          >
            {isDownloading ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Saving…
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                PNG
              </>
            )}
          </button>
        )
      },
    },
  ]

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container space-y-6">

            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {profileLoading ? (
                    <span className="inline-block h-7 w-48 animate-pulse rounded bg-gray-200" />
                  ) : (
                    <>Hello, {profile?.name ?? profile?.email?.split('@')[0] ?? 'Student'} 👋</>
                  )}
                </h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  Here's your certificate and credit summary.
                </p>
              </div>

              <a
                href="/verify"
                className="btn-secondary text-sm self-start sm:self-center"
              >
                🔍 Verify a Certificate
              </a>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="My Certificates"
                value={totalCerts}
                icon={Icons.cert}
                accent="navy"
                isLoading={certsLoading}
              />
              <StatCard
                label="Total Credits"
                value={totalCredits}
                icon={Icons.star}
                accent="gold"
                isLoading={creditsLoading}
              />
            </div>

            <CreditsBreakdown
              breakdown={credits?.breakdown}
              total={totalCredits}
            />

            <div>
              <h2 className="section-title mb-3">Credit History</h2>
              <DataTable
                columns={[
                 { key: 'cert_number', header: 'Cert No.', searchKey: true,
                   render: (v) => <span className="font-mono text-xs font-semibold text-navy">{v}</span> },
                 { key: 'event_name', header: 'Event' },
                 { key: 'club_name', header: 'Club',
                   render: (v) => <span className="text-xs text-gray-500">{v}</span> },
                 { key: 'cert_type', header: 'Type',
                   render: (v) => <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${TYPE_COLORS[v] ?? 'bg-gray-100 text-gray-600'}`}>{v.replace(/_/g, ' ')}</span> },
                 { key: 'credits', header: 'Credits Earned', align: 'right',
                   render: (v) => <span className="font-bold text-green-600">+{v}</span> },
                 { key: 'issued_at', header: 'Date',
                   render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' }
               ]}
                data={credits?.credit_history ?? []}
                isLoading={creditsLoading}
                emptyMessage="No credit history found."
                searchable
                searchPlaceholder="Search history..."
              />
            </div>

            <div>
              <h2 className="section-title mb-3">My Certificates</h2>
              <DataTable
                columns={certColumns}
                data={certs ?? []}
                isLoading={certsLoading}
                emptyMessage="No certificates yet. Participate in events to earn certificates."
                searchable
                searchPlaceholder="Search by event name, cert no…"
                rowKey="_id"
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
