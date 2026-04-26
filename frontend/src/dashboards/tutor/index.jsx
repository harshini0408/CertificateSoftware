import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatCard from '../../components/StatCard'
import StatusBadge from '../../components/StatusBadge'
import { useToastStore } from '../../store/uiStore'

import {
  useTutorCreditPointVerifications,
  useTutorCreditRules,
  useTutorManualCertificate,
  useTutorProfile,
  useTutorRejectCreditPoint,
  useTutorStudentDetail,
  useTutorStudents,
  useTutorVerifyCreditPoint,
  downloadTutorAllAssignedCertificates,
  downloadTutorStudentCertificates,
} from './api'

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

const CREDIT_TARGET = 20

function renderCreditAgainstTarget(points) {
  const obtained = Number(points || 0)
  const tone = obtained >= CREDIT_TARGET ? 'text-green-700' : 'text-red-600'
  return (
    <span className="font-bold">
      <span className={tone}>{obtained}</span>
      <span className="text-green-700">/{CREDIT_TARGET}</span>
    </span>
  )
}

function DetailModal({ email, onClose }) {
  const { data, isLoading } = useTutorStudentDetail(email, !!email)

  if (!email) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Student Event Details</h2>
            <p className="text-xs text-gray-500">Certificate files are intentionally hidden for tutor view.</p>
          </div>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>

        {isLoading ? (
          <LoadingSpinner label="Loading student details..." />
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 p-3 text-sm">
              <div><span className="text-gray-500">Name:</span> <span className="font-semibold">{data?.student_name || '—'}</span></div>
              <div><span className="text-gray-500">Reg No:</span> <span className="font-semibold">{data?.registration_number || '—'}</span></div>
              <div><span className="text-gray-500">Email:</span> <span className="font-semibold">{data?.student_email || '—'}</span></div>
              <div><span className="text-gray-500">Total Credits:</span> {renderCreditAgainstTarget(data?.total_credits)}</div>
            </div>

            <DataTable
              columns={[
                { key: 'event_name', header: 'Event', sortable: true, searchKey: true },
                { key: 'role', header: 'Role', render: (v) => <span className="capitalize">{(v || '').replace(/_/g, ' ')}</span> },
                { key: 'certificate_number', header: 'Certificate Number', render: (v) => <span className="font-mono text-xs">{v || '—'}</span> },
                { key: 'event_date', header: 'Event Date', render: (v, row) => fmtDate(v || row?.awarded_at) },
                { key: 'credit_points', header: 'Credit Points', align: 'right', render: (v) => <span className="font-bold text-green-700">+{v || 0}</span> },
              ]}
              data={data?.event_details || []}
              isLoading={false}
              emptyMessage="No event records found."
              searchable
              searchPlaceholder="Search events..."
            />
          </div>
        )}
      </div>
    </div>
  )
}

function VerificationTab() {
  const { data, isLoading } = useTutorCreditPointVerifications()
  const verifyMutation = useTutorVerifyCreditPoint()
  const rejectMutation = useTutorRejectCreditPoint()

  return (
    <div>
      <h2 className="section-title mb-3">Credit Point Verification</h2>
      <DataTable
        columns={[
          { key: 'student_name', header: 'Student', searchKey: true, render: (v, row) => `${v || '—'} (${row.registration_number || '—'})` },
          { key: 'student_email', header: 'Email', searchKey: true },
          { key: 'cert_type', header: 'Role', render: (v) => <span className="capitalize">{(v || '').replace(/_/g, ' ')}</span> },
          { key: 'event_date', header: 'Event Date', render: (v) => fmtDate(v) },
          {
            key: 'certificate_image_url',
            header: 'Certificate',
            render: (v) => (v ? <a href={v} target="_blank" rel="noreferrer" className="text-navy hover:underline">View</a> : '—'),
          },
          { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
          { key: 'submitted_at', header: 'Submitted', render: (v) => fmtDate(v) },
          {
            key: 'id',
            header: 'Actions',
            align: 'center',
            searchKey: false,
            render: (id, row) => {
              if (row.status !== 'pending') {
                return <span className="text-xs text-gray-500">Reviewed</span>
              }
              return (
                <div className="flex items-center justify-center gap-2">
                  <button
                    className="rounded bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-200"
                    disabled={verifyMutation.isPending || rejectMutation.isPending}
                    onClick={() => verifyMutation.mutate(id)}
                  >
                    Verify
                  </button>
                  <button
                    className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
                    disabled={verifyMutation.isPending || rejectMutation.isPending}
                    onClick={() => rejectMutation.mutate({ submissionId: id })}
                  >
                    Reject
                  </button>
                </div>
              )
            },
          },
        ]}
        data={data || []}
        isLoading={isLoading}
        emptyMessage="No manual submissions found."
        searchable
        searchPlaceholder="Search student, email, role..."
        rowKey="id"
      />
    </div>
  )
}

export default function TutorDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const addToast = useToastStore((s) => s.addToast)
  const { data: profile, isLoading: profileLoading } = useTutorProfile()
  const { data: students, isLoading: studentsLoading } = useTutorStudents()
  const { data: creditRules, isLoading: rulesLoading } = useTutorCreditRules()
  const manualCertMutation = useTutorManualCertificate()
  const [selectedStudentEmail, setSelectedStudentEmail] = useState(null)
  const [manualEntry, setManualEntry] = useState({ student_email: '', cert_type: '', cert_number: '' })
  const [downloadingStudentEmail, setDownloadingStudentEmail] = useState(null)
  const [isDownloadingAllAssigned, setIsDownloadingAllAssigned] = useState(false)
  const [creditRangeExpression, setCreditRangeExpression] = useState('')
  const activeTab = searchParams.get('tab') === 'verification' ? 'verification' : 'dashboard'

  const totalStudents = students?.length || 0
  const creditFilter = buildCreditPredicate(creditRangeExpression)
  const filteredStudents = (students || []).filter((student) => creditFilter.fn(student.total_credits))

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!manualEntry.student_email || !manualEntry.cert_type) return

    await manualCertMutation.mutateAsync({
      student_email: manualEntry.student_email,
      cert_type: manualEntry.cert_type,
      cert_number: manualEntry.cert_number?.trim() || undefined,
    })

    setManualEntry((prev) => ({ ...prev, cert_number: '' }))
    setSelectedStudentEmail(manualEntry.student_email)
  }

  const handleDownloadAllForStudent = async (student) => {
    const email = student?.student_email
    if (!email) return

    try {
      setDownloadingStudentEmail(email)
      const blob = await downloadTutorStudentCertificates(email)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const baseName = (student?.student_name || student?.registration_number || 'student')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'student'

      link.href = url
      link.download = `${baseName}-certificates.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      addToast({ type: 'success', message: 'Certificate ZIP download started.' })
    } catch (err) {
      const status = err?.response?.status
      addToast({
        type: 'error',
        message: status === 404
          ? 'No certificate files found for this student yet.'
          : (err?.response?.data?.detail || 'Failed to download certificates.'),
      })
    } finally {
      setDownloadingStudentEmail(null)
    }
  }

  const handleDownloadAllAssigned = async () => {
    try {
      setIsDownloadingAllAssigned(true)
      const blob = await downloadTutorAllAssignedCertificates()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'assigned-students-certificates.zip'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      addToast({ type: 'success', message: 'Combined certificate ZIP download started.' })
    } catch (err) {
      const status = err?.response?.status
      addToast({
        type: 'error',
        message: status === 404
          ? 'No downloadable certificate files found for assigned students.'
          : (err?.response?.data?.detail || 'Failed to download assigned student certificates.'),
      })
    } finally {
      setIsDownloadingAllAssigned(false)
    }
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {profileLoading ? 'Tutor Dashboard' : `Tutor Dashboard — ${profile?.name || 'Tutor'}`}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Class: {(profile?.department || '—')} {(profile?.batch || '')} {(profile?.section || '')}
              </p>
            </div>

            <div className="mb-2 flex gap-1 border-b border-gray-200">
              <button
                onClick={() => setSearchParams({}, { replace: true })}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'dashboard'
                    ? 'text-navy after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-navy after:rounded-t-full'
                    : 'text-gray-500 hover:text-navy'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setSearchParams({ tab: 'verification' }, { replace: true })}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'verification'
                    ? 'text-navy after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-navy after:rounded-t-full'
                    : 'text-gray-500 hover:text-navy'
                }`}
              >
                Credit Point Verification
              </button>
            </div>

            {activeTab === 'verification' ? (
              <VerificationTab />
            ) : (
              <>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-1">
              <StatCard label="Assigned Students" value={totalStudents} accent="navy" />
            </div>

            <div className="card p-5">
              <h2 className="section-title mb-3">Manual Certificate Entry</h2>
              <p className="mb-3 text-sm text-gray-500">Select a student and role. Credits are auto-applied from credit rules. Certificate number is optional.</p>

              <form className="grid grid-cols-1 gap-3 sm:grid-cols-4" onSubmit={handleManualSubmit}>
                <div className="sm:col-span-2">
                  <label className="form-label">Student *</label>
                  <select
                    className="form-input"
                    value={manualEntry.student_email}
                    onChange={(e) => setManualEntry((p) => ({ ...p, student_email: e.target.value }))}
                  >
                    <option value="">Select student</option>
                    {(students || []).map((s) => (
                      <option key={s.student_email} value={s.student_email}>
                        {s.student_name} ({s.registration_number || '—'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Role *</label>
                  <select
                    className="form-input"
                    value={manualEntry.cert_type}
                    onChange={(e) => setManualEntry((p) => ({ ...p, cert_type: e.target.value }))}
                    disabled={rulesLoading}
                  >
                    <option value="">Select role</option>
                    {(creditRules || []).map((r) => (
                      <option key={r.cert_type} value={r.cert_type}>
                        {r.cert_type.replace(/_/g, ' ')} (+{r.points})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Certificate Number (Optional)</label>
                  <input
                    className="form-input"
                    value={manualEntry.cert_number}
                    onChange={(e) => setManualEntry((p) => ({ ...p, cert_number: e.target.value }))}
                    placeholder="Leave empty to auto-generate"
                  />
                </div>

                <div className="sm:col-span-4 flex justify-end">
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={manualCertMutation.isPending || !manualEntry.student_email || !manualEntry.cert_type}
                  >
                    {manualCertMutation.isPending ? 'Adding...' : 'Add Manual Certificate'}
                  </button>
                </div>
              </form>
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="section-title">Students</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    className="form-input w-64"
                    value={creditRangeExpression}
                    onChange={(e) => setCreditRangeExpression(e.target.value)}
                    placeholder="Credits: <10, >=20, 10-20"
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={isDownloadingAllAssigned}
                    onClick={handleDownloadAllAssigned}
                  >
                    {isDownloadingAllAssigned ? 'Preparing ZIP...' : 'Download All Assigned Certificates'}
                  </button>
                </div>
              </div>
              {creditFilter.error && <p className="mb-2 text-xs text-red-600">{creditFilter.error}</p>}
              <DataTable
                columns={[
                  {
                    key: 'student_name',
                    header: 'Name',
                    sortable: true,
                    searchKey: true,
                    render: (v, row) => (
                      <button className="text-navy hover:underline font-semibold" onClick={() => setSelectedStudentEmail(row.student_email)}>
                        {v || '—'}
                      </button>
                    ),
                  },
                  { key: 'registration_number', header: 'Reg Number', render: (v) => <span className="font-mono text-xs">{v || '—'}</span> },
                  { key: 'student_email', header: 'Email', searchKey: true },
                  { key: 'total_credits', header: 'Credit Points', align: 'right', render: (v) => renderCreditAgainstTarget(v) },
                  {
                    key: '_actions',
                    header: 'Actions',
                    searchKey: false,
                    align: 'center',
                    render: (_, row) => (
                      <button
                        type="button"
                        className="rounded bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy/20 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={downloadingStudentEmail === row.student_email}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDownloadAllForStudent(row)
                        }}
                      >
                        {downloadingStudentEmail === row.student_email ? 'Downloading...' : 'Download All Certificates'}
                      </button>
                    ),
                  },
                ]}
                data={filteredStudents}
                isLoading={studentsLoading}
                emptyMessage="No students mapped to this tutor yet."
                searchable
                searchPlaceholder="Search by name, email, reg no..."
                rowKey="student_email"
              />
            </div>
              </>
            )}
          </div>
        </main>
      </div>

      <DetailModal email={selectedStudentEmail} onClose={() => setSelectedStudentEmail(null)} />
    </div>
  )
}
