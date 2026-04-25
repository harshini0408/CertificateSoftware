import { useEffect, useMemo, useState } from 'react'

import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'

import { usePrincipalStudents, usePrincipalStudentCertificates } from './api'

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
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [batch, setBatch] = useState('')
  const [className, setClassName] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)

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

  return (
    <>
      <Navbar />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-h-[calc(100dvh-3.5rem)] bg-background">
          <div className="page-container space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Principal Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">View all students, their credit points, and certificate history.</p>
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
          </div>
        </main>
      </div>
    </>
  )
}
