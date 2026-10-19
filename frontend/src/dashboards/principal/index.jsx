import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { createPortal } from 'react-dom'

import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import StatCard from '../../components/StatCard'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { BACKEND_URL } from '../../utils/axiosInstance'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Cell,
} from 'recharts'

import {
  usePrincipalStats,
  usePrincipalRankings,
  usePrincipalClubs,
  usePrincipalClubEvents,
  usePrincipalDepartments,
  usePrincipalDeptEvents,
  usePrincipalEventsOverview,
  usePrincipalStudents,
  usePrincipalStudentCertificates,
  usePrincipalLeastPerformingClubs,
  usePrincipalActiveMembers,
  usePrincipalSocieties,
  usePrincipalSocietyEvents,
} from './api'

// ── Icons ────────────────────────────────────────────────────────────────────
const Icons = {
  clubs: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  departments: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 21h16M6 21V7a1 1 0 011-1h10a1 1 0 011 1v14M9 10h.01M9 13h.01M9 16h.01M12 10h.01M12 13h.01M12 16h.01M15 10h.01M15 13h.01M15 16h.01" />
    </svg>
  ),
  calendar: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  users: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  template: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
}

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

const REPORT_STATUS_COLORS = {
  not_submitted: 'bg-gray-100 text-gray-600',
  pending_review: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

function ReportStatusBadge({ status }) {
  const label = (status || 'not_submitted').replace(/_/g, ' ')
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${REPORT_STATUS_COLORS[status] || REPORT_STATUS_COLORS.not_submitted}`}>
      {label}
    </span>
  )
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

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Dashboard Tab (Overview + Stats + Top 5 Rankings + Graphs + Least Performing)
// ═══════════════════════════════════════════════════════════════════════════════

function getShortClubName(name = '') {
  if (!name) return ''
  const trimmed = name.replace(/\s+Club$/i, '').replace(/^iTech\s+/i, '')
  return trimmed.length > 13 ? trimmed.slice(0, 11) + '…' : trimmed
}

function getShortDeptName(name = '') {
  if (!name) return ''
  const map = {
    'BE COMPUTER SCIENCE & ENGINEERING': 'CSE',
    'BE ELECTRICAL & ELECTRONICS ENGINEERING': 'EEE',
    'BE ELECTRONICS & COMMUNICATION ENGINEERING': 'ECE',
    'BE MECHANICAL ENGINEERING': 'MECH',
    'BE CIVIL ENGINEERING': 'CIVIL',
    'BTECH ARTIFICIAL INTELLIGENCE AND DATA SCIENCE': 'AI & DS',
    'BTECH ELECTRONICS ENGINEERING (VLSI DESIGN AND TECHNOLOGY)': 'VLSI',
    'BE INSTRUMENTATION AND CONTROL ENGINEERING': 'ICE',
    'HUMANITIES AND SCIENCE': 'H&S',
  }
  return map[name.trim()] || (name.length > 10 ? name.slice(0, 8) + '…' : name)
}

function ClubsAndDeptsGraphicalSection({ onSelectClub, onSelectDept }) {
  const { data: clubs, isLoading: loadingClubs } = usePrincipalClubs()
  const { data: depts, isLoading: loadingDepts } = usePrincipalDepartments()

  const [clubMetric, setClubMetric] = useState('participants')
  const [deptMetric, setDeptMetric] = useState('participants')

  const clubChartData = useMemo(() => {
    if (!clubs || !clubs.length) return []
    return (clubs || [])
      .slice(0, 8)
      .map((c) => ({
        id: c.club_id,
        fullName: c.club_name,
        shortName: getShortClubName(c.club_name),
        participants: c.cumulative_participants || 0,
        events: c.total_completed_events || c.events_this_semester || 0,
      }))
  }, [clubs])

  const deptChartData = useMemo(() => {
    if (!depts || !depts.length) return []
    return (depts || [])
      .slice(0, 8)
      .map((d) => ({
        fullName: d.department,
        shortName: getShortDeptName(d.department),
        participants: d.cumulative_participants || 0,
        events: d.total_events || 0,
        certs: d.total_certs || 0,
      }))
  }, [depts])

  return (
    <div className="space-y-4 pt-1">
      <div>
        <h2 className="text-base font-bold text-foreground">Graphical Analytics & Performance Comparisons</h2>
        <p className="text-xs text-gray-500">Visual comparison of student engagement volume and activity across clubs and departments</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Clubs Graphical Comparison */}
        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Clubs Engagement Chart</h3>
              <p className="text-[11px] text-gray-400">Comparing active clubs by student participation & conducted events</p>
            </div>
            <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setClubMetric('participants')}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  clubMetric === 'participants'
                    ? 'bg-white font-bold text-navy shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Participants
              </button>
              <button
                type="button"
                onClick={() => setClubMetric('events')}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  clubMetric === 'events'
                    ? 'bg-white font-bold text-navy shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Events
              </button>
            </div>
          </div>

          {loadingClubs ? (
            <div className="flex justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-navy border-t-transparent" />
            </div>
          ) : !clubChartData.length ? (
            <div className="py-16 text-center text-xs text-gray-400">No club performance data to display</div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clubChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <defs>
                    <linearGradient id="clubBarBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.95} />
                    </linearGradient>
                    <linearGradient id="clubBarIndigo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#4338ca" stopOpacity={0.95} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const item = payload[0].payload
                      return (
                        <div className="rounded-xl border border-gray-100 bg-white/95 backdrop-blur-sm p-3 shadow-xl text-xs space-y-1">
                          <p className="font-bold text-gray-900 border-b border-gray-100 pb-1">{item.fullName}</p>
                          <p className="text-navy font-semibold">
                            {clubMetric === 'participants' ? `${item.participants} Participants` : `${item.events} Events Completed`}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {clubMetric === 'participants' ? `${item.events} completed events` : `${item.participants} total participants`}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    dataKey={clubMetric === 'participants' ? 'participants' : 'events'}
                    fill={clubMetric === 'participants' ? 'url(#clubBarBlue)' : 'url(#clubBarIndigo)'}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                    cursor="pointer"
                    onClick={(entry) => onSelectClub && onSelectClub(entry.id)}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
            <span>Showing top 8 active clubs</span>
            <span>Click any bar to view full club events</span>
          </div>
        </div>

        {/* Right: Departments Graphical Comparison */}
        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Departments Engagement Chart</h3>
              <p className="text-[11px] text-gray-400">Cumulative participant reach across academic branches</p>
            </div>
            <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setDeptMetric('participants')}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  deptMetric === 'participants'
                    ? 'bg-white font-bold text-green-800 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Participants
              </button>
              <button
                type="button"
                onClick={() => setDeptMetric('events')}
                className={`rounded-md px-2.5 py-1 transition-all ${
                  deptMetric === 'events'
                    ? 'bg-white font-bold text-green-800 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Events
              </button>
            </div>
          </div>

          {loadingDepts ? (
            <div className="flex justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-navy border-t-transparent" />
            </div>
          ) : !deptChartData.length ? (
            <div className="py-16 text-center text-xs text-gray-400">No department data to display</div>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <defs>
                    <linearGradient id="deptBarGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#047857" stopOpacity={0.95} />
                    </linearGradient>
                    <linearGradient id="deptBarTeal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#0f766e" stopOpacity={0.95} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const item = payload[0].payload
                      return (
                        <div className="rounded-xl border border-gray-100 bg-white/95 backdrop-blur-sm p-3 shadow-xl text-xs space-y-1">
                          <p className="font-bold text-gray-900 border-b border-gray-100 pb-1">{item.fullName}</p>
                          <p className="text-green-700 font-semibold">
                            {deptMetric === 'participants' ? `${item.participants} Participants` : `${item.events} Events Conducted`}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {deptMetric === 'participants' ? `${item.events} events conducted` : `${item.participants} total participants`}
                          </p>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    dataKey={deptMetric === 'participants' ? 'participants' : 'events'}
                    fill={deptMetric === 'participants' ? 'url(#deptBarGreen)' : 'url(#deptBarTeal)'}
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                    cursor="pointer"
                    onClick={(entry) => onSelectDept && onSelectDept(entry.fullName)}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
            <span>Departments sorted by engagement</span>
            <span>Click any bar to drill down department events</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LeastPerformingClubsSection({ onSelectClub }) {
  const [limit, setLimit] = useState(10)
  const { data, isLoading } = usePrincipalLeastPerformingClubs(limit)
  const [activeMetric, setActiveMetric] = useState('participants')
  const [hoveredClubId, setHoveredClubId] = useState(null)

  const summary = data?.summary || {
    total_clubs: 23,
    inactive_clubs_count: 0,
    avg_participants_per_club: 0,
    avg_events_per_club: 0,
    benchmark_target: 30,
  }

  const leastClubs = data?.least_performing_clubs || []

  const chartData = useMemo(() => {
    return leastClubs.map((club, idx) => ({
      index: idx + 1,
      clubId: club.club_id,
      fullName: club.club_name,
      shortName: getShortClubName(club.club_name),
      participants: club.total_participants || 0,
      events: club.event_count || 0,
      gap: club.participant_gap || 0,
      target: club.benchmark_target || summary.benchmark_target || 30,
      status: club.status || 'Inactive',
    }))
  }, [leastClubs, summary.benchmark_target])

  const focusedClub = useMemo(() => {
    if (!hoveredClubId) return leastClubs[0] || null
    return leastClubs.find((c) => c.club_id === hoveredClubId) || leastClubs[0] || null
  }, [hoveredClubId, leastClubs])

  return (
    <div className="card p-5 space-y-5 border-l-4 border-l-rose-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 font-bold shadow-xs">
            📉
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">Least Performing Clubs Analysis</h2>
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                Action Required
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Interactive pinpoint analysis identifying clubs with low engagement against institutional benchmark targets.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-gray-50 border border-gray-200 px-2.5 py-1 text-xs text-gray-600 font-medium">
            🎯 Target: <strong className="text-indigo-700">{summary.benchmark_target} participants</strong>
          </span>
          <span className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs text-rose-700 font-medium">
            ⚠️ <strong className="text-rose-800">{summary.inactive_clubs_count}</strong> Inactive Club{summary.inactive_clubs_count !== 1 ? 's' : ''}
          </span>
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setLimit(5)}
              className={`rounded-md px-2 py-0.5 transition-all ${
                limit === 5 ? 'bg-white font-bold text-rose-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Bottom 5
            </button>
            <button
              type="button"
              onClick={() => setLimit(10)}
              className={`rounded-md px-2 py-0.5 transition-all ${
                limit === 10 ? 'bg-white font-bold text-rose-700 shadow-xs' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Bottom 10
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-rose-500 border-t-transparent" />
        </div>
      ) : !leastClubs.length ? (
        <div className="py-12 text-center text-xs text-gray-400">All clubs have met institutional engagement targets!</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Side: Interactive Line Chart */}
          <div className="lg:col-span-7 bg-slate-50/60 rounded-xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                <span>📍 Interactive Pinpoint Curve</span>
                <span className="text-gray-400 font-normal">({leastClubs.length} clubs ranked lowest to highest)</span>
              </div>
              <div className="inline-flex rounded-md bg-white border border-gray-200 p-0.5 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setActiveMetric('participants')}
                  className={`rounded px-2 py-0.5 transition-all ${
                    activeMetric === 'participants' ? 'bg-rose-500 text-white font-semibold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Participants
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMetric('events')}
                  className={`rounded px-2 py-0.5 transition-all ${
                    activeMetric === 'events' ? 'bg-rose-500 text-white font-semibold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Events
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMetric('gap')}
                  className={`rounded px-2 py-0.5 transition-all ${
                    activeMetric === 'gap' ? 'bg-rose-500 text-white font-semibold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Deficit Gap
                </button>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 15, right: 15, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  {activeMetric === 'participants' && (
                    <ReferenceLine
                      y={summary.benchmark_target || 30}
                      stroke="#6366f1"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: `Target (${summary.benchmark_target})`,
                        position: 'top',
                        fill: '#4f46e5',
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    />
                  )}
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const p = payload[0].payload
                      return (
                        <div className="rounded-xl border border-rose-100 bg-white/95 backdrop-blur-sm p-3 shadow-xl text-xs space-y-1.5 min-w-[200px]">
                          <div className="flex items-center gap-1.5 text-rose-600 font-bold border-b border-gray-100 pb-1">
                            <span>📍 Rank #{p.index}</span>
                            <span className="text-gray-800 truncate">{p.fullName}</span>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>Participants:</span>
                            <strong className="text-gray-900">{p.participants}</strong>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>Events Conducted:</span>
                            <strong className="text-gray-900">{p.events}</strong>
                          </div>
                          <div className="flex justify-between text-gray-600">
                            <span>Deficit to Target:</span>
                            <strong className="text-rose-600">-{p.gap} participants</strong>
                          </div>
                          <div className="pt-1 border-t border-gray-100 flex justify-between items-center text-[11px]">
                            <span className="text-gray-400">Classification:</span>
                            <span className={`px-1.5 py-0.2 rounded font-semibold ${
                              p.status === 'Inactive' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {p.status}
                            </span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={activeMetric}
                    stroke="#f43f5e"
                    strokeWidth={2.5}
                    dot={(props) => {
                      const { cx, cy, payload } = props
                      const isHovered = hoveredClubId === payload.clubId
                      return (
                        <circle
                          key={payload.clubId}
                          cx={cx}
                          cy={cy}
                          r={isHovered ? 6.5 : 4}
                          fill={isHovered ? '#f43f5e' : '#fff'}
                          stroke={isHovered ? '#881337' : '#e11d48'}
                          strokeWidth={isHovered ? 3 : 2}
                          className="transition-all cursor-pointer"
                          onClick={() => setHoveredClubId(payload.clubId)}
                        />
                      )
                    }}
                    activeDot={{ r: 7, stroke: '#881337', strokeWidth: 3, fill: '#fda4af' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {focusedClub && (
              <div className="rounded-lg bg-white border border-rose-200/80 p-3 shadow-2xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 font-bold text-xs">
                    #{focusedClub.rank}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{focusedClub.club_name}</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {focusedClub.event_count} completed event{focusedClub.event_count !== 1 ? 's' : ''} · {focusedClub.total_participants} participants ·{' '}
                      <span className="text-rose-600 font-semibold">{focusedClub.participant_gap} below target</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectClub && onSelectClub(focusedClub.club_id)}
                  className="rounded-md bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors shrink-0"
                >
                  Inspect Club →
                </button>
              </div>
            )}
          </div>

          {/* Right Side: Ranked List of Least Performing Clubs */}
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between pb-1">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Least Performing Rankings
              </h3>
              <span className="text-[11px] text-gray-400">Ranked lowest to highest</span>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {leastClubs.map((club) => {
                const isSelected = hoveredClubId === club.club_id
                return (
                  <div
                    key={club.club_id}
                    onMouseEnter={() => setHoveredClubId(club.club_id)}
                    onClick={() => setHoveredClubId(club.club_id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-200 shadow-2xs'
                        : 'bg-white border-gray-100 hover:border-gray-200 hover:bg-gray-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          club.rank === 1
                            ? 'bg-red-600 text-white'
                            : club.rank <= 3
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {club.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{club.club_name}</p>
                        <p className="text-[11px] text-gray-400">
                          {club.event_count} events · {club.total_participants} participants
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          club.status === 'Inactive'
                            ? 'bg-rose-100 text-rose-700'
                            : club.status === 'Low Engagement'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {club.status}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectClub && onSelectClub(club.club_id)
                        }}
                        className="rounded p-1 text-gray-400 hover:text-navy hover:bg-gray-100"
                        title="View club details"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DashboardOverviewTab({ onSelectClub, onSelectDept }) {
  const { data: stats, isLoading: loadingStats } = usePrincipalStats()
  const { data: rankings, isLoading: loadingRankings } = usePrincipalRankings(5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Principal Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Institution overview, participation rankings, and event statistics.</p>
      </div>

      {/* Top 5 KPI Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total Clubs"
          value={stats?.total_clubs ?? 0}
          icon={Icons.clubs}
          accent="navy"
          isLoading={loadingStats}
        />
        <StatCard
          label="Total Departments"
          value={stats?.total_departments ?? 0}
          icon={Icons.departments}
          accent="blue"
          isLoading={loadingStats}
        />
        <StatCard
          label="Club Events Conducted"
          value={stats?.club_events_count ?? 0}
          icon={Icons.calendar}
          accent="teal"
          isLoading={loadingStats}
        />
        <StatCard
          label="Dept Events Conducted"
          value={stats?.dept_events_count ?? 0}
          icon={Icons.template}
          accent="gold"
          isLoading={loadingStats}
        />
        <StatCard
          label="This Month's Participants"
          value={stats?.this_month_participants ?? 0}
          icon={Icons.users}
          accent="green"
          isLoading={loadingStats}
        />
      </div>

      {/* Top 5 Rankings Side by Side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top 5 Clubs */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Top 5 Clubs</h2>
              <p className="text-xs text-gray-500">Ranked by cumulative student participation</p>
            </div>
            <span className="inline-flex rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-semibold text-navy">
              Top 5
            </span>
          </div>

          {loadingRankings ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-navy border-t-transparent" />
            </div>
          ) : (rankings?.top_clubs || []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No club data available yet.</p>
          ) : (
            <div className="space-y-3">
              {(rankings?.top_clubs || []).map((club, idx) => (
                <div
                  key={club.club_id || idx}
                  onClick={() => onSelectClub && onSelectClub(club.club_id)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer border border-transparent hover:border-gray-200"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      idx === 0
                        ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300'
                        : idx === 1
                        ? 'bg-slate-200 text-slate-700'
                        : idx === 2
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{club.club_name}</p>
                    <p className="text-xs text-gray-500">
                      {club.event_count} completed event{club.event_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-navy">
                      {(club.total_participants || 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-gray-400">participants</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top 5 Departments */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Top 5 Departments</h2>
              <p className="text-xs text-gray-500">Ranked by cumulative student participation</p>
            </div>
            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              Top 5
            </span>
          </div>

          {loadingRankings ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-navy border-t-transparent" />
            </div>
          ) : (rankings?.top_departments || []).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No department data available yet.</p>
          ) : (
            <div className="space-y-3">
              {(rankings?.top_departments || []).map((dept, idx) => (
                <div
                  key={dept.department || idx}
                  onClick={() => onSelectDept && onSelectDept(dept.department)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer border border-transparent hover:border-gray-200"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      idx === 0
                        ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300'
                        : idx === 1
                        ? 'bg-slate-200 text-slate-700'
                        : idx === 2
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{dept.department}</p>
                    <p className="text-xs text-gray-500">
                      {dept.event_count} event{dept.event_count !== 1 ? 's' : ''} conducted
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-700">
                      {(dept.total_participants || 0).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-gray-400">participants</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feature 1: Graphical format below Top 5 rankings for both clubs and departments */}
      <ClubsAndDeptsGraphicalSection onSelectClub={onSelectClub} onSelectDept={onSelectDept} />

      {/* Feature 3: Bottom feature pin-pointing least performing clubs with graphical line chart (left) & rankings (right) */}
      <LeastPerformingClubsSection onSelectClub={onSelectClub} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Clubs Tab
// ═══════════════════════════════════════════════════════════════════════════════

function ClubsTab({ onSelectClub }) {
  const { data: clubs, isLoading } = usePrincipalClubs()

  const columns = [
    {
      key: 'club_name',
      header: 'Club Name',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <button
          type="button"
          className="text-left font-semibold text-navy hover:underline"
          onClick={() => onSelectClub(row.club_id)}
        >
          {v}
        </button>
      ),
    },
    {
      key: 'events_this_semester',
      header: 'Events This Semester',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-semibold text-indigo-700">{v ?? 0}</span>,
    },
    {
      key: 'cumulative_participants',
      header: 'Cumulative Participants',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-bold text-green-700">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'total_completed_events',
      header: 'Total Conducted',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-semibold text-gray-700">{v ?? 0}</span>,
    },
    {
      key: '_actions',
      header: 'Action',
      align: 'center',
      render: (_, row) => (
        <button
          type="button"
          className="rounded bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy/20"
          onClick={() => onSelectClub(row.club_id)}
        >
          View Details
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clubs Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          List of all clubs, events conducted this semester, and cumulative student engagement.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={clubs || []}
        isLoading={isLoading}
        emptyMessage="No clubs found."
        rowKey="club_id"
        searchable
        searchPlaceholder="Search clubs..."
        onRowClick={(row) => onSelectClub(row.club_id)}
      />
    </div>
  )
}

// ── Club Detail Modal (Events list with Date, Venue, Time, Total Participants, Report Status & View Report) ──
function ClubDetailModal({ clubId, onClose }) {
  const { data, isLoading } = usePrincipalClubEvents(clubId)
  const events = data?.events || []
  const [selectedEventReport, setSelectedEventReport] = useState(null)

  const columns = [
    { key: 'name', header: 'Event Name', sortable: true, searchKey: true, render: (v) => <span className="font-semibold">{v || '—'}</span> },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'event_time', header: 'Time', render: (v) => v || '—' },
    { key: 'venue', header: 'Venue', render: (v) => v || '—' },
    {
      key: 'participant_count',
      header: 'Participants Registered',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-bold text-green-700">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'report_status',
      header: 'Report Status',
      render: (v) => <ReportStatusBadge status={v} />,
    },
    {
      key: '_actions',
      header: 'Report / View',
      align: 'center',
      render: (_, row) => {
        if (row.report_url) {
          const reportHref = String(row.report_url).startsWith('http')
            ? row.report_url
            : `${BACKEND_URL}${row.report_url}`
          return (
            <a
              href={reportHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
              onClick={(e) => e.stopPropagation()}
            >
              📄 View Report
            </a>
          )
        }
        return (
          <button
            type="button"
            className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-200"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedEventReport(row)
            }}
          >
            Details
          </button>
        )
      },
    },
  ]

  if (!clubId) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-navy">{data?.club_name || 'Club Events'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {events.length} completed event{events.length !== 1 ? 's' : ''} conducted
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <LoadingSpinner label="Loading club events..." />
          ) : (
            <DataTable
              columns={columns}
              data={events}
              isLoading={false}
              emptyMessage="No completed events found for this club."
              rowKey="id"
              searchable
              searchPlaceholder="Search events..."
              onRowClick={(row) => {
                if (row.report_url) {
                  const href = String(row.report_url).startsWith('http')
                    ? row.report_url
                    : `${BACKEND_URL}${row.report_url}`
                  window.open(href, '_blank')
                } else {
                  setSelectedEventReport(row)
                }
              }}
            />
          )}
        </div>

        {/* Modal for event without PDF */}
        {selectedEventReport && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
            onClick={() => setSelectedEventReport(null)}
          >
            <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-foreground">{selectedEventReport.name}</h3>
                  <p className="text-xs text-gray-500">{fmtDate(selectedEventReport.event_date)} · {selectedEventReport.venue}</p>
                </div>
                <button className="btn-secondary text-xs" onClick={() => setSelectedEventReport(null)}>Close</button>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold text-gray-600">Time:</span> {selectedEventReport.event_time}</p>
                <p><span className="font-semibold text-gray-600">Category:</span> {selectedEventReport.category}</p>
                <p><span className="font-semibold text-gray-600">Participants Registered:</span> {selectedEventReport.participant_count}</p>
                <p><span className="font-semibold text-gray-600">Report Status:</span> <ReportStatusBadge status={selectedEventReport.report_status} /></p>
                {selectedEventReport.description && (
                  <div className="mt-3 p-3 bg-gray-50 rounded border text-xs text-gray-700">
                    <p className="font-semibold mb-1">Description:</p>
                    {selectedEventReport.description}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2b. Professional Societies Tab
// ═══════════════════════════════════════════════════════════════════════════════

function ProfessionalSocietiesTab({ onSelectSociety }) {
  const { data: societies, isLoading } = usePrincipalSocieties()

  const columns = [
    {
      key: 'name',
      header: 'Professional Society / Circle',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <button
          type="button"
          className="text-left font-semibold text-navy hover:underline"
          onClick={() => onSelectSociety(row.id || row.society_id)}
        >
          {v || row.society_name || '—'}
        </button>
      ),
    },
    {
      key: 'slug',
      header: 'Slug',
      render: (v) => <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono font-bold">{v}</span>,
    },
    {
      key: 'events_this_semester',
      header: 'Events This Semester',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-semibold text-indigo-700">{v ?? 0}</span>,
    },
    {
      key: 'cumulative_participants',
      header: 'Cumulative Participants',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-bold text-green-700">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'total_completed_events',
      header: 'Total Conducted',
      align: 'right',
      sortable: true,
      render: (v, row) => <span className="font-semibold text-gray-700">{v ?? row.total_conducted_events ?? 0}</span>,
    },
    {
      key: '_actions',
      header: 'Action',
      align: 'center',
      render: (_, row) => (
        <button
          type="button"
          className="rounded bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy/20"
          onClick={() => onSelectSociety(row.id || row.society_id)}
        >
          View Details
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Professional Societies</h1>
        <p className="mt-1 text-sm text-gray-500">
          List of all institutional professional societies, active circulars, and event engagement.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={societies || []}
        isLoading={isLoading}
        emptyMessage="No professional societies found."
        rowKey={(row) => row.id || row.society_id}
        searchable
        searchPlaceholder="Search professional societies..."
        onRowClick={(row) => onSelectSociety(row.id || row.society_id)}
      />
    </div>
  )
}

function SocietyDetailModal({ societyId, onClose }) {
  const { data, isLoading } = usePrincipalSocietyEvents(societyId)
  const events = data?.events || []
  const [selectedEvent, setSelectedEvent] = useState(null)

  const columns = [
    { key: 'name', header: 'Event Name', sortable: true, searchKey: true, render: (v) => <span className="font-semibold">{v || '—'}</span> },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'event_time', header: 'Time', render: (v) => v || '—' },
    { key: 'venue', header: 'Venue', render: (v) => v || '—' },
    {
      key: 'participant_count',
      header: 'Participants Registered',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-bold text-green-700">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (v) => (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          v === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
        }`}>
          {v}
        </span>
      ),
    },
    {
      key: '_actions',
      header: 'Details',
      align: 'center',
      render: (_, row) => (
        <button
          type="button"
          className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-200"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedEvent(row)
          }}
        >
          View Event
        </button>
      ),
    },
  ]

  if (!societyId) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-navy">{data?.society_name || 'Society Events'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {events.length} event{events.length !== 1 ? 's' : ''} conducted
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <LoadingSpinner label="Loading society events..." />
          ) : (
            <DataTable
              columns={columns}
              data={events}
              isLoading={false}
              emptyMessage="No events found for this professional society."
              rowKey="id"
              searchable
              searchPlaceholder="Search events..."
              onRowClick={(row) => setSelectedEvent(row)}
            />
          )}
        </div>

        {selectedEvent && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
            onClick={() => setSelectedEvent(null)}
          >
            <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-foreground">{selectedEvent.name}</h3>
                  <p className="text-xs text-gray-500">{fmtDate(selectedEvent.event_date)} · {selectedEvent.venue}</p>
                </div>
                <button className="btn-secondary text-xs" onClick={() => setSelectedEvent(null)}>Close</button>
              </div>
              <div className="space-y-2 text-sm">
                <p><span className="font-semibold text-gray-600">Time:</span> {selectedEvent.event_time || '—'}</p>
                <p><span className="font-semibold text-gray-600">Category:</span> {selectedEvent.category || '—'}</p>
                <p><span className="font-semibold text-gray-600">Participants Registered:</span> {selectedEvent.participant_count ?? 0}</p>
                <p><span className="font-semibold text-gray-600">Status:</span> {selectedEvent.status || '—'}</p>
                {selectedEvent.description && (
                  <div className="mt-3 p-3 bg-gray-50 rounded border text-xs text-gray-700">
                    <p className="font-semibold mb-1">Description:</p>
                    {selectedEvent.description}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Departments Tab
// ═══════════════════════════════════════════════════════════════════════════════

function DepartmentsTab({ onSelectDept }) {
  const { data: departments, isLoading } = usePrincipalDepartments()

  const columns = [
    {
      key: 'rank',
      header: 'Rank',
      align: 'center',
      sortable: true,
      render: (v) => (
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
            v === 1
              ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300'
              : v === 2
              ? 'bg-slate-200 text-slate-700'
              : v === 3
              ? 'bg-orange-100 text-orange-800'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {v}
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
      searchKey: true,
      render: (v) => (
        <button
          type="button"
          className="text-left font-semibold text-navy hover:underline"
          onClick={() => onSelectDept(v)}
        >
          {v}
        </button>
      ),
    },
    {
      key: 'total_events',
      header: 'Total Events Conducted',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-semibold text-navy">{v ?? 0}</span>,
    },
    {
      key: 'cumulative_participants',
      header: 'Cumulative Participants',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-bold text-green-700">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'total_certs',
      header: 'Certificates Issued',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-semibold text-gray-700">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: '_actions',
      header: 'Action',
      align: 'center',
      render: (_, row) => (
        <button
          type="button"
          className="rounded bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy/20"
          onClick={() => onSelectDept(row.department)}
        >
          View Events
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Departments Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Departmental activity rankings, events conducted, and cumulative student participation metrics.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={departments || []}
        isLoading={isLoading}
        emptyMessage="No departments found."
        rowKey="department"
        searchable
        searchPlaceholder="Search departments..."
        onRowClick={(row) => onSelectDept(row.department)}
      />
    </div>
  )
}

// ── Department Detail Modal (Department events with Date, Participants count, Cert count, and Student Details) ──
function DeptDetailModal({ departmentName, onClose }) {
  const { data, isLoading } = usePrincipalDeptEvents(departmentName)
  const events = data?.events || []
  const [selectedEventStudents, setSelectedEventStudents] = useState(null)

  const columns = [
    { key: 'name', header: 'Event Name', sortable: true, searchKey: true, render: (v) => <span className="font-semibold">{v || '—'}</span> },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'semester', header: 'Semester', render: (v) => v || '—' },
    {
      key: 'participant_count',
      header: 'Participants Count',
      align: 'right',
      sortable: true,
      render: (v) => <span className="font-bold text-green-700">{(v ?? 0).toLocaleString()}</span>,
    },
    {
      key: 'cert_count',
      header: 'Certificates Count',
      align: 'right',
      render: (v) => <span className="font-semibold text-navy">{v ?? 0}</span>,
    },
    {
      key: '_actions',
      header: 'Participants',
      align: 'center',
      render: (_, row) => (
        <button
          type="button"
          className="rounded bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy/20"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedEventStudents(row)
          }}
        >
          View Students
        </button>
      ),
    },
  ]

  const studentColumns = [
    { key: 'name', header: 'Name', sortable: true, searchKey: true, render: (v) => <span className="font-medium">{v || '—'}</span> },
    { key: 'registration_number', header: 'Reg No.', render: (v) => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'class_name', header: 'Class / Sec', render: (v) => v || '—' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role / Contribution', render: (v) => <span className="capitalize">{v || 'Participant'}</span> },
  ]

  if (!departmentName) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-navy">{departmentName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {events.length} event{events.length !== 1 ? 's' : ''} conducted by department
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading ? (
            <LoadingSpinner label="Loading department events..." />
          ) : (
            <DataTable
              columns={columns}
              data={events}
              isLoading={false}
              emptyMessage="No events found for this department."
              rowKey="id"
              searchable
              searchPlaceholder="Search department events..."
              onRowClick={(row) => setSelectedEventStudents(row)}
            />
          )}
        </div>

        {/* Nested Students Modal */}
        {selectedEventStudents && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
            onClick={() => setSelectedEventStudents(null)}
          >
            <div
              className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white p-5 shadow-2xl flex flex-col space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-foreground text-lg">{selectedEventStudents.name}</h3>
                  <p className="text-xs text-gray-500">
                    {fmtDate(selectedEventStudents.event_date)} · {departmentName} · {selectedEventStudents.students?.length || 0} participants
                  </p>
                </div>
                <button className="btn-secondary" onClick={() => setSelectedEventStudents(null)}>
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <DataTable
                  columns={studentColumns}
                  data={selectedEventStudents.students || []}
                  isLoading={false}
                  emptyMessage="No participants found for this event."
                  rowKey="id"
                  searchable
                  searchPlaceholder="Search participant..."
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Recent Events Tab
// ═══════════════════════════════════════════════════════════════════════════════

function RecentEventsTab() {
  const [eventSearch, setEventSearch] = useState('')
  const [eventSourceType, setEventSourceType] = useState('')
  const [eventSourceValue, setEventSourceValue] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)

  const debouncedEventSearch = useDebounce(eventSearch)

  const eventFilters = useMemo(() => {
    const f = {}
    if (eventSourceType) f.source_type = eventSourceType
    if (debouncedEventSearch) f.search = debouncedEventSearch
    return f
  }, [eventSourceType, debouncedEventSearch])

  const { data: eventsResp, isLoading: loadingEvents } = usePrincipalEventsOverview(eventFilters)
  const eventRows = eventsResp?.items || []

  const availableSourceNames = useMemo(
    () => [...new Set(eventRows.map((r) => r.source_name))].filter(Boolean).sort(),
    [eventRows],
  )

  const filteredEventRows = useMemo(
    () => (eventSourceValue ? eventRows.filter((r) => r.source_name === eventSourceValue) : eventRows),
    [eventRows, eventSourceValue],
  )

  const eventColumns = [
    {
      key: 'source_type',
      header: 'Source',
      render: (v) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            v === 'department' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
          }`}
        >
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
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Recent Events</h1>
        <p className="mt-1 text-sm text-gray-500">Completed events history and participant breakdown.</p>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="search"
            placeholder="Search event / club / department"
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            className="form-input"
          />
          <select
            className="form-input"
            value={eventSourceType}
            onChange={(e) => {
              setEventSourceType(e.target.value)
              setEventSourceValue('')
            }}
          >
            <option value="">All Sources</option>
            <option value="club">Club Events</option>
            <option value="department">Department Events</option>
          </select>
          {eventSourceType && (
            <select
              className="form-input"
              value={eventSourceValue}
              onChange={(e) => setEventSourceValue(e.target.value)}
            >
              <option value="">
                {eventSourceType === 'club' ? 'All Clubs' : 'All Departments'}
              </option>
              {availableSourceNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 flex items-center justify-between">
            <span>Total Events:</span>
            <span className="font-semibold text-navy">{filteredEventRows.length}</span>
          </div>
        </div>
      </div>

      <DataTable
        columns={eventColumns}
        data={filteredEventRows}
        isLoading={loadingEvents}
        emptyMessage="No events found for selected filters."
        onRowClick={(row) => setSelectedEvent(row)}
      />

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setSelectedEvent(null)}>
          <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Participant Details</h2>
                <p className="text-sm text-gray-500">{selectedEvent.event_name} · {selectedEvent.source_name}</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setSelectedEvent(null)}>Close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
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
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Student Search Tab
// ═══════════════════════════════════════════════════════════════════════════════

function StudentSearchTab({ onSelectStudent }) {
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('')
  const [batch, setBatch] = useState('')
  const [className, setClassName] = useState('')
  const [creditRangeExpression, setCreditRangeExpression] = useState('')

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
    {
      key: 'name',
      header: 'Student Name',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <button
          className="text-navy hover:underline font-semibold text-left"
          onClick={() => onSelectStudent(row.id, v)}
        >
          {v}
        </button>
      ),
    },
    { key: 'registration_number', header: 'Reg Number', render: (v) => <span className="font-mono text-xs">{v || '—'}</span> },
    { key: 'department', header: 'Department', sortable: true },
    { key: 'batch', header: 'Batch', sortable: true },
    { key: 'section', header: 'Class', sortable: true },
    { key: 'total_credits', header: 'Credit Points', sortable: true, align: 'right', render: (v) => <span className="font-bold text-green-700">{v || 0}</span> },
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
            onSelectStudent(row.id, row.name)
          }}
        >
          View Certificates
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Student Search & Certificates</h1>
        <p className="mt-1 text-sm text-gray-500">Filter students by department, batch, class, and credit range.</p>
      </div>

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
    </div>
  )
}

// ── Student Certificate Modal ────────────────────────────────────────────────
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Student Event Certificates</h2>
            <p className="text-xs text-gray-500">Verified credit points and certificates issued per semester.</p>
          </div>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>

        {loadingCerts ? (
          <LoadingSpinner label="Loading certificates..." />
        ) : (
          <>
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-sm mb-4">
              <span className="text-gray-500">Student Name:</span> <span className="font-semibold text-foreground">{studentName || '—'}</span>
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
                    <span className="text-xs font-medium text-gray-500">Total: {selectedTotal}</span>
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

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Active Members Tab (Top 10 Active Students per Batch with Filters)
// ═══════════════════════════════════════════════════════════════════════════════

function PodiumCard({ student, rank, onSelect }) {
  const isGold = rank === 1
  const isSilver = rank === 2

  const badgeConfig = isGold
    ? {
        border: 'border-amber-300 ring-2 ring-amber-100',
        bg: 'from-amber-500/10 via-amber-500/5 to-white',
        medal: '🥇',
        rankLabel: '1st Place',
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
        barColor: 'bg-gradient-to-r from-amber-400 to-amber-600',
      }
    : isSilver
    ? {
        border: 'border-slate-300 ring-2 ring-slate-100',
        bg: 'from-slate-400/10 via-slate-400/5 to-white',
        medal: '🥈',
        rankLabel: '2nd Place',
        badgeBg: 'bg-slate-200 text-slate-800 border-slate-300',
        barColor: 'bg-gradient-to-r from-slate-400 to-slate-600',
      }
    : {
        border: 'border-amber-700/30 ring-2 ring-amber-50',
        bg: 'from-amber-700/10 via-amber-700/5 to-white',
        medal: '🥉',
        rankLabel: '3rd Place',
        badgeBg: 'bg-orange-100 text-orange-900 border-orange-200',
        barColor: 'bg-gradient-to-r from-orange-400 to-amber-700',
      }

  return (
    <div
      onClick={onSelect}
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-b ${badgeConfig.bg} ${badgeConfig.border} p-5 shadow-xs transition-all hover:shadow-md cursor-pointer flex flex-col justify-between`}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${badgeConfig.badgeBg}`}>
            <span>{badgeConfig.medal}</span>
            <span>{badgeConfig.rankLabel}</span>
          </span>
          <span className="font-mono text-xs text-gray-500 font-semibold">
            {student.registration_number || '—'}
          </span>
        </div>

        <div className="mt-3">
          <h4 className="text-base font-bold text-foreground line-clamp-1 hover:text-navy">
            {student.name}
          </h4>
          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">
            {student.department} · {student.section ? `Sec ${student.section}` : ''}
          </p>
        </div>

        {/* Credit score progress bar */}
        <div className="mt-4 rounded-xl bg-white/80 p-3 border border-gray-100 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-600">Credit Score</span>
            <span className="font-black text-green-700">
              {student.total_credits} <span className="font-normal text-gray-400 text-[10px]">/ 20 pts</span>
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${badgeConfig.barColor}`}
              style={{ width: `${Math.min(100, Math.round(((student.total_credits || 0) / 20) * 100))}%` }}
            />
          </div>
        </div>

        {/* Clubs & Leadership */}
        <div className="mt-3 flex flex-wrap gap-1 min-h-[24px]">
          {student.office_bearer && (
            <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-800 ring-1 ring-purple-200">
              ★ {student.office_bearer}
            </span>
          )}
          {(student.clubs || []).slice(0, 2).map((club) => (
            <span
              key={club}
              className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-200 truncate max-w-[150px]"
            >
              {club}
            </span>
          ))}
          {(student.clubs || []).length > 2 && (
            <span className="text-[10px] text-gray-400 font-medium self-center">
              +{(student.clubs || []).length - 2} more
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100/80 flex items-center justify-between">
        <span className="text-[11px] text-gray-400">Batch {student.batch}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSelect()
          }}
          className="text-xs font-bold text-navy hover:underline flex items-center gap-1"
        >
          View Record →
        </button>
      </div>
    </div>
  )
}

function ActiveMembersTab({ onSelectStudent }) {
  const [department, setDepartment] = useState('')
  const [batch, setBatch] = useState('')
  const [className, setClassName] = useState('')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('batch') // 'batch' or 'overall'

  const debouncedSearch = useDebounce(search, 300)

  const filters = useMemo(() => {
    const f = {}
    if (department) f.department = department
    if (batch) f.batch = batch
    if (className) f.className = className
    if (debouncedSearch) f.search = debouncedSearch
    return f
  }, [department, batch, className, debouncedSearch])

  const { data, isLoading } = usePrincipalActiveMembers(filters)

  const batchGroups = data?.batches || []
  const overallTop10 = data?.overall_top_10 || []
  const stats = data?.stats || {
    total_filtered_students: 0,
    highest_credits: 0,
    average_credits: 0,
    total_batches_count: 0,
  }
  const filterOptions = data?.filter_options || {
    departments: [],
    batches: [],
    classes: [],
  }

  const hasActiveFilters = Boolean(department || batch || className || search)

  const resetFilters = () => {
    setDepartment('')
    setBatch('')
    setClassName('')
    setSearch('')
  }

  const studentColumns = [
    {
      key: 'rank',
      header: 'Rank',
      align: 'center',
      render: (v) => {
        if (v === 1) {
          return (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-900 font-bold text-xs ring-2 ring-amber-300">
              🥇 1
            </span>
          )
        }
        if (v === 2) {
          return (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-800 font-bold text-xs ring-2 ring-slate-300">
              🥈 2
            </span>
          )
        }
        if (v === 3) {
          return (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-900 font-bold text-xs ring-2 ring-amber-200">
              🥉 3
            </span>
          )
        }
        return (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-700 font-semibold text-xs">
            {v}
          </span>
        )
      },
    },
    {
      key: 'name',
      header: 'Student Name',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <div>
          <button
            type="button"
            className="text-left font-bold text-navy hover:underline text-sm"
            onClick={() => onSelectStudent && onSelectStudent(row.id, v)}
          >
            {v}
          </button>
          <p className="text-[11px] text-gray-500 font-mono">{row.email || '—'}</p>
        </div>
      ),
    },
    {
      key: 'registration_number',
      header: 'Reg No.',
      render: (v) => <span className="font-mono text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{v || '—'}</span>,
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
      render: (v) => <span className="text-xs font-medium text-gray-700">{v || '—'}</span>,
    },
    {
      key: 'batch',
      header: 'Batch',
      render: (v) => <span className="inline-flex rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{v || '—'}</span>,
    },
    {
      key: 'section',
      header: 'Class / Sec',
      render: (v) => <span className="text-xs font-semibold text-gray-600">{v || '—'}</span>,
    },
    {
      key: 'total_credits',
      header: 'Credit Points',
      align: 'right',
      sortable: true,
      render: (v) => (
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-green-700">{v || 0}</span>
            <span className="text-[10px] text-gray-400">/ 20 pts</span>
          </div>
          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                (v || 0) >= 20 ? 'bg-green-600' : (v || 0) >= 10 ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, Math.round(((v || 0) / 20) * 100))}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'clubs',
      header: 'Club Affiliations',
      render: (v) => {
        const clubs = Array.isArray(v) ? v : []
        if (!clubs.length) return <span className="text-xs text-gray-400 italic">None</span>
        return (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {clubs.map((c) => (
              <span key={c} className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-200">
                {c}
              </span>
            ))}
          </div>
        )
      },
    },
    {
      key: 'office_bearer',
      header: 'Leadership',
      render: (v) => {
        if (!v) return <span className="text-xs text-gray-400">—</span>
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 ring-1 ring-purple-200">
            ★ {v}
          </span>
        )
      },
    },
    {
      key: '_actions',
      header: 'Action',
      align: 'center',
      render: (_, row) => (
        <button
          type="button"
          className="rounded bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy/20 transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onSelectStudent && onSelectStudent(row.id, row.name)
          }}
        >
          View Record
        </button>
      ),
    },
  ]

  const overallColumns = [
    {
      key: 'overall_rank',
      header: 'Overall Rank',
      align: 'center',
      render: (v) => {
        if (v === 1) {
          return (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-900 font-bold text-xs ring-2 ring-amber-300">
              🥇 1
            </span>
          )
        }
        if (v === 2) {
          return (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-slate-800 font-bold text-xs ring-2 ring-slate-300">
              🥈 2
            </span>
          )
        }
        if (v === 3) {
          return (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 text-amber-900 font-bold text-xs ring-2 ring-amber-200">
              🥉 3
            </span>
          )
        }
        return (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-100 text-gray-700 font-semibold text-xs">
            {v}
          </span>
        )
      },
    },
    ...studentColumns.slice(1),
  ]

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-foreground">Active Members — Batch Rankings</h1>
            <span className="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-bold text-blue-800">
              Top 10 per Batch
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Evaluating the top 10 most active students per academic batch based on verified credit points and club contributions.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="inline-flex rounded-xl bg-gray-100 p-1 text-xs font-semibold shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('batch')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              viewMode === 'batch'
                ? 'bg-white text-navy shadow-xs font-bold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            🏫 Grouped by Batch
          </button>
          <button
            type="button"
            onClick={() => setViewMode('overall')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              viewMode === 'overall'
                ? 'bg-white text-navy shadow-xs font-bold'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            🏆 Overall Top 10
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Active Students Filtered"
          value={stats.total_filtered_students}
          icon={Icons.users}
          accent="navy"
          isLoading={isLoading}
        />
        <StatCard
          label="Batches Tracked"
          value={stats.total_batches_count}
          icon={Icons.calendar}
          accent="blue"
          isLoading={isLoading}
        />
        <StatCard
          label="Highest Credit Score"
          value={`${stats.highest_credits} pts`}
          icon={Icons.template}
          accent="gold"
          isLoading={isLoading}
        />
        <StatCard
          label="Average Credit Score"
          value={`${stats.average_credits} pts`}
          icon={Icons.departments}
          accent="teal"
          isLoading={isLoading}
        />
        <StatCard
          label="Institutional Goal"
          value="20 pts"
          icon={Icons.clubs}
          accent="green"
          isLoading={false}
        />
      </div>

      {/* Filter Options Bar */}
      <div className="card p-4 space-y-3 bg-white/95 backdrop-blur-sm border border-gray-200/80 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
            <span>🔍 Filter Active Members</span>
            {hasActiveFilters && (
              <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] font-bold text-navy">
                Filters Active
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline"
            >
              Reset All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Department Filter */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="form-input text-xs w-full"
            >
              <option value="">All Departments</option>
              {filterOptions.departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Batch Filter */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Batch</label>
            <select
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className="form-input text-xs w-full"
            >
              <option value="">All Batches</option>
              {filterOptions.batches.map((b) => (
                <option key={b} value={b}>
                  Batch {b}
                </option>
              ))}
            </select>
          </div>

          {/* Class / Section Filter */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Class / Section</label>
            <select
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="form-input text-xs w-full"
            >
              <option value="">All Classes / Sections</option>
              {filterOptions.classes.map((c) => (
                <option key={c} value={c}>
                  Section {c}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Search Student</label>
            <input
              type="search"
              placeholder="Name, Reg No, or Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input text-xs w-full"
            >
            </input>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner label="Loading active student records..." />
        </div>
      ) : viewMode === 'overall' ? (
        /* Overall Top 10 View */
        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground">🏆 Institution-Wide Top 10 Active Students</h2>
              <p className="text-xs text-gray-500">Highest credit point earners across all academic batches</p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
              Campus Champions
            </span>
          </div>

          {/* Top 3 Podium Cards */}
          {overallTop10.length >= 3 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <PodiumCard
                student={overallTop10[0]}
                rank={1}
                onSelect={() => onSelectStudent && onSelectStudent(overallTop10[0].id, overallTop10[0].name)}
              />
              <PodiumCard
                student={overallTop10[1]}
                rank={2}
                onSelect={() => onSelectStudent && onSelectStudent(overallTop10[1].id, overallTop10[1].name)}
              />
              <PodiumCard
                student={overallTop10[2]}
                rank={3}
                onSelect={() => onSelectStudent && onSelectStudent(overallTop10[2].id, overallTop10[2].name)}
              />
            </div>
          )}

          <div className="pt-2">
            <DataTable
              columns={overallColumns}
              data={overallTop10}
              isLoading={false}
              emptyMessage="No active students match the selected filters."
              rowKey="id"
              onRowClick={(row) => onSelectStudent && onSelectStudent(row.id, row.name)}
            />
          </div>
        </div>
      ) : batchGroups.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xl">
            🔍
          </div>
          <h3 className="text-base font-bold text-foreground">No Active Students Found</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            No students match the criteria for the specified department, batch, or class. Try adjusting or clearing your filters.
          </p>
          {hasActiveFilters && (
            <button type="button" onClick={resetFilters} className="btn-secondary text-xs">
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        /* Batch-by-Batch Groups (Top 10 per batch) */
        <div className="space-y-8">
          {batchGroups.map((group) => {
            const top3 = group.top_students.slice(0, 3)

            return (
              <div
                key={group.batch}
                className="card p-5 space-y-5 border border-gray-200/90 shadow-xs hover:border-gray-300 transition-colors"
              >
                {/* Batch Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white font-bold text-sm shadow-xs">
                      {group.batch}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-foreground">Batch {group.batch}</h2>
                        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          {group.total_students} student{group.total_students !== 1 ? 's' : ''} enrolled
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Top 10 active student leaders ranked by cumulative credit achievement.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-amber-800 font-medium">
                      ⭐ Top Score: <strong>{group.highest_credits} pts</strong>
                    </span>
                    <span className="rounded-lg bg-gray-50 border border-gray-200 px-2.5 py-1 text-gray-700 font-medium">
                      📊 Batch Avg: <strong>{group.average_credits} pts</strong>
                    </span>
                  </div>
                </div>

                {/* Top 3 Podium Highlights for this Batch */}
                {top3.length >= 3 && (
                  <div>
                    <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
                      🏅 Batch {group.batch} Podium Leaders
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <PodiumCard
                        student={top3[0]}
                        rank={1}
                        onSelect={() => onSelectStudent && onSelectStudent(top3[0].id, top3[0].name)}
                      />
                      <PodiumCard
                        student={top3[1]}
                        rank={2}
                        onSelect={() => onSelectStudent && onSelectStudent(top3[1].id, top3[1].name)}
                      />
                      <PodiumCard
                        student={top3[2]}
                        rank={3}
                        onSelect={() => onSelectStudent && onSelectStudent(top3[2].id, top3[2].name)}
                      />
                    </div>
                  </div>
                )}

                {/* Top 10 Table for this Batch */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                      📋 Top 10 Roster — Batch {group.batch}
                    </h3>
                    <span className="text-[11px] text-gray-400">
                      Showing top {group.top_students.length} students
                    </span>
                  </div>

                  <DataTable
                    columns={studentColumns}
                    data={group.top_students}
                    isLoading={false}
                    emptyMessage={`No active students found for Batch ${group.batch}.`}
                    rowKey="id"
                    onRowClick={(row) => onSelectStudent && onSelectStudent(row.id, row.name)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Principal Dashboard Page
// ═══════════════════════════════════════════════════════════════════════════════

export default function PrincipalDashboard() {
  const [searchParams] = useSearchParams()

  // Determine active tab from URL query params (tab or view)
  const tabParam = searchParams.get('tab') || searchParams.get('view') || 'dashboard'

  // Selected entities for modals
  const [selectedClubId, setSelectedClubId] = useState(null)
  const [selectedSocietyId, setSelectedSocietyId] = useState(null)
  const [selectedDepartmentName, setSelectedDepartmentName] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [selectedStudentName, setSelectedStudentName] = useState(null)

  const renderContent = () => {
    switch (tabParam) {
      case 'clubs':
        return <ClubsTab onSelectClub={(id) => setSelectedClubId(id)} />
      case 'professional-societies':
      case 'professional_societies':
        return <ProfessionalSocietiesTab onSelectSociety={(id) => setSelectedSocietyId(id)} />
      case 'departments':
        return <DepartmentsTab onSelectDept={(name) => setSelectedDepartmentName(name)} />
      case 'recent-events':
        return <RecentEventsTab />
      case 'student-search':
        return (
          <StudentSearchTab
            onSelectStudent={(id, name) => {
              setSelectedStudentId(id)
              setSelectedStudentName(name)
            }}
          />
        )
      case 'active-members':
      case 'active_members':
        return (
          <ActiveMembersTab
            onSelectStudent={(id, name) => {
              setSelectedStudentId(id)
              setSelectedStudentName(name)
            }}
          />
        )
      case 'dashboard':
      default:
        return (
          <DashboardOverviewTab
            onSelectClub={(id) => setSelectedClubId(id)}
            onSelectDept={(name) => setSelectedDepartmentName(name)}
          />
        )
    }
  }

  return (
    <>
      <Navbar />
      <div className="flex items-start">
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-[calc(100dvh-3.5rem)] bg-background">
          <div className="page-container space-y-6">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Club Drilldown Modal */}
      {selectedClubId && (
        <ClubDetailModal
          clubId={selectedClubId}
          onClose={() => setSelectedClubId(null)}
        />
      )}

      {/* Professional Society Drilldown Modal */}
      {selectedSocietyId && (
        <SocietyDetailModal
          societyId={selectedSocietyId}
          onClose={() => setSelectedSocietyId(null)}
        />
      )}

      {/* Department Drilldown Modal */}
      {selectedDepartmentName && (
        <DeptDetailModal
          departmentName={selectedDepartmentName}
          onClose={() => setSelectedDepartmentName(null)}
        />
      )}

      {/* Student Certificates Detail Modal */}
      {selectedStudentId && (
        <StudentDetailModal
          studentId={selectedStudentId}
          studentName={selectedStudentName}
          onClose={() => {
            setSelectedStudentId(null)
            setSelectedStudentName(null)
          }}
        />
      )}
    </>
  )
}
