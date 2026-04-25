import { useEffect, useMemo, useState } from 'react'

import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'

import { usePrincipalEventsOverview, usePrincipalStudents, usePrincipalStudentCertificates } from './api'

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

export default function PrincipalDashboard() {
  const [viewMode, setViewMode] = useState('dashboard')

  const [eventSearch, setEventSearch] = useState('')
  const [eventSourceType, setEventSourceType] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)

  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [batch, setBatch] = useState('')
  const [className, setClassName] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)

  const debouncedSearch = useDebounce(search)
  const debouncedEventSearch = useDebounce(eventSearch)

  const eventFilters = useMemo(() => {
    const f = {}
    if (eventSourceType) f.source_type = eventSourceType
    if (debouncedEventSearch) f.search = debouncedEventSearch
    return f
  }, [eventSourceType, debouncedEventSearch])

  const { data: eventsResp, isLoading: loadingEvents } = usePrincipalEventsOverview(eventFilters)
  const eventRows = eventsResp?.items || []

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

  const { data: certResp, isLoading: loadingCerts } = usePrincipalStudentCertificates(selectedStudent?.id)
  const certificates = certResp?.certificates || []

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
    { key: 'name', header: 'Student Name', sortable: true, render: (v) => <span className="font-semibold">{v}</span> },
    { key: 'registration_number', header: 'Reg Number', render: (v) => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'department', header: 'Department', sortable: true },
    { key: 'batch', header: 'Batch', sortable: true },
    { key: 'section', header: 'Class', sortable: true },
    { key: 'total_credits', header: 'Credit Points', sortable: true, align: 'right', render: (v) => <span className="font-bold text-green-700">{v || 0}</span> },
  ]

  const certificateColumns = [
    { key: 'source_type', header: 'Source', render: (v) => <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">{(v || '').replace('_', ' ')}</span> },
    { key: 'cert_number', header: 'Certificate No.', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'cert_type', header: 'Type' },
    { key: 'event_name', header: 'Event' },
    { key: 'issuer', header: 'Issuer' },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} size="sm" /> },
    { key: 'credit_points', header: 'Points', align: 'right', render: (v) => <span className="font-semibold text-green-700">{v || 0}</span> },
    { key: 'issued_at', header: 'Date', render: (v) => fmtDate(v) },
  ]

  const eventColumns = [
    {
      key: 'source_type',
      header: 'Source',
      render: (v) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${v === 'department' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
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
    <>
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-h-[calc(100dvh-3.5rem)] bg-background">
          <div className="page-container space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Principal Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">View event-level certificate analytics and search students.</p>
            </div>

            <div className="card p-4">
              <label className="form-label">View</label>
              <select className="form-input max-w-xs" value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
                <option value="dashboard">Dashboard</option>
                <option value="student-search">Student Search</option>
              </select>
            </div>

            {viewMode === 'dashboard' ? (
              <>
                <div className="card p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <input
                      type="search"
                      placeholder="Search event / club / department"
                      value={eventSearch}
                      onChange={(e) => setEventSearch(e.target.value)}
                      className="form-input"
                    />
                    <select className="form-input" value={eventSourceType} onChange={(e) => setEventSourceType(e.target.value)}>
                      <option value="">All Sources</option>
                      <option value="club">Club Events</option>
                      <option value="department">Department Events</option>
                    </select>
                    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      Total Events: <span className="font-semibold text-navy">{eventsResp?.count ?? 0}</span>
                    </div>
                  </div>
                </div>

                <DataTable
                  columns={eventColumns}
                  data={eventRows}
                  isLoading={loadingEvents}
                  emptyMessage="No events found for selected filters."
                  onRowClick={(row) => setSelectedEvent(row)}
                />

                {selectedEvent && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelectedEvent(null)}>
                    <div className="w-full max-w-6xl rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h2 className="text-lg font-semibold text-foreground">Participant Details</h2>
                          <p className="text-sm text-gray-500">{selectedEvent.event_name} · {selectedEvent.source_name}</p>
                        </div>
                        <button type="button" className="btn-secondary" onClick={() => setSelectedEvent(null)}>Close</button>
                      </div>
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
                )}
              </>
            ) : (
              <>
                <div className="card p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                  </div>
                </div>

                <DataTable
                  columns={studentColumns}
                  data={students}
                  isLoading={loadingStudents}
                  emptyMessage="No students found for selected filters."
                  onRowClick={(row) => setSelectedStudent(row)}
                />

                <div className="card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">Student Certificates</h2>
                    {selectedStudent && (
                      <span className="text-sm text-gray-500">
                        {selectedStudent.name} ({selectedStudent.registration_number || '—'})
                      </span>
                    )}
                  </div>

                  {!selectedStudent ? (
                    <p className="text-sm text-gray-500">Select a student from the list above to view certificates.</p>
                  ) : loadingCerts ? (
                    <div className="py-6"><LoadingSpinner /></div>
                  ) : (
                    <DataTable
                      columns={certificateColumns}
                      data={certificates}
                      isLoading={false}
                      emptyMessage="No certificates found for this student."
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
