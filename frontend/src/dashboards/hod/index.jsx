import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'

import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import DataTable from '../../components/DataTable'
import StatCard from '../../components/StatCard'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { BACKEND_URL } from '../../utils/axiosInstance'

import { useHodProfile, useHodStudents, useHodStudentCertificates, useHodPerformance } from './api'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icons = {
  chart: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  trophy: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  star: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  alert: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  users: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
}

// ── Student Certificate Details Modal ───────────────────────────────────────────
function StudentDetailModal({ studentId, studentName, onClose }) {
  const { data: certResp, isLoading: loadingCerts } = useHodStudentCertificates(studentId)
  const certificates = (certResp?.certificates || []).map((cert) => ({
    ...cert,
    issuer: cert.issuer || cert.club_name,
  }))
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Student Event Certificates</h2>
            <p className="text-xs text-gray-500">Use View to open each certificate file for verification.</p>
          </div>
          <button className="btn-secondary text-xs" onClick={onClose}>Close</button>
        </div>

        {loadingCerts ? (
          <LoadingSpinner label="Loading certificates..." />
        ) : (
          <>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm mb-4 flex items-center justify-between">
              <div>
                <span className="text-gray-500">Student Name:</span> <span className="font-semibold text-navy">{studentName || '—'}</span>
              </div>
              <div className="text-xs text-gray-500">
                Total Credits: <span className="font-bold text-green-700">{certResp?.student?.total_credits ?? 0}</span>
              </div>
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

// ── Class Student Roster Modal ──────────────────────────────────────────────────
function ClassRosterModal({ classData, onClose, onSelectStudent }) {
  const [studentSearch, setStudentSearch] = useState('')

  if (!classData) return null

  const filteredStudents = (classData.students || []).filter((s) => {
    if (!studentSearch.trim()) return true
    const q = studentSearch.toLowerCase()
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.registration_number || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    )
  })

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-5xl overflow-auto rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{classData.class_name}</h2>
              <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-semibold text-navy">
                Rank #{classData.rank}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Class Roster & Individual Earned Credit Points
            </p>
          </div>
          <button className="btn-secondary text-xs" onClick={onClose}>Close</button>
        </div>

        {/* 3 Parameter Highlights for this Class */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
            <span className="text-xs text-gray-500 block">Total Students</span>
            <span className="text-lg font-bold text-navy">{classData.total_students}</span>
          </div>
          <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
            <span className="text-xs text-blue-600 font-medium block">Average Credits</span>
            <span className="text-lg font-bold text-blue-900">{classData.average_credits} pts</span>
          </div>
          <div className="rounded-lg border border-purple-100 bg-purple-50/40 p-3">
            <span className="text-xs text-purple-600 font-medium block">Median Credits</span>
            <span className="text-lg font-bold text-purple-900">{classData.median_credits} pts</span>
          </div>
          <div className="rounded-lg border border-green-100 bg-green-50/40 p-3">
            <span className="text-xs text-green-600 font-medium block">≥ 10 Credits (≥50%)</span>
            <span className="text-lg font-bold text-green-800">
              {classData.students_ge_10_count} <span className="text-xs font-normal">({classData.percentage_ge_10}%)</span>
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="search"
            placeholder="Search student by name, reg number, or email..."
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="form-input text-xs"
          />
        </div>

        {/* Student Table */}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Reg Number</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-right">Credit Points Earned</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">
                    No students found matching your search.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s, idx) => {
                  const has50Pct = s.total_credits >= 10
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-navy">
                        <button
                          type="button"
                          className="hover:underline text-left"
                          onClick={() => onSelectStudent(s.id, s.name)}
                        >
                          {s.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{s.registration_number}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{s.email}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center gap-1 font-bold text-sm ${
                          s.total_credits >= 10 ? 'text-green-700' : s.total_credits >= 5 ? 'text-blue-700' : 'text-amber-700'
                        }`}>
                          {s.total_credits} <span className="text-xs font-normal text-gray-400">pts</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {has50Pct ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                            ✓ ≥50% (≥10)
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                            &lt;50%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-navy hover:text-white transition-colors"
                          onClick={() => onSelectStudent(s.id, s.name)}
                        >
                          View Certificates
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Performance Tab ────────────────────────────────────────────────────────────
function PerformanceTab({ assignedDepartments, profile, onSelectStudent }) {
  const [batchFilter, setBatchFilter] = useState('')
  const [selectedClassForRoster, setSelectedClassForRoster] = useState(null)

  const { data: perfResp, isLoading } = useHodPerformance({ batch: batchFilter })

  const summary = perfResp?.summary || {}
  const topPerforming = perfResp?.top_performing || []
  const poorPerforming = perfResp?.poor_performing || []
  const allClasses = perfResp?.classes || []
  const availableBatches = perfResp?.available_batches || []

  const rankBadgeColors = {
    1: 'bg-amber-100 text-amber-800 border-amber-300 ring-2 ring-amber-200',
    2: 'bg-slate-100 text-slate-700 border-slate-300 ring-2 ring-slate-200',
    3: 'bg-orange-100 text-orange-800 border-orange-300 ring-2 ring-orange-200',
  }

  const performanceColumns = [
    {
      key: 'rank',
      header: 'Rank',
      align: 'center',
      render: (v) => (
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
          v === 1 ? 'bg-amber-400 text-white shadow-sm' :
          v === 2 ? 'bg-slate-400 text-white' :
          v === 3 ? 'bg-orange-400 text-white' :
          'bg-gray-100 text-gray-700'
        }`}>
          #{v}
        </span>
      ),
    },
    {
      key: 'class_name',
      header: 'Class / Batch',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <button
          type="button"
          className="text-left font-semibold text-navy hover:underline flex flex-col"
          onClick={() => setSelectedClassForRoster(row)}
        >
          <span>{v}</span>
          <span className="text-[11px] font-normal text-gray-400">Click to view student list</span>
        </button>
      ),
    },
    {
      key: 'total_students',
      header: 'Students',
      align: 'center',
      sortable: true,
      render: (v) => <span className="font-medium text-gray-700">{v}</span>,
    },
    {
      key: 'average_credits',
      header: 'Average Credits',
      align: 'right',
      sortable: true,
      render: (v) => (
        <span className="font-bold text-navy text-sm">
          {v} <span className="text-xs font-normal text-gray-400">pts</span>
        </span>
      ),
    },
    {
      key: 'median_credits',
      header: 'Median Credits',
      align: 'right',
      sortable: true,
      render: (v) => (
        <span className="font-bold text-purple-700 text-sm">
          {v} <span className="text-xs font-normal text-gray-400">pts</span>
        </span>
      ),
    },
    {
      key: 'percentage_ge_10',
      header: 'Students ≥ 10 Credits (≥50%)',
      align: 'right',
      sortable: true,
      render: (v, row) => (
        <div className="flex flex-col items-end gap-1">
          <span className="font-semibold text-green-700 text-xs">
            {row.students_ge_10_count} / {row.total_students} ({v}%)
          </span>
          <div className="w-24 bg-gray-200 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-green-600 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(v, 100)}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Performance Status',
      align: 'center',
      render: (v) => {
        const isTop = v === 'Top Performer' || v === 'Good'
        const isPoor = v === 'Needs Attention' || v === 'Needs Improvement'
        return (
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isTop ? 'bg-green-100 text-green-800' :
            isPoor ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-800'
          }`}>
            {v}
          </span>
        )
      },
    },
    {
      key: '_actions',
      header: 'Student Roster',
      align: 'center',
      render: (_, row) => (
        <button
          type="button"
          className="rounded bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy hover:text-white transition-colors"
          onClick={() => setSelectedClassForRoster(row)}
        >
          View Students ({row.total_students})
        </button>
      ),
    },
  ]

  if (isLoading) {
    return <LoadingSpinner fullPage label="Calculating class-wise performance analytics..." />
  }

  return (
    <div className="space-y-6">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Class-Wise Performance Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            Evaluating classes by 3 key benchmarks: <span className="font-semibold text-navy">Average Credits</span>, <span className="font-semibold text-purple-700">Median Credits</span>, and <span className="font-semibold text-green-700">Students with ≥50% (≥10) Credits</span>.
          </p>
        </div>

        {/* Batch Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">Filter Batch:</label>
          <select
            className="form-input text-xs py-1.5"
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
          >
            <option value="">All Batches</option>
            {availableBatches.map((b) => (
              <option key={b} value={b}>Batch {b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Dept Average Credits"
          value={`${summary.overall_average_credits ?? 0} pts`}
          subText="Mean credit points across all students"
          icon={Icons.chart}
          accent="navy"
          isLoading={isLoading}
        />
        <StatCard
          label="Dept Median Credits"
          value={`${summary.overall_median_credits ?? 0} pts`}
          subText="50th percentile benchmark"
          icon={Icons.star}
          accent="purple"
          isLoading={isLoading}
        />
        <StatCard
          label="Students ≥ 10 Credits (≥50%)"
          value={`${summary.overall_students_ge_10_count ?? 0} (${summary.overall_percentage_ge_10 ?? 0}%)`}
          subText="Meeting ≥50% credit threshold"
          icon={Icons.trophy}
          accent="green"
          isLoading={isLoading}
        />
        <StatCard
          label="Classes Monitored"
          value={`${summary.total_classes ?? 0} Classes`}
          subText={`Total ${summary.total_students ?? 0} active students`}
          icon={Icons.users}
          accent="gold"
          isLoading={isLoading}
        />
      </div>

      {/* Top 3 & Poor Performing 3 Classes Highlights */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 🏆 Top 3 Performing Classes */}
        <div className="card p-5 border-t-4 border-t-green-500 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-700">
                🏆
              </span>
              <div>
                <h2 className="text-base font-bold text-foreground">Top Performing Classes</h2>
                <p className="text-xs text-gray-500">Highest ranked based on the 3 performance parameters</p>
              </div>
            </div>
            <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 border border-green-200">
              Top 3
            </span>
          </div>

          {topPerforming.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No class performance data available.</p>
          ) : (
            <div className="space-y-3">
              {topPerforming.map((c, idx) => (
                <div
                  key={c.class_id}
                  className="rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50/80 to-white p-4 hover:shadow-md transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold border ${
                        rankBadgeColors[c.rank] || 'bg-gray-100 text-gray-700'
                      }`}>
                        #{c.rank}
                      </span>
                      <span className="font-bold text-foreground text-sm">{c.class_name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{c.total_students} students</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-white p-2.5 border border-gray-100 text-center">
                    <div>
                      <span className="text-[11px] text-gray-400 block">Avg Credits</span>
                      <span className="text-sm font-bold text-navy">{c.average_credits} pts</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-400 block">Median</span>
                      <span className="text-sm font-bold text-purple-700">{c.median_credits} pts</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-400 block">≥ 10 Credits</span>
                      <span className="text-sm font-bold text-green-700">{c.percentage_ge_10}%</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full text-center text-xs font-semibold text-navy hover:text-navy/80 hover:underline py-1"
                    onClick={() => setSelectedClassForRoster(c)}
                  >
                    View Class Student Roster →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ⚠️ Poor Performing 3 Classes */}
        <div className="card p-5 border-t-4 border-t-amber-500 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                ⚠️
              </span>
              <div>
                <h2 className="text-base font-bold text-foreground">Poor Performing Classes</h2>
                <p className="text-xs text-gray-500">Classes requiring academic / event credit intervention</p>
              </div>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
              Needs Focus
            </span>
          </div>

          {poorPerforming.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No class performance data available.</p>
          ) : (
            <div className="space-y-3">
              {poorPerforming.map((c) => (
                <div
                  key={c.class_id}
                  className="rounded-xl border border-amber-200/70 bg-gradient-to-r from-amber-50/30 to-white p-4 hover:shadow-md transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        #{c.rank}
                      </span>
                      <span className="font-bold text-foreground text-sm">{c.class_name}</span>
                    </div>
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      Needs Attention
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-lg bg-white p-2.5 border border-gray-100 text-center">
                    <div>
                      <span className="text-[11px] text-gray-400 block">Avg Credits</span>
                      <span className="text-sm font-bold text-amber-700">{c.average_credits} pts</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-400 block">Median</span>
                      <span className="text-sm font-bold text-purple-700">{c.median_credits} pts</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-gray-400 block">≥ 10 Credits</span>
                      <span className="text-sm font-bold text-gray-600">{c.percentage_ge_10}%</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full text-center text-xs font-semibold text-amber-800 hover:underline py-1"
                    onClick={() => setSelectedClassForRoster(c)}
                  >
                    View Class Student Roster →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All Batches and Classes Performance Monitoring Table */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-foreground">All Batches & Classes Performance Monitoring</h2>
            <p className="text-xs text-gray-500">Comprehensive class rankings, statistics, and student credit distributions</p>
          </div>
          <span className="text-xs text-gray-500">
            Total {allClasses.length} class{allClasses.length > 1 ? 'es' : ''} listed
          </span>
        </div>

        <DataTable
          columns={performanceColumns}
          data={allClasses}
          isLoading={isLoading}
          emptyMessage="No classes found for the selected batch filter."
          searchable
          searchPlaceholder="Search class name or batch..."
        />
      </div>

      {/* Class Student Roster Modal */}
      <ClassRosterModal
        classData={selectedClassForRoster}
        onClose={() => setSelectedClassForRoster(null)}
        onSelectStudent={(id, name) => onSelectStudent(id, name)}
      />
    </div>
  )
}

// ── MAIN: HOD Dashboard ───────────────────────────────────────────────────────
export default function HodDashboard() {
  const [searchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'dashboard'

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
      <div className="flex items-start">
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-[calc(100dvh-3.5rem)] bg-background">
          <div className="page-container space-y-5">
            {activeTab === 'performance' ? (
              <PerformanceTab
                assignedDepartments={assignedDepartments}
                profile={profile}
                onSelectStudent={(id, name) => {
                  setSelectedStudentId(id)
                  setSelectedStudentName(name)
                }}
              />
            ) : (
              <>
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
