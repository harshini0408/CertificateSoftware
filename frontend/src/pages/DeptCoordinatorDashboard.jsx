import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import StatCard from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'
import { useCoordinatorStats, useCoordinatorEvents, useStudentDetail, CREDIT_WEIGHTS } from '../api/credits'

// ── Icon helpers ──────────────────────────────────────────────────────────────
const Icons = {
  events: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  certs: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  email: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  clubs: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
}

// ── Event status filter tabs ───────────────────────────────────────────────────
const STATUS_TABS = [
  { id: 'all',       label: 'All' },
  { id: 'active',    label: 'Active' },
  { id: 'draft',     label: 'Draft' },
  { id: 'completed', label: 'Completed' },
]

const TABS = ['events', 'students']

// ── Students Tab ──────────────────────────────────────────────────────────────
function StudentsTab() {
  const [searchInput, setSearchInput] = useState('')
  const [queryVal, setQueryVal] = useState('')

  const { data, isLoading } = useStudentDetail(queryVal, true)

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchInput.trim()) {
      setQueryVal(searchInput.trim())
    }
  }

  const breakdown = useMemo(() => {
    if (!data?.credit_history) return []
    const counts = {}
    data.credit_history.forEach((e) => {
      if (!counts[e.cert_type]) counts[e.cert_type] = 0
      counts[e.cert_type] += e.points || 0
    })
    return Object.entries(counts).map(([cert_type, credits]) => ({ cert_type, credits }))
  }, [data])

  const PALETTE = ['#1E3A5F', '#C9A84C', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-foreground">Student Lookup</h2>
          <p className="text-sm text-gray-500">Search by email or registration number.</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="e.g. 21CS001 or alice@example.com"
            className="form-input min-w-[250px]"
          />
          <button type="submit" className="btn-primary shrink-0">Search</button>
        </form>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12"><LoadingSpinner label="Searching..." /></div>
      ) : data ? (
        <div className="space-y-6">
           {/* Student Profile Info */}
           <div className="card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
             <div>
               <h3 className="text-xl font-bold text-navy">{data.student_name}</h3>
               {data.department && <p className="text-sm text-gray-500">Dept: {data.department} | Batch: {data.batch}</p>}
               {data.registration_number && <p className="text-sm text-gray-500 font-mono mt-0.5">{data.registration_number}</p>}
             </div>
             <div className="text-left sm:text-right">
               <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Total Credits</p>
               <p className="text-3xl font-black text-gold">{data.total_credits}</p>
             </div>
           </div>

           {/* Credits Breakdown */}
           {breakdown.length > 0 && (
             <div className="card p-6 space-y-4">
               <h3 className="section-title text-base">Credit Breakdown</h3>
               <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                 {breakdown.map((item, i) => {
                   const pct = data.total_credits > 0 ? (item.credits / data.total_credits) * 100 : 0
                   return pct > 0 ? (
                     <div key={item.cert_type} style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }} title={`${item.cert_type}: ${item.credits}`} />
                   ) : null
                 })}
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                 {breakdown.map((item, i) => (
                   <div key={item.cert_type} className="flex items-center gap-2">
                     <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                     <span className="text-xs font-medium text-gray-600 capitalize truncate">{item.cert_type.replace(/_/g, ' ')}</span>
                     <span className="text-xs font-bold text-navy ml-auto">{item.credits}</span>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {/* Certificates History */}
           <div>
             <h3 className="section-title mb-3">Participation History</h3>
             <DataTable
               columns={[
                 { key: 'cert_number', header: 'Cert No.',
                   render: (v) => <span className="font-mono text-xs font-semibold text-navy">{v}</span> },
                 { key: 'event_name', header: 'Event' },
                 { key: 'club_name', header: 'Club',
                   render: (v) => <span className="text-xs text-gray-500">{v}</span> },
                 { key: 'cert_type', header: 'Type',
                   render: (v) => <StatusBadge status={v} size="sm" /> },
                 { key: 'issued_at', header: 'Issued On',
                   render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' }
               ]}
               data={data.credit_history ?? []}
               emptyMessage="No certificates found for this student."
             />
           </div>
        </div>
      ) : queryVal ? (
        <div className="card p-12 text-center">
          <p className="text-lg font-bold text-gray-600">Student Not Found</p>
          <p className="text-sm text-gray-400 mt-1">No student found matching "{queryVal}"</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-12 pt-24 text-gray-300">
           <svg className="w-16 h-16 mb-4 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
           <p className="text-lg font-medium text-gray-400">Search for a student to view details.</p>
        </div>
      )}
    </div>
  )
}

// ── Events Tab Component ──────────────────────────────────────────────────────
function EventsTab({ stats, events, statsLoading, eventsLoading, clubs }) {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('all')
  const [clubFilter, setClubFilter] = useState('all')

  const filteredEvents = (events ?? []).filter((e) => {
    const matchStatus = statusFilter === 'all' || e.status === statusFilter
    const matchClub   = clubFilter   === 'all' || e.club_id === clubFilter || e.club_name === clubFilter
    return matchStatus && matchClub
  })

  const columns = [
    { key: 'name', header: 'Event Name', sortable: true, searchKey: true,
      render: (v, row) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{v}</span>
          <span className="text-xs text-gray-400">{row.club_name}</span>
        </div>
      ) },
    { key: 'event_date', header: 'Date', sortable: true,
      render: (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'participant_count', header: 'Participants', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
    { key: 'cert_count', header: 'Certs', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
    { key: 'pending_emails', header: 'Pending Emails', align: 'right',
      render: (v) => v > 0 ? <span className="font-semibold text-amber-600">{v}</span> : <span className="text-gray-400">—</span> },
  ]

  return (
    <div className="space-y-6">
      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Events" value={stats?.total_events ?? events?.length ?? 0} icon={Icons.events} accent="navy" isLoading={statsLoading} />
        <StatCard label="Clubs in Scope" value={stats?.clubs_count ?? clubs.length} icon={Icons.clubs} accent="blue" isLoading={statsLoading} />
        <StatCard label="Certs Issued" value={stats?.certs_issued ?? 0} icon={Icons.certs} accent="gold" isLoading={statsLoading} />
        <StatCard label="Pending Emails" value={stats?.pending_emails ?? 0} icon={Icons.email} accent="red" isLoading={statsLoading} />
      </div>

      {/* ── Events section ──────────────────────────────────────── */}
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="section-title">Events</h2>
          <div className="flex flex-wrap gap-2 items-center">
            {clubs.length > 1 && (
              <select className="form-input py-1.5 text-sm w-auto" value={clubFilter} onChange={(e) => setClubFilter(e.target.value)}>
                <option value="all">All Clubs</option>
                {clubs.map((c) => <option key={c.id ?? c.name} value={c.id ?? c.name}>{c.name}</option>)}
              </select>
            )}
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${statusFilter === tab.id ? 'bg-white text-navy shadow-sm' : 'text-gray-500 hover:text-navy'}`}
                >
                  {tab.label}
                  {tab.id !== 'all' && <span className="ml-1 text-[10px] text-gray-400">{(events ?? []).filter((e) => e.status === tab.id).length}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredEvents}
          isLoading={eventsLoading}
          emptyMessage={statusFilter !== 'all' ? `No ${statusFilter} events found.` : 'No events in your scope yet.'}
          searchable searchPlaceholder="Search events or clubs…"
          onRowClick={(row) => navigate(`/club/${row.club_id}/events/${row._id ?? row.id}`)}
          rowKey="_id"
        />
      </div>

      {/* Quick Insights strip */}
      {!eventsLoading && filteredEvents.length > 0 && (() => {
        const active    = filteredEvents.filter((e) => e.status === 'active').length
        const completed = filteredEvents.filter((e) => e.status === 'completed').length
        const withPending = filteredEvents.filter((e) => (e.pending_emails ?? 0) > 0).length

        return (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: 'Active Events', value: active, sub: 'currently running', color: 'border-l-green-400', fg: 'text-green-600' },
              { label: 'Completed', value: completed, sub: 'events concluded', color: 'border-l-navy', fg: 'text-navy' },
              { label: 'Needs Attention', value: withPending, sub: 'events with pending emails', color: 'border-l-amber-400', fg: 'text-amber-600' },
            ].map((item) => (
              <div key={item.label} className={`card border-l-4 ${item.color} px-5 py-4`}>
                <p className={`text-2xl font-black ${item.fg}`}>{item.value}</p>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-gray-400">{item.sub}</p>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

// ── DeptCoordinatorDashboard ──────────────────────────────────────────────────
export default function DeptCoordinatorDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = TABS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'events'

  const { data: stats,  isLoading: statsLoading  } = useCoordinatorStats()
  const { data: events, isLoading: eventsLoading } = useCoordinatorEvents()

  // Derive unique club list for filter
  const clubs = Array.from(
    new Map(
      (events ?? []).map((e) => [e.club_id ?? e.club_name, { id: e.club_id, name: e.club_name }]),
    ).values(),
  )


  // Apply filters
  const filteredEvents = (events ?? []).filter((e) => {
    const matchStatus = statusFilter === 'all' || e.status === statusFilter
    const matchClub   = clubFilter   === 'all' || e.club_id === clubFilter || e.club_name === clubFilter
    return matchStatus && matchClub
  })

  const columns = [
    {
      key: 'name',
      header: 'Event Name',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{v}</span>
          <span className="text-xs text-gray-400">{row.club_name}</span>
        </div>
      ),
    },
    {
      key: 'event_date',
      header: 'Date',
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
      key: 'participant_count',
      header: 'Participants',
      align: 'right',
      render: (v) => (v ?? 0).toLocaleString(),
    },
    {
      key: 'cert_count',
      header: 'Certs',
      align: 'right',
      render: (v) => (v ?? 0).toLocaleString(),
    },
    {
      key: 'pending_emails',
      header: 'Pending Emails',
      align: 'right',
      render: (v) =>
        v > 0 ? (
          <span className="font-semibold text-amber-600">{v}</span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
  ]

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container space-y-6">

            {/* ── Page header ────────────────────────────────────────── */}
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Department Coordinator
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Manage and track events and achievements across the department.
              </p>
            </div>

            {/* ── Tab Bar ────────────────────────────────────────────── */}
            <div className="flex gap-1 border-b border-gray-200">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSearchParams({ tab })}
                  className={`
                    relative px-4 py-2.5 text-sm font-medium capitalize transition-colors
                    ${activeTab === tab
                      ? 'text-navy after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-navy after:rounded-t-full'
                      : 'text-gray-500 hover:text-navy'
                    }
                  `}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* ── Tab Content ────────────────────────────────────────── */}
            {activeTab === 'events' ? (
              <EventsTab stats={stats} events={events} statsLoading={statsLoading} eventsLoading={eventsLoading} clubs={clubs} />
            ) : (
               <StudentsTab />
            )}

          </div>
        </main>
      </div>
    </div>
  )
}
