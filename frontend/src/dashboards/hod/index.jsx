import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { BACKEND_URL } from '../../utils/axiosInstance'

import { useHodProfile, useHodStudents, useHodStudentCertificates } from './api'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StudentDetailModal({ studentId, studentName, onClose }) {
  const { data: certResp, isLoading: loadingCerts } = useHodStudentCertificates(studentId)
  const certificates = (certResp?.certificates || []).map((cert) => ({
    ...cert,
    issuer: cert.issuer || cert.club_name,
  }))
  const semesterTotals = certResp?.semester_totals || []
  const currentSemester = certResp?.current_semester
  const certsBySemester = semesterTotals.reduce((acc, item) => {
    const label = item?.semester || 'Unknown'
    acc[label] = certificates.filter((entry) => (entry.semester || 'Unknown') === label)
    return acc
  }, {})

  if (!studentId) return null

  const eventDetailColumns = [
    { key: 'event_name', header: 'Event', sortable: true, searchKey: true },
    { key: 'issuer', header: 'Club / Department', sortable: true },
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
        const url = row?.certificate_image_url
        if (!url) return <span className="text-xs text-gray-400">—</span>
        const href = String(url).startsWith('http') ? url : `${BACKEND_URL}${url}`
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
              {semesterTotals.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                  No certificates found for this student.
                </div>
              ) : (
                semesterTotals.map((item) => {
                  const semester = item?.semester || 'Unknown'
                  const rows = certsBySemester[semester] || []
                  return (
                    <div key={semester} className="card p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-foreground">
                          {semester}{semester === currentSemester ? ' (Current)' : ''}
                        </h4>
                        <span className="text-xs text-gray-500">Total: {item?.total_credits ?? 0}</span>
                      </div>
                      <DataTable
                        columns={eventDetailColumns}
                        data={rows}
                        isLoading={false}
                        emptyMessage="No certificates found for this semester."
                        searchable
                        searchPlaceholder="Search events..."
                      />
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

export default function HodDashboard() {
  const { data: profile } = useHodProfile()

  const assignedDepartments = useMemo(() => {
    const multi = Array.isArray(profile?.departments)
      ? profile.departments.map((d) => (d || '').trim()).filter(Boolean)
      : []
    if (multi.length > 0) return multi
    const single = (profile?.department || '').trim()
    return single ? [single] : []
  }, [profile])

  const [search, setSearch] = useState('')
  const [batch, setBatch] = useState('')
  const [section, setSection] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [selectedStudentName, setSelectedStudentName] = useState(null)

  const filters = useMemo(() => {
    const f = {}
    if (search.trim()) f.search = search.trim()
    if (batch) f.batch = batch
    if (section) f.section = section
    return f
  }, [search, batch, section])

  const { data: studentsResp, isLoading: loadingStudents } = useHodStudents(filters)
  const students = studentsResp?.items || []

  const { data: certResp, isLoading: loadingCerts } = useHodStudentCertificates(selectedStudentId)
  const certificates = certResp?.certificates || []

  const batchOptions = useMemo(
    () => [...new Set((students || []).map((s) => s.batch).filter(Boolean))].sort(),
    [students],
  )
  const sectionOptions = useMemo(
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
        <button className="text-navy hover:underline font-semibold" onClick={() => {
          setSelectedStudentId(row.id)
          setSelectedStudentName(v)
        }}>
          {v}
        </button>
      ),
    },
    {
      key: 'registration_number',
      header: 'Reg Number',
      sortable: true,
      searchKey: true,
      render: (v) => <span className="font-mono text-xs">{v || '—'}</span>,
    },
    { key: 'department', header: 'Department', sortable: true },
    { key: 'batch', header: 'Batch', sortable: true },
    { key: 'section', header: 'Section', sortable: true },
    {
      key: 'total_credits',
      header: 'Credit Points',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-semibold text-green-700">{v || 0}</span>,
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
            setSelectedStudentId(row.id)
            setSelectedStudentName(row.name)
          }}
        >
          View Certificates
        </button>
      ),
    },
  ]

  return (
    <>
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-h-[calc(100dvh-3.5rem)] bg-background">
          <div className="page-container space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-foreground">HOD Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                {assignedDepartments.length > 1 ? 'Departments' : 'Department'}: {assignedDepartments.length ? assignedDepartments.join(', ') : '—'}
                {profile?.batch ? ` · Batch ${profile.batch}` : ''}
                {profile?.section ? ` · Section ${profile.section}` : ''}
              </p>
            </div>

            <div className="card p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  type="search"
                  placeholder="Search name / reg no / email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input"
                />
                <select className="form-input" value={batch} onChange={(e) => setBatch(e.target.value)}>
                  <option value="">All Batches</option>
                  {batchOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <select className="form-input" value={section} onChange={(e) => setSection(e.target.value)}>
                  <option value="">All Sections</option>
                  {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  Total Students: <span className="font-semibold text-navy">{studentsResp?.count ?? 0}</span>
                </div>
              </div>
            </div>

            <DataTable
              columns={studentColumns}
              data={students}
              isLoading={loadingStudents}
              emptyMessage="No students found for selected filters."
              searchable
              searchPlaceholder="Search by name, email, reg no..."
            />
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
