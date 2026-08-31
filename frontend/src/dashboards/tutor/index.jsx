import { useEffect, useState } from 'react'
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
  useTutorUpdateStudentRegNo,
  downloadTutorAllAssignedCertificates,
  downloadTutorStudentCertificates,
} from './api'
import { BACKEND_URL } from '../../utils/axiosInstance'

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

function EditRegNoModal({ student, onClose }) {
  const updateRegNo = useTutorUpdateStudentRegNo()
  const [regNo, setRegNo] = useState(student?.registration_number || '')
  const [error, setError] = useState('')

  const editsRemaining = student?.edits_remaining !== undefined
    ? student.edits_remaining
    : Math.max(0, 2 - (student?.tutor_reg_no_change_count || 0))

  const handleSubmit = (e) => {
    e.preventDefault()
    const clean = regNo.trim()
    if (!clean) {
      setError('Please enter a 12-digit registration number.')
      return
    }
    if (!/^\d{12}$/.test(clean)) {
      setError('Registration number must be exactly 12 numeric digits (e.g. 715522104001).')
      return
    }
    setError('')
    updateRegNo.mutate(
      {
        studentEmail: student.student_email,
        registration_number: clean,
      },
      {
        onSuccess: () => {
          onClose()
        },
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-navy">Edit Registration Number</h3>
            <p className="text-xs text-gray-500 mt-0.5">{student.student_name} ({student.student_email})</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
        </div>

        <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">Tutor Edit Policy:</p>
          <p>
            You can change this student's register number a maximum of <strong>2 times</strong>.
          </p>
          <p className="font-medium text-blue-900">
            Edits remaining: <span className="font-bold underline">{editsRemaining} of 2</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label" htmlFor="tutor-reg-input">
              Registration Number (12 Digits) *
            </label>
            <input
              id="tutor-reg-input"
              type="text"
              maxLength={12}
              value={regNo}
              onChange={(e) => {
                setRegNo(e.target.value.replace(/\D/g, ''))
                setError('')
              }}
              placeholder="e.g. 715522104001"
              className={`form-input font-mono text-sm ${error ? 'border-red-500' : ''}`}
              autoFocus
            />
            {error && <p className="form-error mt-1">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateRegNo.isPending || editsRemaining <= 0 || !regNo || regNo.length !== 12}
              className="btn-primary text-xs"
            >
              {updateRegNo.isPending ? 'Saving…' : 'Save Register Number'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DetailModal({ email, onClose }) {
  const { data, isLoading } = useTutorStudentDetail(email, !!email)
  const semesterTotals = data?.semester_totals || []
  const currentSemester = data?.current_semester
  const eventDetails = data?.event_details || []
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

  const selectedRows = eventDetails.filter(
    (entry) => (entry.semester || 'Unknown') === selectedSemester,
  )
  const selectedTotal = semesterTotals.find(
    (item) => (item?.semester || 'Unknown') === selectedSemester,
  )?.total_credits ?? 0

  const [editingStudent, setEditingStudent] = useState(null)

  if (!email) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Student Event Details</h2>
            <p className="text-xs text-gray-500">Use View to open each certificate file for verification.</p>
          </div>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>

        {isLoading ? (
          <LoadingSpinner label="Loading student details..." />
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 p-3 text-sm">
              <div><span className="text-gray-500">Name:</span> <span className="font-semibold">{data?.student_name || '—'}</span></div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Reg No:</span>
                <span className="font-mono font-semibold">{data?.registration_number || '—'}</span>
                {data?.can_tutor_edit_reg_no ? (
                  <button
                    onClick={() => setEditingStudent({
                      student_name: data.student_name,
                      student_email: data.student_email,
                      registration_number: data.registration_number,
                      edits_remaining: data.edits_remaining,
                      tutor_reg_no_change_count: data.tutor_reg_no_change_count,
                    })}
                    className="ml-1 inline-flex items-center gap-1 text-xs text-navy hover:underline font-medium"
                    title={`Edit register number (${data?.edits_remaining}/2 edits left)`}
                  >
                    ✏️ Edit ({data?.edits_remaining}/2 left)
                  </button>
                ) : (
                  <span className="ml-1 text-[11px] text-gray-400 italic">(Max 2 edits reached)</span>
                )}
              </div>
              <div><span className="text-gray-500">Email:</span> <span className="font-semibold">{data?.student_email || '—'}</span></div>
              <div><span className="text-gray-500">Current Semester Credits:</span> {renderCreditAgainstTarget(data?.total_credits)}</div>
            </div>
            {editingStudent && <EditRegNoModal student={editingStudent} onClose={() => setEditingStudent(null)} />}
            <div className="card p-4">
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
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Certificates by Semester</h3>
              {uniqueSemesters.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
                  No semester data yet.
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
                    columns={[
                      { key: 'event_name', header: 'Event', sortable: true, searchKey: true },
                      { key: 'role', header: 'Role', render: (v) => <span className="capitalize">{(v || '').replace(/_/g, ' ')}</span> },
                      { key: 'certificate_number', header: 'Certificate Number', render: (v) => <span className="font-mono text-xs">{v || '—'}</span> },
                      { key: 'event_date', header: 'Event Date', render: (v, row) => fmtDate(v || row?.awarded_at) },
                      { key: 'credit_points', header: 'Credit Points', align: 'right', render: (v) => <span className="font-bold text-green-700">+{v || 0}</span> },
                      {
                        key: '_actions',
                        header: 'Actions',
                        align: 'center',
                        render: (_, row) => {
                          const raw = row?.certificate_image_url
                          if (!raw) return <span className="text-xs text-gray-400">—</span>
                          const href = String(raw).startsWith('http') ? raw : `${BACKEND_URL}${raw}`
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
                    ]}
                    data={selectedRows}
                    isLoading={false}
                    emptyMessage="No event records found for this semester."
                    searchable
                    searchPlaceholder="Search events..."
                  />
                </div>
              )}
            </div>
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
  const [editingStudent, setEditingStudent] = useState(null)
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
                  {
                    key: 'registration_number',
                    header: 'Reg Number',
                    render: (v, row) => {
                      const editsRem = row.edits_remaining !== undefined
                        ? row.edits_remaining
                        : Math.max(0, 2 - (row.tutor_reg_no_change_count || 0))
                      const canEdit = editsRem > 0
                      return (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold">{v || '—'}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingStudent(row)
                            }}
                            disabled={!canEdit}
                            className={`p-1 rounded transition-colors ${
                              canEdit
                                ? 'text-navy hover:bg-navy/10'
                                : 'text-gray-300 cursor-not-allowed opacity-40'
                            }`}
                            title={canEdit ? `Edit register number (${editsRem}/2 edits left)` : 'Maximum 2 edits limit reached for this student'}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </div>
                      )
                    },
                  },
                  { key: 'student_email', header: 'Email', searchKey: true },
                  { key: 'total_credits', header: 'Credit Points', align: 'right', render: (v) => renderCreditAgainstTarget(v) },
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
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedStudentEmail(row.student_email)
                          }}
                        >
                          View Certificates
                        </button>
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
                      </div>
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
      {editingStudent && <EditRegNoModal student={editingStudent} onClose={() => setEditingStudent(null)} />}
    </div>
  )
}
