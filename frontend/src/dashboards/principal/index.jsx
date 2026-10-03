import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'

import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import StatCard from '../../components/StatCard'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { BACKEND_URL } from '../../utils/axiosInstance'

import {
  usePrincipalStats,
  usePrincipalRankings,
  usePrincipalClubs,
  usePrincipalClubEvents,
  usePrincipalDepartments,
  usePrincipalDeptEvents,
  usePrincipalEventsOverview,
  usePrincipalStudents,
  usePrincipalStudentCertificates,
} from './api'

// ── Icons ────────────────────────────────────────────────────────────────────
const Icons = {
  clubs: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  departments: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21h16M6 21V7a1 1 0 011-1h10a1 1 0 011 1v14M9 10h.01M9 13h.01M9 16h.01M12 10h.01M12 13h.01M12 16h.01M15 10h.01M15 13h.01M15 16h.01" />
    </svg>
  ),
  calendar: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  users: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  template: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
}

function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const REPORT_STATUS_COLORS = {
  not_submitted: 'bg-gray-100 text-gray-600',
  pending_review: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

function ReportStatusBadge({ status }) {
  const label = (status || 'not_submitted').replace(/_/g, ' ')
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${REPORT_STATUS_COLORS[status] || REPORT_STATUS_COLORS.not_submitted}`}>
      {label}
    </span>
  )
}

function buildCreditPredicate(rawExpression) {
  const expr = (rawExpression || '').trim()
  if (!expr) return { fn: () => true, error: '' }

  const compact = expr.replace(/\s+/g, '')

  const rangeMatch = compact.match(/^(\d+)\-(\d+)$/)
  if (rangeMatch) {
    const low = Number(rangeMatch[1])
    const high = Number(rangeMatch[2])
    if (low > high) {
      return { fn: () => false, error: 'Invalid range. Use lower-higher (example: 10-20).' }
    }
    return {
      fn: (value) => {
        const points = Number(value || 0)
        return points >= low && points <= high
      },
      error: '',
    }
  }

  const comparatorMatch = compact.match(/^(<=|>=|<|>|=)?(\d+)$/)
  if (comparatorMatch) {
    const operator = comparatorMatch[1] || '='
    const target = Number(comparatorMatch[2])
    return {
      fn: (value) => {
        const points = Number(value || 0)
        switch (operator) {
          case '<': return points < target
          case '<=': return points <= target
          case '>': return points > target
          case '>=': return points >= target
          default: return points === target
        }
      },
      error: '',
    }
  }

  return {
    fn: () => false,
    error: 'Invalid format. Try <10, >=20, =15 or 10-20.',
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Dashboard Tab (Overview + Stats + Top 5 Rankings)
// ═══════════════════════════════════════════════════════════════════════════════

function DashboardOverviewTab({ onSelectClub, onSelectDept }) {
  const { data: stats, isLoading: loadingStats } = usePrincipalStats()
  const { data: rankings, isLoading: loadingRankings } = usePrincipalRankings(5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Principal Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Institution overview, participation rankings, and event statistics.</p>
      </div>

      {/* Top 5 KPI Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total Clubs"
          value={stats?.total_clubs ?? 0}
          icon={Icons.clubs}
          accent="navy"
          isLoading={loadingStats}
        />
        <StatCard
          label="Total Departments"
          value={stats?.total_departments ?? 0}
          icon={Icons.departments}
          accent="blue"
          isLoading={loadingStats}
        />
        <StatCard
          label="Club Events Conducted"
          value={stats?.club_events_count ?? 0}
          icon={Icons.calendar}
          accent="teal"
          isLoading={loadingStats}
        />
        <StatCard
          label="Dept Events Conducted"
          value={stats?.dept_events_count ?? 0}
          icon={Icons.template}
          accent="gold"
          isLoading={loadingStats}
        />
        <StatCard
          label="This Month's Participants"
          value={stats?.this_month_participants ?? 0}
          icon={Icons.users}
          accent="green"
          isLoading={loadingStats}
        />
      </div>

      {/* Top 5 Rankings Side by Side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top 5 Clubs */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Top 5 Clubs</h2>
              <p className="text-xs text-gray-500">Ranked by cumulative student participation</p>
            </div>
            <span className="inline-flex rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-semibold text-navy">
              Top 5
            </span>
          </div>

          {loadingRankings ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-navy border-t-transparent" />
            </div>
          ) : (rankings?.top_clubs || []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No club data available yet.</p>
          ) : (
            <div className="space-y-3">
              {(rankings?.top_clubs || []).map((club, idx) => (
                <div
                  key={club.club_id || idx}
                  onClick={() => onSelectClub && onSelectClub(club.club_id)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer border border-transparent hover:border-gray-200"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      idx === 0
                        ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300'
                        : idx === 1
                        ? 'bg-slate-200 text-slate-700'
                        : idx === 2
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{club.club_name}</p>
                    <p className="text-xs text-gray-500">
                      {club.event_count} completed event{club.event_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-navy">
                      {(club.total_participants || 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-gray-400">participants</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top 5 Departments */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Top 5 Departments</h2>
              <p className="text-xs text-gray-500">Ranked by cumulative student participation</p>
            </div>
            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              Top 5
            </span>
          </div>

          {loadingRankings ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-navy border-t-transparent" />
            </div>
          ) : (rankings?.top_departments || []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No department data available yet.</p>
          ) : (
            <div className="space-y-3">
              {(rankings?.top_departments || []).map((dept, idx) => (
                <div
                  key={dept.department || idx}
                  onClick={() => onSelectDept && onSelectDept(dept.department)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer border border-transparent hover:border-gray-200"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      idx === 0
                        ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300'
                        : idx === 1
                        ? 'bg-slate-200 text-slate-700'
                        : idx === 2
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{dept.department}</p>
                    <p className="text-xs text-gray-500">
                      {dept.event_count} event{dept.event_count !== 1 ? 's' : ''} conducted
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-700">
                      {(dept.total_participants || 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-gray-400">participants</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Clubs Tab
// ═══════════════════════════════════════════════════════════════════════════════

function ClubsTab({ onSelectClub }) {
  const { data: clubs, isLoading } = usePrincipalClubs()

  const columns = [
    {
      key: 'club_name',
      header: 'Club Name',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <button
          type="button"
          className="text-left font-semibold text-navy hover:underline"
          onClick={() => onSelectClub(row.club_id)}
        >
          {v}
        </button>
      ),
    },
    {
      key: 'events_this_semester',
      header: 'Events This Semester',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-semibold text-indigo-700">{v ?? 0}</span>,
    },
    {
      key: 'cumulative_participants',
      header: 'Cumulative Participants',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-bold text-green-700">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'total_completed_events',
      header: 'Total Conducted',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-semibold text-gray-700">{v ?? 0}</span>,
    },
    {
      key: '_actions',
      header: 'Action',
      align: 'center',
      render: (_, row) => (
        <button
          type="button"
          className="rounded bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy/20"
          onClick={() => onSelectClub(row.club_id)}
        >
          View Details
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clubs Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          List of all clubs, events conducted this semester, and cumulative student engagement.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={clubs || []}
        isLoading={isLoading}
        emptyMessage="No clubs found."
        rowKey="club_id"
        searchable
        searchPlaceholder="Search clubs..."
        onRowClick={(row) => onSelectClub(row.club_id)}
      />
    </div>
  )
}

// ── Club Detail Modal (Events list with Date, Venue, Time, Total Participants, Report Status & View Report) ──
function ClubDetailModal({ clubId, onClose }) {
  const { data, isLoading } = usePrincipalClubEvents(clubId)
  const events = data?.events || []
  const [selectedEventReport, setSelectedEventReport] = useState(null)

  const columns = [
    { key: 'name', header: 'Event Name', sortable: true, searchKey: true, render: (v) => <span className="font-semibold">{v || '—'}</span> },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'event_time', header: 'Time', render: (v) => v || '—' },
    { key: 'venue', header: 'Venue', render: (v) => v || '—' },
    {
      key: 'participant_count',
      header: 'Participants Registered',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-bold text-green-700">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'report_status',
      header: 'Report Status',
      render: (v) => <ReportStatusBadge status={v} />,
    },
    {
      key: '_actions',
      header: 'Report / View',
      align: 'center',
      render: (_, row) => {
        if (row.report_url) {
          const reportHref = String(row.report_url).startsWith('http')
            ? row.report_url
            : `${BACKEND_URL}${row.report_url}`
          return (
            <a
              href={reportHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
              onClick={(e) => e.stopPropagation()}
            >
              📄 View Report
            </a>
          )
        }
        return (
          <button
            type="button"
            className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-200"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedEventReport(row)
            }}
          >
            Details
          </button>
        )
      },
    },
  ]

  if (!clubId) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-navy">{data?.club_name || 'Club Events'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {events.length} completed event{events.length !== 1 ? 's' : ''} conducted
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <LoadingSpinner label="Loading club events..." />
          ) : (
            <DataTable
              columns={columns}
              data={events}
              isLoading={false}
              emptyMessage="No completed events found for this club."
              rowKey="id"
              searchable
              searchPlaceholder="Search events..."
              onRowClick={(row) => {
                if (row.report_url) {
                  const href = String(row.report_url).startsWith('http')
                    ? row.report_url
                    : `${BACKEND_URL}${row.report_url}`
                  window.open(href, '_blank')
                } else {
                  setSelectedEventReport(row)
                }
              }}
            />
          )}
        </div>

        {/* Modal for event without PDF */}
        {selectedEventReport && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
            onClick={() => setSelectedEventReport(null)}
          >
            <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-foreground">{selectedEventReport.name}</h3>
                  <p className="text-xs text-gray-500">{fmtDate(selectedEventReport.event_date)} · {selectedEventReport.venue}</p>
                </div>
                <button className="btn-secondary text-xs" onClick={() => setSelectedEventReport(null)}>Close</button>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold text-gray-600">Time:</span> {selectedEventReport.event_time}</p>
                <p><span className="font-semibold text-gray-600">Category:</span> {selectedEventReport.category}</p>
                <p><span className="font-semibold text-gray-600">Participants Registered:</span> {selectedEventReport.participant_count}</p>
                <p><span className="font-semibold text-gray-600">Report Status:</span> <ReportStatusBadge status={selectedEventReport.report_status} /></p>
                {selectedEventReport.description && (
                  <div className="mt-3 p-3 bg-gray-50 rounded border text-xs text-gray-700">
                    <p className="font-semibold mb-1">Description:</p>
                    {selectedEventReport.description}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Departments Tab
// ═══════════════════════════════════════════════════════════════════════════════

function DepartmentsTab({ onSelectDept }) {
  const { data: departments, isLoading } = usePrincipalDepartments()

  const columns = [
    {
      key: 'rank',
      header: 'Rank',
      align: 'center',
      sortable: true,
      render: (v) => (
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
            v === 1
              ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300'
              : v === 2
              ? 'bg-slate-200 text-slate-700'
              : v === 3
              ? 'bg-orange-100 text-orange-800'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {v}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
      searchKey: true,
      render: (v) => (
        <button
          type="button"
          className="text-left font-semibold text-navy hover:underline"
          onClick={() => onSelectDept(v)}
        >
          {v}
        </button>
      ),
    },
    {
      key: 'total_events',
      header: 'Total Events Conducted',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-semibold text-navy">{v ?? 0}</span>,
    },
    {
      key: 'cumulative_participants',
      header: 'Cumulative Participants',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-bold text-green-700">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'total_certs',
      header: 'Certificates Issued',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-semibold text-gray-700">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: '_actions',
      header: 'Action',
      align: 'center',
      render: (_, row) => (
        <button
          type="button"
          className="rounded bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy/20"
          onClick={() => onSelectDept(row.department)}
        >
          View Events
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Departments Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Departmental activity rankings, events conducted, and cumulative student participation metrics.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={departments || []}
        isLoading={isLoading}
        emptyMessage="No departments found."
        rowKey="department"
        searchable
        searchPlaceholder="Search departments..."
        onRowClick={(row) => onSelectDept(row.department)}
      />
    </div>
  )
}

// ── Department Detail Modal (Department events with Date, Participants count, Cert count, and Student Details) ──
function DeptDetailModal({ departmentName, onClose }) {
  const { data, isLoading } = usePrincipalDeptEvents(departmentName)
  const events = data?.events || []
  const [selectedEventStudents, setSelectedEventStudents] = useState(null)

  const columns = [
    { key: 'name', header: 'Event Name', sortable: true, searchKey: true, render: (v) => <span className="font-semibold">{v || '—'}</span> },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'semester', header: 'Semester', render: (v) => v || '—' },
    {
      key: 'participant_count',
      header: 'Participants Count',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-bold text-green-700">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'cert_count',
      header: 'Certificates Count',
      align: 'right',
      render: (v) => <span className="font-semibold text-navy">{v ?? 0}</span>,
    },
    {
      key: '_actions',
      header: 'Participants',
      align: 'center',
      render: (_, row) => (
        <button
          type="button"
          className="rounded bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy/20"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedEventStudents(row)
          }}
        >
          View Students
        </button>
      ),
    },
  ]

  const studentColumns = [
    { key: 'name', header: 'Name', sortable: true, searchKey: true, render: (v) => <span className="font-medium">{v || '—'}</span> },
    { key: 'registration_number', header: 'Reg No.', render: (v) => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'class_name', header: 'Class / Sec', render: (v) => v || '—' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role / Contribution', render: (v) => <span className="capitalize">{v || 'Participant'}</span> },
  ]

  if (!departmentName) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-navy">{departmentName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {events.length} event{events.length !== 1 ? 's' : ''} conducted by department
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <LoadingSpinner label="Loading department events..." />
          ) : (
            <DataTable
              columns={columns}
              data={events}
              isLoading={false}
              emptyMessage="No events found for this department."
              rowKey="id"
              searchable
              searchPlaceholder="Search department events..."
              onRowClick={(row) => setSelectedEventStudents(row)}
            />
          )}
        </div>

        {/* Nested Students Modal */}
        {selectedEventStudents && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
            onClick={() => setSelectedEventStudents(null)}
          >
            <div
              className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white p-5 shadow-2xl flex flex-col space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-foreground text-lg">{selectedEventStudents.name}</h3>
                  <p className="text-xs text-gray-500">
                    {fmtDate(selectedEventStudents.event_date)} · {departmentName} · {selectedEventStudents.students?.length || 0} participants
                  </p>
                </div>
                <button className="btn-secondary" onClick={() => setSelectedEventStudents(null)}>
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <DataTable
                  columns={studentColumns}
                  data={selectedEventStudents.students || []}
                  isLoading={false}
                  emptyMessage="No participants found for this event."
                  rowKey="id"
                  searchable
                  searchPlaceholder="Search participant..."
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Recent Events Tab
// ═══════════════════════════════════════════════════════════════════════════════

function RecentEventsTab() {
  const [eventSearch, setEventSearch] = useState('')
  const [eventSourceType, setEventSourceType] = useState('')
  const [eventSourceValue, setEventSourceValue] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)

  const debouncedEventSearch = useDebounce(eventSearch)

  const eventFilters = useMemo(() => {
    const f = {}
    if (eventSourceType) f.source_type = eventSourceType
    if (debouncedEventSearch) f.search = debouncedEventSearch
    return f
  }, [eventSourceType, debouncedEventSearch])

  const { data: eventsResp, isLoading: loadingEvents } = usePrincipalEventsOverview(eventFilters)
  const eventRows = eventsResp?.items || []

  const availableSourceNames = useMemo(
    () => [...new Set(eventRows.map((r) => r.source_name))].filter(Boolean).sort(),
    [eventRows],
  )

  const filteredEventRows = useMemo(
    () => (eventSourceValue ? eventRows.filter((r) => r.source_name === eventSourceValue) : eventRows),
    [eventRows, eventSourceValue],
  )

  const eventColumns = [
    {
      key: 'source_type',
      header: 'Source',
      render: (v) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            v === 'department' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
          }`}
        >
          {(v || '').replace('_', ' ')}
        </span>
      ),
    },
    { key: 'source_name', header: 'Club / Department', sortable: true, searchKey: true },
    { key: 'event_name', header: 'Event', sortable: true, searchKey: true, render: (v) => <span className="font-semibold">{v || '—'}</span> },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'certificates_count', header: 'Certificates', align: 'right', sortable: true, render: (v) => <span className="font-semibold text-navy">{v || 0}</span> },
    { key: 'participants_count', header: 'Participants', align: 'right', sortable: true, render: (v) => <span className="font-semibold text-green-700">{v || 0}</span> },
    {
      key: '_actions',
      header: 'Details',
      searchKey: false,
      align: 'center',
      render: (_, row) => (
        <button
          type="button"
          className="rounded bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy/20"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedEvent(row)
          }}
        >
          View Participants
        </button>
      ),
    },
  ]

  const participantColumns = [
    { key: 'name', header: 'Name', sortable: true, searchKey: true, render: (v) => <span className="font-medium">{v || '—'}</span> },
    { key: 'email', header: 'Email', searchKey: true },
    { key: 'registration_number', header: 'Reg Number', render: (v) => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'class_name', header: 'Class', render: (v) => v || '—' },
    { key: 'contribution', header: 'Role / Contribution', render: (v) => v || '—' },
    { key: 'allocated_points', header: 'Allocated Points', align: 'right', render: (v) => <span className="font-semibold text-green-700">{v || 0}</span> },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Recent Events</h1>
        <p className="mt-1 text-sm text-gray-500">Completed events history and participant breakdown.</p>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="search"
            placeholder="Search event / club / department"
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            className="form-input"
          />
          <select
            className="form-input"
            value={eventSourceType}
            onChange={(e) => {
              setEventSourceType(e.target.value)
              setEventSourceValue('')
            }}
          >
            <option value="">All Sources</option>
            <option value="club">Club Events</option>
            <option value="department">Department Events</option>
          </select>
          {eventSourceType && (
            <select
              className="form-input"
              value={eventSourceValue}
              onChange={(e) => setEventSourceValue(e.target.value)}
            >
              <option value="">
                {eventSourceType === 'club' ? 'All Clubs' : 'All Departments'}
              </option>
              {availableSourceNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 flex items-center justify-between">
            <span>Total Events:</span>
            <span className="font-semibold text-navy">{filteredEventRows.length}</span>
          </div>
        </div>
      </div>

      <DataTable
        columns={eventColumns}
        data={filteredEventRows}
        isLoading={loadingEvents}
        emptyMessage="No events found for selected filters."
        onRowClick={(row) => setSelectedEvent(row)}
      />

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setSelectedEvent(null)}>
          <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Participant Details</h2>
                <p className="text-sm text-gray-500">{selectedEvent.event_name} · {selectedEvent.source_name}</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setSelectedEvent(null)}>Close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <DataTable
                columns={participantColumns}
                data={selectedEvent.participants || []}
                isLoading={false}
                emptyMessage="No participant details available for this event."
                searchable
                searchPlaceholder="Search participant name/email..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Student Search Tab
// ═══════════════════════════════════════════════════════════════════════════════

function StudentSearchTab({ onSelectStudent }) {
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [batch, setBatch] = useState('')
  const [className, setClassName] = useState('')
  const [creditRangeExpression, setCreditRangeExpression] = useState('')

  const debouncedSearch = useDebounce(search)

  const filters = useMemo(() => {
    const f = {}
    if (debouncedSearch) f.search = debouncedSearch
    if (department) f.department = department
    if (batch) f.batch = batch
    if (className) f.className = className
    return f
  }, [debouncedSearch, department, batch, className])

  const { data: studentsResp, isLoading: loadingStudents } = usePrincipalStudents(filters)
  const students = studentsResp?.items || []
  const creditFilter = useMemo(
    () => buildCreditPredicate(creditRangeExpression),
    [creditRangeExpression],
  )
  const filteredStudents = useMemo(
    () => students.filter((student) => creditFilter.fn(student.total_credits)),
    [students, creditFilter],
  )

  const departmentOptions = useMemo(
    () => [...new Set((students || []).map((s) => s.department).filter(Boolean))].sort(),
    [students],
  )
  const batchOptions = useMemo(
    () => [...new Set((students || []).map((s) => s.batch).filter(Boolean))].sort(),
    [students],
  )
  const classOptions = useMemo(
    () => [...new Set((students || []).map((s) => s.section).filter(Boolean))].sort(),
    [students],
  )

  const studentColumns = [
    {
      key: 'name',
      header: 'Student Name',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <button
          className="text-navy hover:underline font-semibold text-left"
          onClick={() => onSelectStudent(row.id, v)}
        >
          {v}
        </button>
      ),
    },
    { key: 'registration_number', header: 'Reg Number', render: (v) => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'department', header: 'Department', sortable: true },
    { key: 'batch', header: 'Batch', sortable: true },
    { key: 'section', header: 'Class', sortable: true },
    { key: 'total_credits', header: 'Credit Points', sortable: true, align: 'right', render: (v) => <span className="font-bold text-green-700">{v || 0}</span> },
    {
      key: 'clubs',
      header: 'Club Memberships',
      render: (v) => {
        const clubs = Array.isArray(v) ? v : []
        if (!clubs.length) return <span className="text-xs text-gray-400">—</span>
        return (
          <div className="flex flex-wrap gap-1">
            {clubs.map((c) => (
              <span key={c} className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200">{c}</span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'office_bearer',
      header: 'Office Bearer',
      render: (v) => {
        if (!v) return <span className="text-xs text-gray-400">—</span>
        return (
          <span className="inline-flex rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 ring-1 ring-purple-200">
            {v}
          </span>
        )
      },
    },
    {
      key: '_actions',
      header: 'Actions',
      searchKey: false,
      align: 'center',
      render: (_, row) => (
        <button
          type="button"
          className="rounded bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
          onClick={(e) => {
            e.stopPropagation()
            onSelectStudent(row.id, row.name)
          }}
        >
          View Certificates
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Student Search & Certificates</h1>
        <p className="mt-1 text-sm text-gray-500">Filter students by department, batch, class, and credit range.</p>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            type="search"
            placeholder="Search name / reg no / email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
          />
          <select className="form-input" value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="">All Departments</option>
            {departmentOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="form-input" value={batch} onChange={(e) => setBatch(e.target.value)}>
            <option value="">All Batches</option>
            {batchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="form-input" value={className} onChange={(e) => setClassName(e.target.value)}>
            <option value="">All Classes</option>
            {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="text"
            className="form-input"
            value={creditRangeExpression}
            onChange={(e) => setCreditRangeExpression(e.target.value)}
            placeholder="Credits: <10, >=20, 10-20"
          />
        </div>
        {creditFilter.error && <p className="mt-2 text-xs text-red-600">{creditFilter.error}</p>}
      </div>

      <DataTable
        columns={studentColumns}
        data={filteredStudents}
        isLoading={loadingStudents}
        emptyMessage="No students found for selected filters."
        searchable
        searchPlaceholder="Search by name, email, reg no..."
      />
    </div>
  )
}

// ── Student Certificate Modal ────────────────────────────────────────────────
function StudentDetailModal({ studentId, studentName, onClose }) {
  const { data: certResp, isLoading: loadingCerts } = usePrincipalStudentCertificates(studentId)
  const certificates = certResp?.certificates || []
  const semesterTotals = certResp?.semester_totals || []
  const currentSemester = certResp?.current_semester
  const semesterOptions = [
    ...(currentSemester ? [currentSemester] : []),
    ...semesterTotals.map((item) => item?.semester || 'Unknown'),
  ].filter(Boolean)
  const uniqueSemesters = Array.from(new Set(semesterOptions))
  const [selectedSemester, setSelectedSemester] = useState(
    currentSemester || uniqueSemesters[0] || 'Unknown',
  )

  useEffect(() => {
    const next = currentSemester || uniqueSemesters[0]
    if (next) setSelectedSemester(next)
  }, [currentSemester, semesterTotals])

  const selectedRows = certificates.filter(
    (entry) => (entry.semester || 'Unknown') === selectedSemester,
  )
  const selectedTotal = semesterTotals.find(
    (item) => (item?.semester || 'Unknown') === selectedSemester,
  )?.total_credits ?? 0

  if (!studentId) return null

  const eventDetailColumns = [
    { key: 'event_name', header: 'Event', sortable: true, searchKey: true },
    { key: 'club_name', header: 'Club / Department', sortable: true, render: (_, row) => row?.issuer || row?.club_name || '—' },
    { key: 'cert_type', header: 'Role', render: (v) => <span className="capitalize">{(v || '').replace(/_/g, ' ')}</span> },
    { key: 'cert_number', header: 'Certificate Number', render: (v) => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'issued_at', header: 'Issued Date', render: (v) => fmtDate(v) },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} size="sm" /> },
    { key: 'credit_points', header: 'Points', align: 'right', render: (v) => <span className="font-bold text-green-700">{v || 0}</span> },
    {
      key: '_actions',
      header: 'View',
      align: 'center',
      render: (_, row) => {
        const url = row?.png_url || row?.certificate_image_url
        if (!url) return <span className="text-xs text-gray-400">—</span>
        const href = String(url).startsWith('http') ? url : `${String(url)}`
        return (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            onClick={(e) => e.stopPropagation()}
          >
            View
          </a>
        )
      },
    },
  ]

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Student Event Certificates</h2>
            <p className="text-xs text-gray-500">Verified credit points and certificates issued per semester.</p>
          </div>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>

        {loadingCerts ? (
          <LoadingSpinner label="Loading certificates..." />
        ) : (
          <>
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-sm mb-4">
              <span className="text-gray-500">Student Name:</span> <span className="font-semibold text-foreground">{studentName || '—'}</span>
            </div>
            <div className="card p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">Semester Totals</h3>
                <span className="text-xs text-gray-500">
                  {currentSemester ? `Current: ${currentSemester}` : 'Current: —'}
                </span>
              </div>
              <DataTable
                columns={[
                  {
                    key: 'semester',
                    header: 'Semester',
                    render: (v) => (
                      <span className="text-sm font-medium text-gray-700">
                        {v || 'Unknown'}{v === currentSemester ? ' (Current)' : ''}
                      </span>
                    ),
                  },
                  {
                    key: 'total_credits',
                    header: 'Total Credits',
                    align: 'right',
                    render: (v) => <span className="font-semibold text-navy">{v ?? 0}</span>,
                  },
                ]}
                data={semesterTotals}
                isLoading={false}
                emptyMessage="No semester totals yet."
                rowKey="semester"
              />
            </div>
            <div className="space-y-4">
              {uniqueSemesters.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                  No certificates found for this student.
                </div>
              ) : (
                <div className="card p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-gray-600">Semester</label>
                      <select
                        className="form-input h-9 py-1 text-sm"
                        value={selectedSemester}
                        onChange={(e) => setSelectedSemester(e.target.value)}
                      >
                        {uniqueSemesters.map((semester) => (
                          <option key={semester} value={semester}>
                            {semester}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="text-xs font-medium text-gray-500">Total: {selectedTotal}</span>
                  </div>
                  <DataTable
                    columns={eventDetailColumns}
                    data={selectedRows}
                    isLoading={false}
                    emptyMessage="No certificates found for this semester."
                    searchable
                    searchPlaceholder="Search events..."
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Principal Dashboard Page
// ═══════════════════════════════════════════════════════════════════════════════

export default function PrincipalDashboard() {
  const [searchParams] = useSearchParams()

  // Determine active tab from URL query params (tab or view)
  const tabParam = searchParams.get('tab') || searchParams.get('view') || 'dashboard'

  // Selected entities for modals
  const [selectedClubId, setSelectedClubId] = useState(null)
  const [selectedDepartmentName, setSelectedDepartmentName] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [selectedStudentName, setSelectedStudentName] = useState(null)

  const renderContent = () => {
    switch (tabParam) {
      case 'clubs':
        return <ClubsTab onSelectClub={(id) => setSelectedClubId(id)} />
      case 'departments':
        return <DepartmentsTab onSelectDept={(name) => setSelectedDepartmentName(name)} />
      case 'recent-events':
        return <RecentEventsTab />
      case 'student-search':
        return (
          <StudentSearchTab
            onSelectStudent={(id, name) => {
              setSelectedStudentId(id)
              setSelectedStudentName(name)
            }}
          />
        )
      case 'dashboard':
      default:
        return (
          <DashboardOverviewTab
            onSelectClub={(id) => setSelectedClubId(id)}
            onSelectDept={(name) => setSelectedDepartmentName(name)}
          />
        )
    }
  }

  return (
    <>
      <Navbar />
      <div className="flex items-start">
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-[calc(100dvh-3.5rem)] bg-background">
          <div className="page-container space-y-6">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Club Drilldown Modal */}
      {selectedClubId && (
        <ClubDetailModal
          clubId={selectedClubId}
          onClose={() => setSelectedClubId(null)}
        />
      )}

      {/* Department Drilldown Modal */}
      {selectedDepartmentName && (
        <DeptDetailModal
          departmentName={selectedDepartmentName}
          onClose={() => setSelectedDepartmentName(null)}
        />
      )}

      {/* Student Certificates Detail Modal */}
      {selectedStudentId && (
        <StudentDetailModal
          studentId={selectedStudentId}
          studentName={selectedStudentName}
          onClose={() => {
            setSelectedStudentId(null)
            setSelectedStudentName(null)
          }}
        />
      )}
    </>
  )
}
