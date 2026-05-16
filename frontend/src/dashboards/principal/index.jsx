import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'

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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Student Event Certificates</h2>
            <p className="text-xs text-gray-500">Use View to open each certificate file for verification.</p>
          </div>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>

        {loadingCerts ? (
          <LoadingSpinner label="Loading certificates..." />
        ) : (
          <>
            <div className="rounded-lg border border-gray-200 p-3 text-sm mb-4">
              <span className="text-gray-500">Student Name:</span> <span className="font-semibold">{studentName || '—'}</span>
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
                    <span className="text-xs text-gray-500">Total: {selectedTotal}</span>
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

export default function PrincipalDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialView = searchParams.get('view') === 'student-search' ? 'student-search' : 'dashboard'
  const [viewMode, setViewMode] = useState(initialView)

  const [eventSearch, setEventSearch] = useState('')
  const [eventSourceType, setEventSourceType] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)

  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [batch, setBatch] = useState('')
  const [className, setClassName] = useState('')
  const [creditRangeExpression, setCreditRangeExpression] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [selectedStudentName, setSelectedStudentName] = useState(null)

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
    { key: 'name', header: 'Student Name', sortable: true, searchKey: true, render: (v, row) => (
      <button className="text-navy hover:underline font-semibold" onClick={() => {
        setSelectedStudentId(row.id)
        setSelectedStudentName(v)
      }}>
        {v}
      </button>
    ) },
    { key: 'registration_number', header: 'Reg Number', render: (v) => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'department', header: 'Department', sortable: true },
    { key: 'batch', header: 'Batch', sortable: true },
    { key: 'section', header: 'Class', sortable: true },
    { key: 'total_credits', header: 'Credit Points', sortable: true, align: 'right', render: (v) => <span className="font-bold text-green-700">{v || 0}</span> },
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
            setSelectedStudentId(row.id)
            setSelectedStudentName(row.name)
          }}
        >
          View Certificates
        </button>
      ),
    },
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

  useEffect(() => {
    const viewFromQuery = searchParams.get('view') === 'student-search' ? 'student-search' : 'dashboard'
    setViewMode((prev) => (prev === viewFromQuery ? prev : viewFromQuery))
  }, [searchParams])

  const handleViewModeChange = (nextView) => {
    setViewMode(nextView)
    const nextParams = new URLSearchParams(searchParams)
    if (nextView === 'student-search') nextParams.set('view', 'student-search')
    else nextParams.delete('view')
    setSearchParams(nextParams, { replace: true })
  }

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
              <select className="form-input max-w-xs" value={viewMode} onChange={(e) => handleViewModeChange(e.target.value)}>
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
              </>
            )}
          </div>
        </main>
      </div>

      <StudentDetailModal 
        studentId={selectedStudentId} 
        studentName={selectedStudentName}
        onClose={() => {
          setSelectedStudentId(null)
          setSelectedStudentName(null)
        }} 
      />
    </> 
  )
}
