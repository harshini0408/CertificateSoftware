import { useState } from 'react'

import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatCard from '../../components/StatCard'

import { useTutorCreditRules, useTutorManualCertificate, useTutorProfile, useTutorStudentDetail, useTutorStudents } from './api'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
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
              <div><span className="text-gray-500">Total Credits:</span> <span className="font-bold text-navy">{data?.total_credits ?? 0}</span></div>
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

export default function TutorDashboard() {
  const { data: profile, isLoading: profileLoading } = useTutorProfile()
  const { data: students, isLoading: studentsLoading } = useTutorStudents()
  const { data: creditRules, isLoading: rulesLoading } = useTutorCreditRules()
  const manualCertMutation = useTutorManualCertificate()
  const [selectedStudentEmail, setSelectedStudentEmail] = useState(null)
  const [manualEntry, setManualEntry] = useState({ student_email: '', cert_type: '', cert_number: '' })

  const totalStudents = students?.length || 0

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
              <h2 className="section-title mb-3">Students</h2>
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
                  { key: 'total_credits', header: 'Credit Points', align: 'right', render: (v) => <span className="font-bold text-green-700">{v || 0}</span> },
                ]}
                data={students || []}
                isLoading={studentsLoading}
                emptyMessage="No students mapped to this tutor yet."
                searchable
                searchPlaceholder="Search by name, email, reg no..."
                rowKey="student_email"
              />
            </div>
          </div>
        </main>
      </div>

      <DetailModal email={selectedStudentEmail} onClose={() => setSelectedStudentEmail(null)} />
    </div>
  )
}
