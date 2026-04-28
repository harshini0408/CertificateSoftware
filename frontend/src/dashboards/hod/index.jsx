import { useMemo, useState } from 'react'

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
  const [selectedStudent, setSelectedStudent] = useState(null)

  const filters = useMemo(() => {
    const f = {}
    if (search.trim()) f.search = search.trim()
    if (batch) f.batch = batch
    if (section) f.section = section
    return f
  }, [search, batch, section])

  const { data: studentsResp, isLoading: loadingStudents } = useHodStudents(filters)
  const students = studentsResp?.items || []

  const { data: certResp, isLoading: loadingCerts } = useHodStudentCertificates(selectedStudent?.id)
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
      render: (v) => <span className="font-semibold">{v || '—'}</span>,
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
  ]

  const certificateColumns = [
    {
      key: 'source_type',
      header: 'Source',
      render: (v) => (
        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
          {(v || '').replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'cert_number',
      header: 'Certificate No.',
      render: (v) => <span className="font-mono text-xs">{v || '—'}</span>,
    },
    { key: 'cert_type', header: 'Type' },
    { key: 'event_name', header: 'Event' },
    { key: 'issuer', header: 'Issuer' },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} size="sm" /> },
    {
      key: 'credit_points',
      header: 'Points',
      align: 'right',
      render: (v) => <span className="font-semibold text-green-700">{v || 0}</span>,
    },
    { key: 'issued_at', header: 'Date', render: (v) => fmtDate(v) },
    {
      key: '_actions',
      header: 'Actions',
      align: 'center',
      searchKey: false,
      render: (_, row) => {
        const raw = row?.certificate_image_url
        if (!raw) return <span className="text-xs text-gray-400">—</span>
        const href = String(raw).startsWith('http') ? raw : `${BACKEND_URL}${raw}`
        return (
          <div className="inline-flex items-center gap-2">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              onClick={(e) => e.stopPropagation()}
            >
              View
            </a>
            <a
              href={href}
              download={`${row?.cert_number || 'certificate'}.png`}
              className="inline-flex items-center rounded-md border border-navy/30 px-2 py-1 text-xs font-medium text-navy hover:bg-navy hover:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              Download
            </a>
          </div>
        )
      },
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
          </div>
        </main>
      </div>
    </>
  )
}
