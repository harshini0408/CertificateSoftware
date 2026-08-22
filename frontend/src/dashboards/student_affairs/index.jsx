import { useState } from 'react'
import { createPortal } from 'react-dom'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import StatCard from '../../components/StatCard'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { BACKEND_URL } from '../../utils/axiosInstance'
import {
  useAffairsStats,
  useAffairsClubEvents,
  useAffairsClubEventDetail,
  useAffairsDeptEvents,
  useAffairsDeptEventDetail,
  useAffairsDepartments,
  useAffairsRankings,
  useAffairsUpcomingEvents,
  useReviewReport,
} from './api'

// ── Tab ids ───────────────────────────────────────────────────────────────────
const TABS = ['overview', 'club_events', 'dept_events', 'upcoming']

const TAB_LABELS = {
  overview: 'Overview',
  club_events: 'Club Events',
  dept_events: 'Dept Events',
  upcoming: 'Upcoming Events',
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icons = {
  events: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  users: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  star: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
  upcoming: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  report: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// Overview Tab
// ═══════════════════════════════════════════════════════════════════════════════

function OverviewTab() {
  const { data: stats, isLoading: statsLoading } = useAffairsStats()
  const [rankLimit, setRankLimit] = useState(3)
  const { data: rankings, isLoading: rankingsLoading } = useAffairsRankings(rankLimit)

  if (statsLoading) return <LoadingSpinner fullPage label="Loading statistics…" />

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Student Affairs Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Events Conducted" value={stats?.total_events ?? 0} icon={Icons.events} accent="navy" />
        <StatCard label="Students Participated" value={stats?.total_participants ?? 0} icon={Icons.users} accent="blue" />
        <StatCard label="Activity Points Awarded" value={stats?.total_activity_points ?? 0} icon={Icons.star} accent="gold" />
        <StatCard label="Upcoming Events" value={stats?.upcoming_events ?? 0} icon={Icons.upcoming} accent="green" />
      </div>

      {/* Pending Reports */}
      {(stats?.pending_reports ?? 0) > 0 && (
        <div className="card p-4 border-l-4 border-amber-400 bg-amber-50">
          <div className="flex items-center gap-2">
            {Icons.report}
            <p className="text-sm font-semibold text-amber-800">
              {stats.pending_reports} event report{stats.pending_reports > 1 ? 's' : ''} pending review
            </p>
          </div>
        </div>
      )}

      {/* Rankings */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Most Active Clubs */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Most Active Clubs</h2>
            <div className="flex gap-1">
              {[3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setRankLimit(n)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${rankLimit === n ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Top {n}
                </button>
              ))}
            </div>
          </div>
          {rankingsLoading ? (
            <div className="flex justify-center py-4"><div className="h-6 w-6 animate-spin rounded-full border-2 border-navy border-t-transparent" /></div>
          ) : (rankings?.top_clubs || []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No club data yet</p>
          ) : (
            <div className="space-y-3">
              {(rankings?.top_clubs || []).map((club, i) => (
                <div key={club.club_id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-200 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{club.club_name}</p>
                    <p className="text-xs text-gray-500">{club.event_count} events • {club.total_participants} participants</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Most Active Departments */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Most Active Departments</h2>
          </div>
          {rankingsLoading ? (
            <div className="flex justify-center py-4"><div className="h-6 w-6 animate-spin rounded-full border-2 border-navy border-t-transparent" /></div>
          ) : (rankings?.top_departments || []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No department data yet</p>
          ) : (
            <div className="space-y-3">
              {(rankings?.top_departments || []).map((dept, i) => (
                <div key={dept.department} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-200 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{dept.department}</p>
                    <p className="text-xs text-gray-500">{dept.event_count} events • {dept.total_participants} participants</p>
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
// Club Events Tab
// ═══════════════════════════════════════════════════════════════════════════════

function ClubEventsTab() {
  const [filters, setFilters] = useState({})
  const [selectedEventId, setSelectedEventId] = useState(null)
  const { data: events, isLoading } = useAffairsClubEvents(filters)

  const columns = [
    { key: 'name', header: 'Event', sortable: true, searchKey: true,
      render: (v, row) => (
        <button className="text-sm font-semibold text-navy hover:underline text-left" onClick={() => setSelectedEventId(row.id)}>
          {v}
        </button>
      ),
    },
    { key: 'club_name', header: 'Club', sortable: true },
    { key: 'category', header: 'Category', render: (v) => v || '—' },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'venue', header: 'Venue', render: (v) => v || '—' },
    { key: 'participant_count', header: 'Participants', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
    { key: 'report_status', header: 'Report', render: (v) => <ReportStatusBadge status={v} /> },
  ]

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">Club Events</h2>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="form-label">Start Date</label>
            <input type="date" className="form-input" onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value || undefined }))} />
          </div>
          <div>
            <label className="form-label">End Date</label>
            <input type="date" className="form-input" onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value || undefined }))} />
          </div>
          <div>
            <label className="form-label">Category</label>
            <select className="form-input" onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value || undefined }))}>
              <option value="">All Categories</option>
              {['Workshop', 'Technical Talk', 'Hackathon', 'Cultural', 'Seminar', 'Competition'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Report Status</label>
            <select className="form-input" onChange={(e) => setFilters((f) => ({ ...f, report_status: e.target.value || undefined }))}>
              <option value="">All</option>
              <option value="not_submitted">Not Submitted</option>
              <option value="pending_review">Pending Review</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={events || []}
        isLoading={isLoading}
        emptyMessage="No club events found."
        rowKey="id"
        searchable
        searchPlaceholder="Search events…"
      />

      {/* Event Detail Modal */}
      {selectedEventId && (
        <EventDetailModal eventId={selectedEventId} onClose={() => setSelectedEventId(null)} />
      )}
    </div>
  )
}

// ── Event Detail Modal ────────────────────────────────────────────────────────

function EventDetailModal({ eventId, onClose }) {
  const { data: event, isLoading } = useAffairsClubEventDetail(eventId)
  const reviewMutation = useReviewReport(eventId)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const handleAccept = () => {
    reviewMutation.mutate({ action: 'accept' }, { onSuccess: () => {} })
  }

  const handleReject = () => {
    reviewMutation.mutate({ action: 'reject', rejection_reason: rejectReason }, {
      onSuccess: () => { setShowRejectModal(false); setRejectReason('') },
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" aria-hidden="true" />
      <div
        className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-bold text-navy truncate">{event?.name || 'Event Details'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="Close">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <LoadingSpinner fullPage label="Loading event details…" />
          ) : !event ? (
            <p className="text-gray-400 text-center">Event not found.</p>
          ) : (
            <>
              {/* Event Info */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  ['Club', event.club_name],
                  ['Date', fmtDate(event.event_date)],
                  ['Time', event.event_time || '—'],
                  ['Venue', event.venue || '—'],
                  ['Category', event.category || '—'],
                  ['Status', event.status],
                  ['Academic Year', event.academic_year || '—'],
                  ['Participants', event.participant_count],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </div>

              {event.description && (
                <div>
                  <h4 className="text-xs font-medium text-gray-400 uppercase mb-1">Description</h4>
                  <p className="text-sm text-gray-700">{event.description}</p>
                </div>
              )}

              {/* Report Section */}
              <div className="card p-4 space-y-3 border border-gray-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground">Event Report</h4>
                  <ReportStatusBadge status={event.report_status} />
                </div>

                {event.report_url && (
                  <div className="flex items-center gap-3">
                    <a
                      href={`${BACKEND_URL}${event.report_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-xs"
                    >
                      📄 Download Report {event.report_filename && `(${event.report_filename})`}
                    </a>
                  </div>
                )}

                {event.report_status === 'rejected' && event.report_rejection_reason && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-xs font-medium text-red-700">Rejection Reason:</p>
                    <p className="text-sm text-red-600 mt-0.5">{event.report_rejection_reason}</p>
                  </div>
                )}

                {event.report_status === 'pending_review' && (
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleAccept}
                      disabled={reviewMutation.isPending}
                      className="btn-primary text-xs"
                    >
                      ✓ Accept Report
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={reviewMutation.isPending}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                    >
                      ✕ Reject Report
                    </button>
                  </div>
                )}
              </div>

              {/* Reject Reason Sub-Modal */}
              {showRejectModal && createPortal(
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/30" onClick={() => setShowRejectModal(false)} />
                  <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                    <h4 className="text-base font-bold text-red-600">Reject Report</h4>
                    <textarea
                      className="form-input w-full"
                      rows={3}
                      placeholder="Reason for rejection…"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowRejectModal(false)} className="btn-secondary text-xs">Cancel</button>
                      <button onClick={handleReject} disabled={reviewMutation.isPending} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600">
                        {reviewMutation.isPending ? 'Rejecting…' : 'Confirm Reject'}
                      </button>
                    </div>
                  </div>
                </div>,
                document.body,
              )}

              {/* Participants Table */}
              {event.participants && event.participants.length > 0 && (
                <div>
                  <h4 className="section-title mb-2">Participants ({event.participants.length})</h4>
                  <DataTable
                    columns={[
                      { key: 'name', header: 'Name', sortable: true, searchKey: true },
                      { key: 'email', header: 'Email' },
                      { key: 'registration_number', header: 'Reg No.', render: (v) => v || '—' },
                      { key: 'cert_type', header: 'Role', render: (v) => <span className="capitalize">{(v || '').replace(/_/g, ' ')}</span> },
                      { key: 'certificate_status', header: 'Certificate', render: (v) => v ? <StatusBadge status={v} /> : <span className="text-xs text-gray-400">—</span> },
                    ]}
                    data={event.participants}
                    isLoading={false}
                    emptyMessage="No participants."
                    rowKey="id"
                    searchable
                    searchPlaceholder="Search participants…"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// Dept Events Tab
// ═══════════════════════════════════════════════════════════════════════════════

function DeptEventsTab() {
  const [filters, setFilters] = useState({})
  const [selectedDeptEventId, setSelectedDeptEventId] = useState(null)
  const { data: events, isLoading } = useAffairsDeptEvents(filters)
  const { data: departmentsList, isLoading: deptsLoading } = useAffairsDepartments()

  const columns = [
    {
      key: 'name',
      header: 'Event',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <button
          className="text-sm font-semibold text-navy hover:underline text-left"
          onClick={() => setSelectedDeptEventId(row.id)}
        >
          {v}
        </button>
      ),
    },
    { key: 'department', header: 'Department', sortable: true },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'semester', header: 'Semester' },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'participant_count', header: 'Participants', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
    { key: 'cert_count', header: 'Certs', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
  ]

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">Department Events</h2>

      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="form-label">Department</label>
            <select
              className="form-input"
              value={filters.department || ''}
              onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value || undefined }))}
              disabled={deptsLoading}
            >
              <option value="">All Departments</option>
              {(departmentsList || []).map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Start Date</label>
            <input type="date" className="form-input" onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value || undefined }))} />
          </div>
          <div>
            <label className="form-label">End Date</label>
            <input type="date" className="form-input" onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value || undefined }))} />
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={events || []}
        isLoading={isLoading}
        emptyMessage="No department events found."
        rowKey="id"
        searchable
        searchPlaceholder="Search department events…"
      />

      {/* Dept Event Detail Modal */}
      {selectedDeptEventId && (
        <DeptEventDetailModal eventId={selectedDeptEventId} onClose={() => setSelectedDeptEventId(null)} />
      )}
    </div>
  )
}

// ── Dept Event Detail Modal ───────────────────────────────────────────────────

function DeptEventDetailModal({ eventId, onClose }) {
  const { data: event, isLoading } = useAffairsDeptEventDetail(eventId)

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" aria-hidden="true" />
      <div
        className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-bold text-navy truncate">{event?.name || 'Department Event Details'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="Close">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <LoadingSpinner fullPage label="Loading event details…" />
          ) : !event ? (
            <p className="text-gray-400 text-center">Event not found.</p>
          ) : (
            <>
              {/* Event Info */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  ['Department', event.department],
                  ['Date', fmtDate(event.event_date)],
                  ['Semester', event.semester || '—'],
                  ['Status', event.status],
                  ['Total Participants', event.participant_count],
                  ['Certificates Issued', event.cert_count],
                  ['Excel File', event.excel_file_name || '—'],
                  ['Points Per Cert', event.allocate_points ? `${event.points_per_cert} pts` : 'None'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</dt>
                    <dd className="mt-0.5 text-sm font-semibold text-foreground">{value}</dd>
                  </div>
                ))}
              </div>

              {/* Students List */}
              <div>
                <h4 className="section-title mb-2">
                  Students / Participants ({event.students?.length || 0})
                </h4>
                <DataTable
                  columns={[
                    { key: 'name', header: 'Name', sortable: true, searchKey: true },
                    { key: 'registration_number', header: 'Reg No.', render: (v) => v || '—' },
                    { key: 'class_name', header: 'Class / Sec', render: (v) => v || '—' },
                    { key: 'email', header: 'Email' },
                    { key: 'role', header: 'Role / Contribution', render: (v) => <span className="capitalize">{v || 'Participant'}</span> },
                    {
                      key: 'certificate_status',
                      header: 'Certificate',
                      render: (v, row) => (
                        <div className="flex flex-col">
                          <span className={`text-xs font-semibold ${v === 'Issued' ? 'text-green-700' : 'text-gray-600'}`}>
                            {v}
                          </span>
                          {row.certificate_number && (
                            <span className="font-mono text-[10px] text-gray-400">{row.certificate_number}</span>
                          )}
                        </div>
                      ),
                    },
                  ]}
                  data={event.students || []}
                  isLoading={false}
                  emptyMessage="No students found in this event's uploaded excel."
                  rowKey="id"
                  searchable
                  searchPlaceholder="Search students…"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Upcoming Events Tab
// ═══════════════════════════════════════════════════════════════════════════════

function UpcomingEventsTab() {
  const [filters, setFilters] = useState({})
  const { data: events, isLoading } = useAffairsUpcomingEvents(filters)

  if (isLoading) return <LoadingSpinner fullPage label="Loading upcoming events…" />

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">Upcoming Events — Next Week</h2>

      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="form-label">Category</label>
            <select className="form-input" onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value || undefined }))}>
              <option value="">All Categories</option>
              {['Workshop', 'Technical Talk', 'Hackathon', 'Cultural', 'Seminar', 'Competition'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {(events || []).length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-gray-400 text-sm">No upcoming events for the next week.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(events || []).map((event) => (
            <div key={event.id} className="card overflow-hidden hover:shadow-lg transition-shadow">
              {/* Poster */}
              {event.poster_url && (
                <div className="aspect-[16/9] bg-gray-100">
                  <img
                    src={event.poster_url.startsWith('/') ? `${BACKEND_URL}${event.poster_url}` : event.poster_url}
                    alt={event.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {!event.poster_url && (
                <div className="aspect-[16/9] bg-gradient-to-br from-navy/10 to-navy/5 flex items-center justify-center">
                  <span className="text-4xl opacity-30">📅</span>
                </div>
              )}
              <div className="p-4 space-y-2">
                <h3 className="text-base font-bold text-foreground line-clamp-2">{event.name}</h3>
                <p className="text-xs font-medium text-navy">{event.club_name}</p>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  <span>📅 {fmtDate(event.event_date)}</span>
                  {event.event_time && <span>🕐 {event.event_time}</span>}
                  {event.venue && <span>📍 {event.venue}</span>}
                </div>
                {event.category && (
                  <span className="inline-flex rounded-full bg-navy/10 px-2 py-0.5 text-xs font-medium text-navy">{event.category}</span>
                )}
                {event.description && (
                  <p className="text-xs text-gray-500 line-clamp-2">{event.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// Main Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

export default function StudentAffairsDashboard() {
  const [activeTab, setActiveTab] = useState('overview')

  const renderTab = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab />
      case 'club_events': return <ClubEventsTab />
      case 'dept_events': return <DeptEventsTab />
      case 'upcoming': return <UpcomingEventsTab />
      default: return <OverviewTab />
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container space-y-6">
            {/* Tab navigation */}
            <div className="flex gap-1 border-b border-gray-200 overflow-x-auto pb-px">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === tab
                      ? 'border-navy text-navy'
                      : 'border-transparent text-gray-500 hover:text-navy hover:border-gray-300'
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {renderTab()}
          </div>
        </main>
      </div>
    </div>
  )
}
