import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import QRCode from 'qrcode'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import StatCard from '../../components/StatCard'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import ConfirmModal from '../../components/ConfirmModal'
import FileUpload from '../../components/FileUpload'
import {
  useClubDashboard,
  useClubAssets,
  useUpdateClubAssets,
  useMembershipRequests,
  useUpdateMembershipStatus,
  useClubOfficeBearers,
  useAllocateOfficeBearer,
  useRemoveOfficeBearer,
  useAddOfficeBearerPosition,
  useDeleteOfficeBearerPosition,
  useClubActiveMembers,
  useBulkApproveMemberships,
  useRemoveClubMember,
  useDeleteMembershipRequest,
} from './api'
import { useCreateEvent, useDeleteEvent, useEvents } from './eventsApi'
import { useGenerateAttendanceQR } from './attendanceApi'
import { useAuthStore } from '../../store/authStore'
import { useToastStore } from '../../store/uiStore'
import { useChangePassword } from '../auth/api'
import axiosInstance from '../../utils/axiosInstance'
import { BACKEND_URL } from '../../utils/axiosInstance'

// ── Tab ids ───────────────────────────────────────────────────────────────────
const TABS = ['events', 'active_members', 'members', 'office_bearers', 'settings']

export const SESSION_SLOTS = {
  'Morning (FN)': ['8:45 AM - 10:15 AM', '10:30 AM - 12:00 PM', 'Other'],
  'Afternoon (AN)': ['1:10 PM - 2:50 PM', '3:05 PM - 4:45 PM', 'Other'],
}

export const EVENT_CATEGORIES = [
  'Workshop',
  'Technical Talk',
  'Technical Event',
  'Non-Technical Event',
  'Hackathon',
  'Other',
]

export const VENUE_OPTIONS = [
  'E2 Seminar Hall',
  'E3 EEE Seminar Hall',
  'E4 ECE Seminar Hall',
  'E5 CIVIL Seminar Hall',
  'E6 MECH Seminar Hall',
  'E8 Seminar Hall',
  'iTech Square',
  'Convention Center',
  'Kalai Arangam',
  'Outdoor Sports Complex',
  'Other',
]

const TAB_LABELS = {
  events: 'Professional Societies Dashboard',
  active_members: 'Active Members',
  members: 'Membership Requests',
  office_bearers: 'Office Bearers',
  settings: 'Settings',
}


// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isEventDay(iso) {
  if (!iso) return false
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }
  const formatter = new Intl.DateTimeFormat('en-CA', options) // returns YYYY-MM-DD
  const todayStr = formatter.format(new Date())
  if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso.trim())) {
    return todayStr === iso.trim()
  }
  const eventDate = new Date(iso)
  if (Number.isNaN(eventDate.getTime())) return false
  const eventStr = formatter.format(eventDate)
  return todayStr === eventStr
}

// ── Icon helpers ──────────────────────────────────────────────────────────────
const Icon = {
  events: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  certs: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard tab
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardTab({ societyId, clubId: propClubId, dashboard, isLoading }) {
  const clubId = societyId || propClubId
  const navigate = useNavigate()
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  const { data: events, isLoading: eventsLoading } = useEvents(clubId)
  const createEvent = useCreateEvent(clubId)
  const deleteEvent = useDeleteEvent(clubId)
  const generateQR = useGenerateAttendanceQR(clubId, null) // eventId set per-call
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // ── QR Modal state ───────────────────────────────────────────────────────
  const [qrModal, setQrModal] = useState(null)
  // qrModal shape: { eventId, eventName, payload, issuedAt, expiresIn, qrDataUrl, secondsLeft, expired, generationsCount }
  const qrTimerRef = useRef(null)
  const qrCanvasRef = useRef(null)

  const openQRModal = useCallback(async (row) => {
    try {
      const { data } = await axiosInstance.post(
        `/societies/${clubId}/events/${row.id ?? row._id}/generate-qr`
      )
      const dataUrl = await QRCode.toDataURL(data.payload, {
        width: 720,
        margin: 2,
        color: { dark: '#1E3A5F', light: '#FFFFFF' },
      })
      setQrModal({
        eventId: row.id ?? row._id,
        eventName: row.name,
        payload: data.payload,
        issuedAt: data.issued_at,
        expiresIn: data.expires_in,
        qrDataUrl: dataUrl,
        secondsLeft: data.expires_in,
        generationsCount: data.qr_generations_count ?? 1,
        expired: false,
      })
      // Refresh event list to update generations count live
      qc.invalidateQueries({ queryKey: ['events', 'list', clubId] })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to generate QR.'
      addToast({ type: 'error', message: msg })
      console.error(msg)
    }
  }, [clubId, qc, addToast])

  // Count-down timer
  useEffect(() => {
    if (!qrModal) return undefined
    if (qrModal.expired) return undefined
    qrTimerRef.current = setInterval(() => {
      setQrModal((prev) => {
        if (!prev) return null
        const next = prev.secondsLeft - 1
        if (next <= 0) {
          clearInterval(qrTimerRef.current)
          return { ...prev, secondsLeft: 0, expired: true }
        }
        return { ...prev, secondsLeft: next }
      })
    }, 1000)
    return () => clearInterval(qrTimerRef.current)
  }, [qrModal?.eventId, qrModal?.issuedAt]) // restart when a new QR is generated

  useEffect(() => {
    if (!isModalOpen) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prevOverflow }
  }, [isModalOpen])

  const [selectedAcademicYears, setSelectedAcademicYears] = useState([])
  const [acadYearError, setAcadYearError] = useState('')
  const [selectedPosterFile, setSelectedPosterFile] = useState(null)
  const [posterError, setPosterError] = useState('')
  const [selectedVenueOption, setSelectedVenueOption] = useState('')
  const [customVenue, setCustomVenue] = useState('')
  const [selectedSlotOption, setSelectedSlotOption] = useState('8:45 AM - 10:15 AM')
  const [customSlot, setCustomSlot] = useState('')

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting, errors } } = useForm({
    defaultValues: {
      session_type: 'Morning (FN)',
      slot: '8:45 AM - 10:15 AM',
      timing: '',
      venue: '',
      is_team_event: false,
      min_team_size: 2,
      max_team_size: 4,
      max_teams: '',
      volunteers_required: 0,
    },
  })

  const selectedSessionType = watch('session_type') || 'Morning (FN)'
  const availableSlots = SESSION_SLOTS[selectedSessionType] || SESSION_SLOTS['Morning (FN)']

  useEffect(() => {
    if (selectedSlotOption !== 'Other') {
      const validSlots = availableSlots.filter((s) => s !== 'Other')
      if (!validSlots.includes(selectedSlotOption)) {
        const next = validSlots[0] || '8:45 AM - 10:15 AM'
        setSelectedSlotOption(next)
        setValue('slot', next)
      }
    }
  }, [selectedSessionType, availableSlots, selectedSlotOption, setValue])

  const handleAcadYearToggle = (year) => {
    setSelectedAcademicYears((prev) => {
      const next = prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
      if (next.length > 0) setAcadYearError('')
      return next
    })
  }

  const handlePosterChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      setSelectedPosterFile(null)
      setPosterError('')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setPosterError('Poster size must be 2MB or less.')
      setSelectedPosterFile(null)
      e.target.value = ''
      return
    }
    setPosterError('')
    setSelectedPosterFile(file)
  }

  const onSubmit = async (data) => {
    if (selectedAcademicYears.length === 0) {
      setAcadYearError('Please select at least one academic year')
      return
    }
    if (selectedPosterFile && selectedPosterFile.size > 2 * 1024 * 1024) {
      setPosterError('Poster size must be 2MB or less.')
      return
    }

    const sessionCode = data.session_type?.includes('AN') ? 'AN' : 'FN'
    const finalSlot = selectedSlotOption === 'Other' ? customSlot.trim() : (data.slot || selectedSlotOption)
    const eventTimeStr = finalSlot ? `${data.session_type} | ${finalSlot}` : data.session_type

    const payload = {
      ...data,
      max_teams: data.is_team_event && data.max_teams ? parseInt(data.max_teams, 10) : null,
      session: sessionCode,
      slot: finalSlot,
      event_time: eventTimeStr,
      academic_years: selectedAcademicYears,
      academic_year: selectedAcademicYears.join(', '),
    }

    createEvent.mutate(payload, {
      onSuccess: async (res) => {
        const event = res?.data ?? res
        const eventId = event.id ?? event._id
        if (selectedPosterFile && eventId) {
          const formData = new FormData()
          formData.append('poster', selectedPosterFile)
          try {
            await axiosInstance.post(`/societies/${clubId}/events/${eventId}/poster`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            })
          } catch (e) {
            console.error('Poster upload failed', e)
          }
        }
        setIsModalOpen(false)
        reset()
        setSelectedSlotOption('8:45 AM - 10:15 AM')
        setCustomSlot('')
        setSelectedVenueOption('')
        setCustomVenue('')
        setSelectedAcademicYears([])
        setSelectedPosterFile(null)
        setAcadYearError('')
        setPosterError('')
        navigate(`/society/${clubId}/events/${eventId}`)
      },
    })
  }

  const handleDelete = () => {
    deleteEvent.mutate(deleteTarget.id ?? deleteTarget._id, {
      onSuccess: () => setDeleteTarget(null)
    })
  }

  if (isLoading || eventsLoading) return <LoadingSpinner fullPage label="Loading dashboard…" />

  const club = dashboard?.society || (dashboard?.name ? dashboard : null) || dashboard?.club || {}
  const eventRows = Array.isArray(events) ? events : []
  
  const now = new Date()
  const currentMonth = now.getMonth() // 0-indexed: 6 is July
  const semStart = currentMonth >= 6 ? new Date(now.getFullYear(), 6, 1) : new Date(now.getFullYear(), 0, 1)
  const semEnd = currentMonth >= 6 ? new Date(now.getFullYear(), 11, 31, 23, 59, 59) : new Date(now.getFullYear(), 5, 30, 23, 59, 59)

  const completedEvents = eventRows.filter((e) => e?.status === 'completed' || (Number(e?.cert_count ?? 0) > 0 && e?.status !== 'draft'))
  const eventsThisSemesterCount = dashboard?.stats?.events_this_semester ?? completedEvents.filter((e) => {
    if (!e?.event_date) return false
    const d = new Date(e.event_date)
    return d >= semStart && d <= semEnd
  }).length
  const cumulativeEventsCount = dashboard?.stats?.cumulative_events ?? completedEvents.length
  const totalCertificatesIssued = dashboard?.stats?.total_certificates_issued ?? eventRows.reduce((sum, event) => sum + Number(event?.cert_count ?? 0), 0)

  const recentEvents = [...eventRows].sort((a, b) => {
    const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0
    return bTime - aTime
  })

  const handleStatusChange = async (eventId, newStatus) => {
    try {
      await axiosInstance.patch(`/societies/${clubId}/events/${eventId}`, {
        status: newStatus,
      })
      qc.invalidateQueries({ queryKey: ['events', 'list', clubId] })
      qc.invalidateQueries({ queryKey: ['events', clubId, eventId] })
      qc.invalidateQueries({ queryKey: ['societies', clubId, 'dashboard'] })
      addToast({ type: 'success', message: `Event status updated to ${newStatus}.` })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to update event status.'
      addToast({ type: 'error', message: msg })
    }
  }

  const eventColumns = [
    { key: 'name', header: 'Event', sortable: true, searchKey: true,
      render: (v, row) => (
        <div className="flex flex-col items-start gap-1">
          <button
            className="text-sm font-semibold text-navy hover:underline text-left"
            onClick={() => navigate(`/society/${clubId}/events/${row.id ?? row._id}`)}
          >
            {v}
          </button>
          {row.is_team_event && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
              👥 Team ({row.min_team_size || 2}-{row.max_team_size || 4})
            </span>
          )}
        </div>
      )
    },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    {
      key: 'status',
      header: 'Status',
      render: (v, row) => {
        const currentStatus = (row.status || 'draft').toLowerCase()
        return (
          <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
            <select
              value={currentStatus}
              onChange={(e) => {
                const newStatus = e.target.value
                handleStatusChange(row.id ?? row._id, newStatus)
              }}
              className={`text-xs font-semibold rounded-full px-2.5 py-1 border-0 cursor-pointer shadow-sm transition-all focus:ring-2 focus:ring-navy focus:outline-none ${
                currentStatus === 'active'
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : currentStatus === 'completed'
                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                  : currentStatus === 'closed'
                  ? 'bg-red-100 text-red-800 hover:bg-red-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Click to change event status"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        )
      },
    },
    {
      key: 'participant_count',
      header: 'Participants / Teams',
      align: 'right',
      render: (v, row) => (
        <span className="font-medium">
          {row.is_team_event ? (
            <>
              {(row.team_count ?? 0).toLocaleString()}
              {row.max_teams ? (
                <span className="text-gray-400 font-normal"> / {row.max_teams} teams</span>
              ) : (
                <span className="text-gray-400 font-normal"> teams</span>
              )}
            </>
          ) : (
            <>
              {(v ?? 0).toLocaleString()}
              {row.max_participants ? (
                <span className="text-gray-400 font-normal"> / {row.max_participants}</span>
              ) : null}
            </>
          )}
        </span>
      ),
    },
    { key: 'cert_count', header: 'Certs Issued', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
    { key: '_actions', header: 'Actions', align: 'center', searchKey: false, render: (_, row) => (
      <div className="flex justify-center gap-2">
        <button onClick={() => navigate(`/society/${clubId}/events/${row.id ?? row._id}`)} className="text-navy hover:bg-gray-100 p-1.5 rounded" title="Open">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
        {/* Generate QR — visible ONLY on the date of event for active events */}
        {(() => {
          const isToday = isEventDay(row.event_date)
          if (!isToday || row.status !== 'active') return null

          const genCount = row.qr_generations_count ?? 0
          const genLeft = Math.max(0, 3 - genCount)
          const isDisabled = genLeft <= 0

          return (
            <div className="flex flex-col items-center justify-center">
              <button
                onClick={() => openQRModal(row)}
                disabled={isDisabled}
                className={`p-1.5 rounded transition-colors ${
                  isDisabled
                    ? 'text-gray-400 bg-gray-100/70 cursor-not-allowed'
                    : 'text-indigo-600 hover:bg-indigo-50 cursor-pointer'
                }`}
                title={
                  isDisabled
                    ? 'Maximum QR generation limit (3/3) reached'
                    : 'Generate Attendance QR'
                }
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </button>
              <span className={`text-[10px] font-medium leading-tight whitespace-nowrap ${
                isDisabled ? 'text-gray-400' : 'text-indigo-600'
              }`}>
                {genLeft}/3 available
              </span>
            </div>
          )
        })()}
        <button onClick={() => setDeleteTarget(row)} className="text-red-500 hover:bg-red-50 p-1.5 rounded" title="Delete">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    )},
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{club.name || 'Professional Societies Dashboard'}</h1>
          {club.slug && <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono font-bold text-navy">{club.slug}</span>}
        </div>
        <button
          className="btn-primary"
          onClick={() => setIsModalOpen(true)}
        >
          + New Event
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Events Completed (This Semester)" value={eventsThisSemesterCount} icon={Icon.events} accent="navy" />
        <StatCard label="Cumulative Events Completed" value={cumulativeEventsCount} icon={Icon.events} accent="navy" />
        <StatCard label="Certificates Issued" value={totalCertificatesIssued} icon={Icon.certs} accent="green" />
      </div>

      {/* Events table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Events</h2>
        </div>
        <DataTable
          columns={eventColumns}
          data={recentEvents}
          isLoading={false}
          emptyMessage="No events yet. Click '+ New Event' to create one."
          rowKey="id"
          searchable
          searchPlaceholder="Search events…"
        />
      </div>

      {/* Create Event Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-lg font-bold text-navy">Create New Event</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="Close modal">×</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="form-label" htmlFor="dash-event-name">Event Name *</label>
                <input id="dash-event-name" type="text" className={`form-input ${errors.name ? 'form-input-error' : ''}`} placeholder="e.g. AI & Robotics Hackathon 2026" {...register('name', { required: 'Event name is required' })} />
                {errors.name && <p className="form-error">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label" htmlFor="dash-event-date">Event Date *</label>
                  <input
                    id="dash-event-date"
                    type="date"
                    className={`form-input ${errors.event_date ? 'form-input-error' : ''}`}
                    {...register('event_date', { required: 'Event date is required' })}
                  />
                  {errors.event_date && <p className="form-error">{errors.event_date.message}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="dash-event-time">Event Session *</label>
                  <select
                    id="dash-event-time"
                    className="form-input"
                    {...register('session_type', { required: 'Event session is required' })}
                  >
                    <option value="Morning (FN)">Morning (FN)</option>
                    <option value="Afternoon (AN)">Afternoon (AN)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label" htmlFor="dash-event-slot">Event Slot / Timing *</label>
                  <select
                    id="dash-event-slot"
                    className="form-input"
                    value={selectedSlotOption}
                    onChange={(e) => {
                      const val = e.target.value
                      setSelectedSlotOption(val)
                      if (val !== 'Other') {
                        setValue('slot', val, { shouldValidate: true })
                        setCustomSlot('')
                      } else {
                        setValue('slot', customSlot.trim(), { shouldValidate: true })
                      }
                    }}
                  >
                    {availableSlots.map((s) => (
                      <option key={s} value={s}>
                        {s === 'Other' ? 'Others (Custom Timing)' : s}
                      </option>
                    ))}
                  </select>
                  {selectedSlotOption === 'Other' && (
                    <input
                      type="text"
                      className="form-input text-xs mt-2"
                      placeholder="Enter custom timing (e.g. 9:00 AM - 1:00 PM)"
                      value={customSlot}
                      onChange={(e) => {
                        const val = e.target.value
                        setCustomSlot(val)
                        setValue('slot', val.trim(), { shouldValidate: true })
                      }}
                      required
                      autoFocus
                    />
                  )}
                  {errors.slot && <p className="form-error">{errors.slot.message}</p>}
                </div>
                <div>
                  <label className="form-label" htmlFor="dash-venue-select">Venue *</label>
                  <select
                    id="dash-venue-select"
                    className={`form-input ${errors.venue ? 'form-input-error' : ''}`}
                    value={selectedVenueOption}
                    onChange={(e) => {
                      const val = e.target.value
                      setSelectedVenueOption(val)
                      if (val !== 'Other') {
                        setValue('venue', val, { shouldValidate: true })
                      } else {
                        setValue('venue', customVenue.trim(), { shouldValidate: true })
                      }
                    }}
                  >
                    <option value="">Select venue</option>
                    {VENUE_OPTIONS.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  {selectedVenueOption === 'Other' && (
                    <div className="mt-2">
                      <input
                        id="dash-venue-custom"
                        type="text"
                        className={`form-input ${errors.venue ? 'form-input-error' : ''}`}
                        placeholder="Type custom venue…"
                        value={customVenue}
                        onChange={(e) => {
                          const val = e.target.value
                          setCustomVenue(val)
                          setValue('venue', val.trim(), { shouldValidate: true })
                        }}
                        autoFocus
                      />
                    </div>
                  )}
                  <input type="hidden" {...register('venue', { required: 'Venue is required' })} />
                  {errors.venue && <p className="form-error">{errors.venue.message || 'Venue is required'}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label" htmlFor="dash-category">Category</label>
                  <select id="dash-category" className="form-input" {...register('category')}>
                    <option value="">Select category</option>
                    {EVENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor="dash-max-participants">Max Participants (Optional)</label>
                  <input
                    id="dash-max-participants"
                    type="number"
                    min="1"
                    className={`form-input ${errors.max_participants ? "form-input-error" : ""}`}
                    placeholder="e.g. 50 (leave empty for unlimited)"
                    onWheel={(e) => e.target.blur()}
                    {...register("max_participants", {
                      setValueAs: v => (v === "" || v == null || isNaN(v)) ? null : parseInt(v, 10),
                      min: { value: 1, message: "Must be at least 1" }
                    })}
                  />
                  {errors.max_participants && <p className="form-error">{errors.max_participants.message}</p>}
                  <p className="mt-1 text-[11px] text-gray-400">
                    Registration automatically closes when this limit is reached.
                  </p>
                </div>
                <div>
                  <label className="form-label" htmlFor="dash-volunteers-required">Volunteers Required (Optional)</label>
                  <input
                    id="dash-volunteers-required"
                    type="number"
                    min="0"
                    className={`form-input ${errors.volunteers_required ? 'form-input-error' : ''}`}
                    placeholder="0 (no volunteers needed)"
                    onWheel={(e) => e.target.blur()}
                    {...register('volunteers_required', {
                      setValueAs: (v) => (v === '' || v == null ? 0 : Number(v)),
                      min: { value: 0, message: 'Cannot be negative' }
                    })}
                  />
                  {errors.volunteers_required && <p className="form-error">{errors.volunteers_required.message}</p>}
                </div>
              </div>

              {/* Participation Mode */}
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-2.5">
                <label className="form-label mb-1">Participation Type *</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                    <input
                      type="radio"
                      name="club_participation_type"
                      checked={!watch('is_team_event')}
                      onChange={() => setValue('is_team_event', false)}
                      className="text-navy focus:ring-navy h-4 w-4"
                    />
                    <span>👤 Individual (Solo)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                    <input
                      type="radio"
                      name="club_participation_type"
                      checked={!!watch('is_team_event')}
                      onChange={() => setValue('is_team_event', true)}
                      className="text-navy focus:ring-navy h-4 w-4"
                    />
                    <span>👥 Team Event</span>
                  </label>
                </div>

                {watch('is_team_event') && (
                  <div className="pt-2 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="form-label text-xs">Min Team Size *</label>
                      <input
                        type="number"
                        min={2}
                        className="form-input text-xs"
                        {...register('min_team_size', {
                          valueAsNumber: true,
                          min: { value: 2, message: 'Minimum 2 members' },
                        })}
                      />
                      {errors.min_team_size && <p className="form-error">{errors.min_team_size.message}</p>}
                    </div>
                    <div>
                      <label className="form-label text-xs">Max Team Size *</label>
                      <input
                        type="number"
                        min={watch('min_team_size') || 2}
                        className="form-input text-xs"
                        {...register('max_team_size', {
                          valueAsNumber: true,
                          min: { value: 2, message: 'Minimum 2 members' },
                        })}
                      />
                      {errors.max_team_size && <p className="form-error">{errors.max_team_size.message}</p>}
                    </div>
                    <div>
                      <label className="form-label text-xs">Max Teams (Optional)</label>
                      <input
                        type="number"
                        min={1}
                        className="form-input text-xs"
                        placeholder="e.g. 10 (unlimited)"
                        onWheel={(e) => e.target.blur()}
                        {...register('max_teams', {
                          setValueAs: v => (v === "" || v == null || isNaN(v)) ? null : parseInt(v, 10),
                          min: { value: 1, message: 'Must be at least 1' }
                        })}
                      />
                      {errors.max_teams && <p className="form-error">{errors.max_teams.message}</p>}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="form-label">Academic Year (Select all applicable) *</label>
                <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3">
                  {['2026-2027(ODD)', '2026-2027(EVEN)'].map((year) => (
                    <label key={year} className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
                      <input
                        type="checkbox"
                        checked={selectedAcademicYears.includes(year)}
                        onChange={() => handleAcadYearToggle(year)}
                        className="h-4 w-4 rounded border-gray-300 text-navy focus:ring-navy"
                      />
                      <span>{year}</span>
                    </label>
                  ))}
                </div>
                {acadYearError && <p className="form-error mt-1">{acadYearError}</p>}
              </div>

              <div>
                <label className="form-label" htmlFor="dash-description">Description *</label>
                <textarea
                  id="dash-description"
                  className={`form-input ${errors.description ? 'form-input-error' : ''}`}
                  rows={2}
                  placeholder="Detailed description of the event…"
                  {...register('description', { required: 'Description is required' })}
                />
                {errors.description && <p className="form-error">{errors.description.message}</p>}
              </div>

              {/* Event Poster Upload */}
              <div className="space-y-1">
                <label className="form-label" htmlFor="dash-event-poster">
                  Event Poster (PNG, JPEG, PDF • Max 2MB)
                </label>
                <input
                  id="dash-event-poster"
                  type="file"
                  accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                  onChange={handlePosterChange}
                  className="form-input text-xs"
                />
                <p className="text-[11px] text-gray-500">
                  Accepted formats: PNG, JPEG, PDF. Maximum image/file size is 2MB. Displayed on Student & Student Affairs feeds.
                </p>
                {posterError && <p className="form-error">{posterError}</p>}
                {selectedPosterFile && (
                  <p className="text-xs font-medium text-navy mt-1">
                    ✓ Selected: {selectedPosterFile.name} ({(selectedPosterFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="dash-is-published"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-navy focus:ring-navy"
                  {...register('is_published')}
                />
                <label htmlFor="dash-is-published" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Publish to Upcoming Events (visible on Student & Student Affairs dashboards)
                </label>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => { setIsModalOpen(false); reset() }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting || createEvent.isPending} className="btn-primary">
                  {(isSubmitting || createEvent.isPending) ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Event"
        message={`Are you sure you want to delete '${deleteTarget?.name}'? This will remove all associated certificates and history.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isLoading={deleteEvent.isPending}
      />

      {/* ── Attendance QR Modal ─────────────────────────────────────────── */}
      {qrModal && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6"
          onClick={() => { clearInterval(qrTimerRef.current); setQrModal(null) }}
        >
          <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm" aria-hidden="true" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl lg:max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col my-auto max-h-[95vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-6 py-4 flex items-center justify-between shrink-0 ${
              qrModal.expired ? 'bg-gray-100' : 'bg-navy'
            }`}>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider ${
                  qrModal.expired ? 'text-gray-500' : 'text-white/70'
                }`}>Attendance QR</p>
                <h3 className={`text-lg sm:text-xl font-bold ${
                  qrModal.expired ? 'text-gray-700' : 'text-white'
                } line-clamp-1`}>{qrModal.eventName}</h3>
              </div>
              <button
                onClick={() => { clearInterval(qrTimerRef.current); setQrModal(null) }}
                className={`text-2xl font-bold leading-none p-1 ${
                  qrModal.expired ? 'text-gray-400 hover:text-gray-600' : 'text-white/70 hover:text-white'
                }`}
              >
                ×
              </button>
            </div>

            {/* QR image area (scaled 3x to fit screen comfortably) */}
            <div className="flex flex-col items-center py-5 px-4 sm:px-8 gap-4 overflow-y-auto">
              <div className={`relative rounded-2xl overflow-hidden border-4 bg-white p-3 shadow-md ${
                qrModal.expired ? 'border-gray-300 opacity-40 grayscale' : 'border-navy/20'
              }`}>
                <img
                  src={qrModal.qrDataUrl}
                  alt="Attendance QR Code"
                  className="w-[min(82vw,620px)] h-[min(82vw,620px)] max-h-[58vh] object-contain select-none"
                />
                {qrModal.expired && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/85 backdrop-blur-2xs">
                    <span className="text-3xl sm:text-4xl font-black text-gray-500 tracking-widest rotate-[-12deg] border-4 border-gray-400 rounded-xl px-6 py-2 shadow-lg">
                      EXPIRED
                    </span>
                  </div>
                )}
              </div>

              {/* Countdown / status badge */}
              {qrModal.expired ? (
                <div className="flex flex-col items-center gap-2 w-full max-w-[620px]">
                  <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-5 py-2 text-base font-bold text-red-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    QR Expired
                  </span>
                  <p className="text-xs sm:text-sm text-gray-500 text-center">
                    {(qrModal.generationsCount ?? 1) >= 3
                      ? 'Maximum QR generation limit (3/3) reached for this event.'
                      : 'Generate a new QR for students to scan.'}
                  </p>
                  {(qrModal.generationsCount ?? 1) < 3 ? (
                    <button
                      type="button"
                      onClick={() => openQRModal({ id: qrModal.eventId, name: qrModal.eventName })}
                      className="w-full btn-primary justify-center mt-1 py-2.5 text-sm"
                    >
                      🔄 Generate New QR ({3 - (qrModal.generationsCount ?? 1)} remaining)
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full btn-secondary justify-center mt-1 opacity-50 cursor-not-allowed text-xs py-2"
                    >
                      Generation Limit Reached (3/3)
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2.5 w-full max-w-[620px]">
                  <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-5 py-2 text-base font-bold text-green-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                    Active — {qrModal.secondsLeft}s remaining
                  </span>
                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${
                        qrModal.secondsLeft > 15 ? 'bg-green-500' :
                        qrModal.secondsLeft > 5  ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(0, (qrModal.secondsLeft / (qrModal.expiresIn || 60)) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs sm:text-sm text-gray-500 text-center">
                    Show this QR to students. It expires automatically in {qrModal.secondsLeft} second{qrModal.secondsLeft !== 1 ? 's' : ''}.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}



// ═══════════════════════════════════════════════════════════════════════════════
// Members tab
// ═══════════════════════════════════════════════════════════════════════════════
function MembersTab() {
  const { data: requests, isLoading } = useMembershipRequests()
  const updateStatus = useUpdateMembershipStatus()
  const bulkApprove = useBulkApproveMemberships()
  const deleteMembership = useDeleteMembershipRequest()
  const [notes, setNotes] = useState({})
  const [selectedRequestIds, setSelectedRequestIds] = useState([])
  const [requestToDelete, setRequestToDelete] = useState(null)

  const pending = (requests || []).filter((r) => r.status === 'pending')
  const reviewed = (requests || []).filter((r) => r.status !== 'pending')
  const pendingIds = pending.map((req) => req.id)
  const selectedPendingIds = selectedRequestIds.filter((id) => pendingIds.includes(id))
  const allPendingSelected = pending.length > 0 && selectedPendingIds.length === pending.length

  const toggleRequestSelection = (membershipId) => {
    setSelectedRequestIds((ids) => (
      ids.includes(membershipId)
        ? ids.filter((id) => id !== membershipId)
        : [...ids, membershipId]
    ))
  }

  const toggleSelectAll = () => {
    setSelectedRequestIds(allPendingSelected ? [] : pendingIds)
  }

  const removeSelection = (membershipId) => {
    setSelectedRequestIds((ids) => ids.filter((id) => id !== membershipId))
  }

  if (isLoading) return <LoadingSpinner fullPage label="Loading membership requests…" />

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="section-title">Pending Requests ({pending.length})</h2>
          {pending.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={toggleSelectAll}
                disabled={updateStatus.isPending || bulkApprove.isPending || deleteMembership.isPending}
              >
                {allPendingSelected ? 'Deselect all' : 'Select all'}
              </button>
              <button
                type="button"
                className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={selectedPendingIds.length === 0 || updateStatus.isPending || bulkApprove.isPending || deleteMembership.isPending}
                onClick={() => {
                  bulkApprove.mutate(
                    { membershipIds: selectedPendingIds },
                    { onSuccess: () => setSelectedRequestIds([]) },
                  )
                }}
              >
                {bulkApprove.isPending ? 'Approving…' : `Approve selected${selectedPendingIds.length ? ` (${selectedPendingIds.length})` : ''}`}
              </button>
            </div>
          )}
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400">No pending membership requests.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {pending.map((req) => (
              <div key={req.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <input
                    id={`select-request-${req.id}`}
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-navy focus:ring-navy"
                    checked={selectedPendingIds.includes(req.id)}
                    disabled={updateStatus.isPending || bulkApprove.isPending || deleteMembership.isPending}
                    onChange={() => toggleRequestSelection(req.id)}
                    aria-label={`Select ${req.student_name || req.student_email || 'membership request'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{req.student_name || '—'}</p>
                    <p className="text-xs text-gray-400">{req.student_email}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Applied {req.applied_at ? new Date(req.applied_at).toLocaleDateString('en-IN') : '—'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1.5 sm:items-end">
                  <input
                    type="text"
                    placeholder="Optional note…"
                    className="form-input h-8 text-xs w-48"
                    value={notes[req.id] || ''}
                    onChange={(e) => setNotes((p) => ({ ...p, [req.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button
                      id={`approve-${req.id}`}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                      disabled={updateStatus.isPending || bulkApprove.isPending || deleteMembership.isPending}
                      onClick={() => updateStatus.mutate(
                        { membershipId: req.id, status: 'approved', review_note: notes[req.id] || undefined },
                        { onSuccess: () => removeSelection(req.id) },
                      )}
                    >
                      Approve
                    </button>
                    <button
                      id={`reject-${req.id}`}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      disabled={updateStatus.isPending || bulkApprove.isPending || deleteMembership.isPending}
                      onClick={() => updateStatus.mutate(
                        { membershipId: req.id, status: 'rejected', review_note: notes[req.id] || undefined },
                        { onSuccess: () => removeSelection(req.id) },
                      )}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                      disabled={updateStatus.isPending || bulkApprove.isPending || deleteMembership.isPending}
                      onClick={() => setRequestToDelete(req)}
                      title="Delete this request"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewed.length > 0 && (
        <div className="card p-5">
          <h2 className="section-title mb-4">Reviewed Requests</h2>
          <div className="divide-y divide-gray-100">
            {reviewed.map((req) => (
              <div key={req.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{req.student_name || '—'}</p>
                    {req.office_bearer_role && (
                      <span className="rounded bg-navy/10 px-2 py-0.5 text-xs font-semibold text-navy">
                        {req.office_bearer_role}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{req.student_email}</p>
                  {req.review_note && <p className="text-xs text-gray-500 mt-0.5">{req.review_note}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    req.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {req.status}
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-red-200 bg-red-50/50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors flex items-center gap-1"
                    onClick={() => setRequestToDelete(req)}
                    disabled={deleteMembership.isPending}
                    title={req.status === 'approved' ? 'Remove member from society' : 'Delete request'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>{req.status === 'approved' ? 'Remove Member' : 'Delete'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirmation Modal for removing/deleting member or request */}
      <ConfirmModal
        isOpen={!!requestToDelete}
        onClose={() => setRequestToDelete(null)}
        onConfirm={() => {
          if (!requestToDelete?.id) return
          deleteMembership.mutate(requestToDelete.id, {
            onSuccess: () => {
              removeSelection(requestToDelete.id)
              setRequestToDelete(null)
            },
          })
        }}
        title={requestToDelete?.status === 'approved' ? 'Remove Society Member?' : 'Delete Membership Request?'}
        message={
          requestToDelete?.status === 'approved'
            ? `Are you sure you want to remove ${requestToDelete?.student_name || 'this student'} (${requestToDelete?.student_email}) from ${requestToDelete?.society_name || requestToDelete?.club_name || 'the professional society'}? Their membership and any associated society role will be revoked.`
            : `Are you sure you want to delete the membership request for ${requestToDelete?.student_name || 'this student'} (${requestToDelete?.student_email})?`
        }
        confirmLabel={requestToDelete?.status === 'approved' ? 'Remove Member' : 'Delete'}
        isLoading={deleteMembership.isPending}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Active Members tab
// ═══════════════════════════════════════════════════════════════════════════════
function ActiveMembersTab() {
  const { data, isLoading } = useClubActiveMembers()
  const removeMember = useRemoveClubMember()
  const [memberToRemove, setMemberToRemove] = useState(null)

  if (isLoading) return <LoadingSpinner fullPage label="Loading active members…" />

  const members = data?.members || []
  const totalEvents = data?.total_events || 0
  const totalApproved = data?.total_approved_members || 0
  const totalStudents = data?.total_students || 0

  const columns = [
    { key: 'name', header: 'Name', sortable: true, searchKey: true,
      render: (v) => <span className="text-sm font-semibold text-foreground">{v || '—'}</span>
    },
    { key: 'registration_number', header: 'Register Number', sortable: true, searchKey: true,
      render: (v) => <span className="text-sm text-gray-600 font-mono">{v || '—'}</span>
    },
    { key: 'department', header: 'Department', sortable: true, searchKey: true,
      render: (v) => <span className="text-sm text-gray-600">{v || '—'}</span>
    },
    { key: 'email', header: 'Email ID', sortable: true, searchKey: true,
      render: (v) => <span className="text-sm text-gray-600">{v || '—'}</span>
    },
    { key: 'membership_status', header: 'Membership Status', sortable: true,
      render: (v) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
          v === 'Yes'
            ? 'bg-green-50 text-green-700 ring-green-600/20'
            : 'bg-red-50 text-red-600 ring-red-500/20'
        }`}>
          {v}
        </span>
      )
    },
    { key: 'participation_ratio', header: 'Participation', sortable: false, align: 'center',
      render: (v, row) => {
        const pct = row.participation_percentage || 0
        const barColor = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : pct >= 25 ? 'bg-orange-500' : 'bg-red-400'
        return (
          <div className="flex flex-col items-center gap-1 min-w-[100px]">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${
              pct >= 50 ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'
            }`}>
              {v}
            </span>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-0.5">
              <div className={`h-1.5 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-[10px] text-gray-500 font-medium">{pct}%</span>
          </div>
        )
      }
    },
    { key: 'actions', header: 'Actions', sortable: false, searchKey: false, align: 'right',
      render: (_, row) => row.membership_id ? (
        <button
          type="button"
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => setMemberToRemove(row)}
          disabled={removeMember.isPending}
        >
          Remove member
        </button>
      ) : (
        <span className="text-xs text-gray-400">Not a member</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Active Members</h1>
        <p className="text-sm text-gray-500 mt-1">
          Student participation overview for this professional society. Participation is calculated as events participated, won, or coordinated out of total society events.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Society Events" value={totalEvents} icon={Icon.events} accent="navy" />
        <StatCard label="Approved Members" value={totalApproved} icon={Icon.certs} accent="green" />
        <StatCard
          label="Students Listed"
          value={totalStudents}
          icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
          accent="navy"
        />
      </div>

      {/* Data table */}
      <DataTable
        columns={columns}
        data={members}
        isLoading={false}
        emptyMessage="No students found for this society."
        rowKey="email"
        searchable
        searchPlaceholder="Search by name, register number, department, or email…"
      />

      <ConfirmModal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={() => {
          if (!memberToRemove?.membership_id) return
          removeMember.mutate(memberToRemove.membership_id, {
            onSuccess: () => setMemberToRemove(null),
          })
        }}
        title="Remove club member?"
        message={`Remove ${memberToRemove?.name || 'this student'} from this club? Their club membership will be removed from the student and related dashboards.`}
        confirmLabel="Remove member"
        isLoading={removeMember.isPending}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Office Bearers tab
// ═══════════════════════════════════════════════════════════════════════════════
function OfficeBearersTab() {
  const { data, isLoading } = useClubOfficeBearers()
  const allocateMutation = useAllocateOfficeBearer()
  const removeMutation = useRemoveOfficeBearer()
  const addPositionMutation = useAddOfficeBearerPosition()
  const deletePositionMutation = useDeleteOfficeBearerPosition()

  const [activeModalRole, setActiveModalRole] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [showAddPositionModal, setShowAddPositionModal] = useState(false)
  const [newPositionName, setNewPositionName] = useState('')
  const [deleteConfirmPos, setDeleteConfirmPos] = useState(null)

  if (isLoading) return <LoadingSpinner fullPage label="Loading office bearer allocations…" />

  const positions = data?.positions || ['President', 'Vice President', 'Secretary', 'Joint Secretary', 'Treasurer']
  const allocations = data?.allocations || {}
  const approvedMembers = data?.approved_members || []

  const handleOpenModal = (role) => {
    setActiveModalRole(role)
    const currentHolder = allocations[role]
    setSelectedStudentId(currentHolder ? currentHolder.student_id : '')
  }

  const handleAllocateSubmit = (e) => {
    e.preventDefault()
    if (!selectedStudentId) return
    allocateMutation.mutate(
      { position: activeModalRole, student_id: selectedStudentId },
      { onSuccess: () => setActiveModalRole(null) }
    )
  }

  const handleAddPosition = (e) => {
    e.preventDefault()
    const trimmed = (newPositionName || '').trim()
    if (!trimmed) return
    addPositionMutation.mutate(trimmed, {
      onSuccess: () => {
        setNewPositionName('')
        setShowAddPositionModal(false)
      }
    })
  }

  const handleDeletePosition = () => {
    if (!deleteConfirmPos) return
    deletePositionMutation.mutate(deleteConfirmPos, {
      onSuccess: () => setDeleteConfirmPos(null)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Club Office Bearers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Allocate office bearer roles for your club. A student can hold an office bearer role in at most one club and position.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowAddPositionModal(true)}
        >
          + Add Position
        </button>
      </div>

      {/* Informational Guidance Callout */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 sm:p-5 shadow-xs space-y-2.5">
        <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
          <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Important Guidelines for Office Bearer Allocation</span>
        </div>
        <ul className="text-xs sm:text-sm text-blue-950/80 space-y-2 list-disc list-inside leading-relaxed pl-1">
          <li>
            <strong className="text-blue-900">Mandatory Club Membership:</strong> To be appointed as an Office Bearer, the student <span className="font-semibold underline decoration-blue-400">must first be an approved active member</span> of this club. If the student has not yet joined, they must submit a membership request and have it approved under the <em>Membership Requests</em> tab before they can be allocated to an office bearer role.
          </li>
          <li>
            <strong className="text-blue-900">Handling Multiple Positions of the Same Role:</strong> Each position slot can hold only one student. If your club has multiple members serving in the same capacity (for example, 4 Event Coordinators or 2 Joint Secretaries), create uniquely identified positions like <span className="inline-flex font-mono font-semibold bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-800">Event Coordinator 1</span>, <span className="inline-flex font-mono font-semibold bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-800">Event Coordinator 2</span>, <span className="inline-flex font-mono font-semibold bg-white px-1.5 py-0.5 rounded border border-blue-200 text-blue-800">Event Coordinator 3</span>, etc., using the <strong className="text-blue-900">+ Add Position</strong> button, and assign each student to their respective designated position.
          </li>
          <li>
            <strong className="text-blue-900">Single Office Bearer Rule:</strong> A student is permitted to hold an office bearer role in <strong className="text-blue-900">at most one professional society and one position</strong> across the entire institution.
          </li>
        </ul>
      </div>

      {/* Grid of positions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {positions.map((pos) => {
          const holder = allocations[pos]
          return (
            <div key={pos} className="card p-5 flex flex-col justify-between space-y-4 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-navy bg-navy/5 px-2.5 py-1 rounded-md">
                    {pos}
                  </span>
                  {holder ? (
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                      Allocated
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      Not Allocated
                    </span>
                  )}
                </div>

                {holder ? (
                  <div className="pt-2 space-y-1">
                    <p className="text-base font-bold text-foreground">{holder.name || '—'}</p>
                    <p className="text-xs text-gray-500">{holder.email}</p>
                    <div className="pt-1 flex flex-wrap gap-2 text-xs text-gray-600 font-mono">
                      {holder.registration_number && (
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded">{holder.registration_number}</span>
                      )}
                      {holder.department && (
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded">{holder.department}</span>
                      )}
                      {holder.batch && (
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded">{holder.batch}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-sm text-gray-400 italic">No member assigned to this position yet.</p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenModal(pos)}
                  className="flex-1 rounded-md bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 transition-colors"
                >
                  {holder ? 'Change Member' : 'Allocate Member'}
                </button>
                {holder && (
                  <button
                    type="button"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(pos)}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Remove
                  </button>
                )}
                <button
                  type="button"
                  disabled={deletePositionMutation.isPending}
                  onClick={() => setDeleteConfirmPos(pos)}
                  title="Delete this position"
                  className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Allocation Modal */}
      {activeModalRole && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setActiveModalRole(null)}>
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy">Allocate {activeModalRole}</h3>
              <button onClick={() => setActiveModalRole(null)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
            </div>
            <form onSubmit={handleAllocateSubmit} className="p-6 space-y-4">
              <div>
                <label className="form-label mb-0.5" htmlFor="student-select">
                  Select Approved Society Member *
                </label>
                <p className="text-[11px] text-gray-500 mb-1.5">
                  Only approved society members are eligible to be allocated as office bearers.
                </p>
                {approvedMembers.length === 0 ? (
                  <p className="text-sm text-red-500 mt-1">
                    No approved society members available. Please approve student membership requests first.
                  </p>
                ) : (
                  <select
                    id="student-select"
                    className="form-input text-sm"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose a student --</option>
                    {approvedMembers.map((mem) => {
                      const isCurrentRole = mem.office_bearer_role === activeModalRole
                      const isOtherRole = mem.office_bearer_role && !isCurrentRole
                      return (
                        <option key={mem.student_id} value={mem.student_id} disabled={isOtherRole}>
                          {mem.name} ({mem.registration_number || mem.email})
                          {isCurrentRole ? ' - Currently Assigned' : isOtherRole ? ` - (${mem.office_bearer_role})` : ''}
                        </option>
                      )
                    })}
                  </select>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveModalRole(null)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedStudentId || allocateMutation.isPending}
                  className="btn-primary"
                >
                  {allocateMutation.isPending ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add Position Modal */}
      {showAddPositionModal && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowAddPositionModal(false)}>
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" aria-hidden="true" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy">Add New Position</h3>
              <button onClick={() => setShowAddPositionModal(false)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
            </div>
            <form onSubmit={handleAddPosition} className="p-6 space-y-4">
              <div>
                <label className="form-label" htmlFor="new-position-name">Position Name *</label>
                <input
                  id="new-position-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Event Coordinator 1"
                  value={newPositionName}
                  onChange={(e) => setNewPositionName(e.target.value)}
                  required
                />
                <p className="mt-2 text-xs text-gray-500 leading-relaxed bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  💡 <strong>Tip:</strong> If multiple members hold the same role title (e.g. 4 Event Coordinators), assign distinct numbered positions like <em>Event Coordinator 1</em>, <em>Event Coordinator 2</em>, etc., and assign each student to their position.
                </p>
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => { setShowAddPositionModal(false); setNewPositionName('') }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={!newPositionName.trim() || addPositionMutation.isPending} className="btn-primary">
                  {addPositionMutation.isPending ? 'Adding...' : 'Add Position'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Position Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmPos}
        onClose={() => setDeleteConfirmPos(null)}
        title="Delete Position"
        message={`Are you sure you want to delete the "${deleteConfirmPos}" position? Any assigned member will be unassigned.`}
        confirmLabel="Delete"
        onConfirm={handleDeletePosition}
        isLoading={deletePositionMutation.isPending}
      />
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// Settings tab
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsTab({ club, clubId, clubLoading, dashboardError, missingClubAssignment }) {
  const changePassword = useChangePassword()
  const { data: assetState, isLoading: assetsLoading } = useClubAssets(clubId)
  const updateAssets = useUpdateClubAssets(clubId)

  const [logoFile, setLogoFile] = useState(null)
  const [signatureFile, setSignatureFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [sigPreview, setSigPreview] = useState(null)

  const toAssetSrc = (url, hash) => {
    if (!url) return null
    const withVersion = hash ? `${url}${url.includes('?') ? '&' : '?'}v=${hash}` : url
    if (withVersion.startsWith('blob:') || withVersion.startsWith('http')) return withVersion
    return `${BACKEND_URL}${withVersion}`
  }

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(toAssetSrc(assetState?.logo_url, assetState?.logo_hash))
      return undefined
    }
    const objectUrl = URL.createObjectURL(logoFile)
    setLogoPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [logoFile, assetState?.logo_url, assetState?.logo_hash])

  useEffect(() => {
    if (!signatureFile) {
      setSigPreview(toAssetSrc(assetState?.signature_url, assetState?.signature_hash))
      return undefined
    }
    const objectUrl = URL.createObjectURL(signatureFile)
    setSigPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [signatureFile, assetState?.signature_url, assetState?.signature_hash])

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({ defaultValues: { current_password: '', new_password: '', confirm_password: '' } })

  const onSubmit = (values) => {
    changePassword.mutate(
      { current_password: values.current_password, new_password: values.new_password },
      { onSuccess: () => reset() },
    )
  }

  const onAssetSubmit = async () => {
    if (!logoFile && !signatureFile) return
    await updateAssets.mutateAsync({ logoFile, signatureFile })
    setLogoFile(null)
    setSignatureFile(null)
  }

  if (clubLoading) return <LoadingSpinner fullPage label="Loading society info…" />

  return (
    <div className="space-y-8">
      {(missingClubAssignment || dashboardError) && (
        <div className="max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {missingClubAssignment
            ? 'Your account is not linked to a professional society yet. Ask Super Admin to assign a professional society to this coordinator account.'
            : (dashboardError?.response?.data?.detail || 'Unable to load society information. Check your society access and URL.')} 
        </div>
      )}

      {/* Club info (read-only) */}
      <div className="max-w-2xl">
        <h2 className="section-title mb-3">Society Information</h2>
        <div className="card divide-y divide-gray-100 overflow-hidden">
          {[
            ['Society Name', club?.name],
            ['Slug', club?.slug],
            ['Contact Email', club?.contact_email],
            ['Created', fmtDate(club?.created_at)],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-5 py-4">
              <span className="text-sm font-medium text-gray-500">{label}</span>
              <span className="text-sm text-foreground font-semibold">{value ?? '—'}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">Contact admin to make changes.</p>
      </div>

      {/* Logo + signature */}
      <div className="max-w-3xl">
        <h2 className="section-title mb-3">Logo and Signature</h2>
        {assetsLoading ? (
          <LoadingSpinner label="Loading current assets…" />
        ) : (
          <div className="card p-5 space-y-5">
            <p className="text-sm text-gray-500">
              Upload your society logo and faculty coordinator signature. These assets are reused in certificates.
            </p>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Society Logo</p>
                {logoPreview && (
                  <img
                    src={logoPreview}
                    alt="Society logo preview"
                    className="h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50 p-2"
                  />
                )}
                <FileUpload
                  id="society-logo-upload"
                  accept="image/*"
                  label="Drop logo here"
                  hint="PNG / JPG / SVG, max 5 MB"
                  maxSizeMB={5}
                  onFile={setLogoFile}
                />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Faculty Signature</p>
                {sigPreview && (
                  <img
                    src={sigPreview}
                    alt="Signature preview"
                    className="h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50 p-2"
                  />
                )}
                <FileUpload
                  id="society-signature-upload"
                  accept="image/*"
                  label="Drop signature here"
                  hint="PNG / JPG, max 5 MB"
                  maxSizeMB={5}
                  onFile={setSignatureFile}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={onAssetSubmit}
              disabled={updateAssets.isPending || (!logoFile && !signatureFile)}
            >
              {updateAssets.isPending ? <LoadingSpinner size="sm" label="" /> : 'Update Logo/Signature'}
            </button>
          </div>
        )}
      </div>

      {/* Change password */}
      <div className="max-w-lg">
        <h2 className="section-title mb-3">Change Password</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="card p-5 space-y-4">
          <div>
            <label className="form-label">Current Password *</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                className={`form-input pr-14 ${errors.current_password ? 'form-input-error' : ''}`}
                {...register('current_password', { required: 'Required' })}
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                {showCurrent ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.current_password && <p className="form-error">{errors.current_password.message}</p>}
          </div>
          <div>
            <label className="form-label">New Password *</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                className={`form-input pr-14 ${errors.new_password ? 'form-input-error' : ''}`}
                {...register('new_password', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })}
              />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                {showNew ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.new_password && <p className="form-error">{errors.new_password.message}</p>}
          </div>
          <div>
            <label className="form-label">Confirm New Password *</label>
            <input
              type="password"
              className={`form-input ${errors.confirm_password ? 'form-input-error' : ''}`}
              {...register('confirm_password', {
                required: 'Required',
                validate: (v) => v === watch('new_password') || 'Passwords do not match',
              })}
            />
            {errors.confirm_password && <p className="form-error">{errors.confirm_password.message}</p>}
          </div>
          <button type="submit" className="btn-primary" disabled={changePassword.isPending}>
            {changePassword.isPending ? <LoadingSpinner size="sm" label="" /> : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ClubDashboard (main export)
// ═══════════════════════════════════════════════════════════════════════════════
export default function ProfessionalSocietyDashboard() {
  const navigate = useNavigate()
  const { society_id, club_id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const requiresProfileSetup = useAuthStore((s) => s.requires_profile_setup)
  const role = useAuthStore((s) => s.role)
  const authClubId = useAuthStore((s) => s.society_id || s.club_id)
  const setAuth = useAuthStore((s) => s.setAuth)

  const normalizedRole = String(role || '').trim().toLowerCase().replace(/\s+/g, '_')
  const isClubCoordinator = normalizedRole === 'professional_society_coordinator' || normalizedRole === 'club_coordinator'

  const isValidHexId = (val) => Boolean(val && val !== 'null' && val !== 'undefined' && /^[a-f\d]{24}$/i.test(String(val)))

  const effectiveClubId = isClubCoordinator && isValidHexId(authClubId)
    ? authClubId
    : (isValidHexId(society_id) ? society_id : (isValidHexId(club_id) ? club_id : null))

  const activeTab = TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'events'

  const setTab = (tab) =>
    setSearchParams({ tab }, { replace: true })

  const { data: dashboard, isLoading: dashLoading, error: dashboardError } = useClubDashboard(effectiveClubId)
  const club = dashboard?.club || null
  const missingClubAssignment = isClubCoordinator && !effectiveClubId

  useEffect(() => {
    if (isClubCoordinator && isValidHexId(authClubId) && (!isValidHexId(society_id) || authClubId !== society_id)) {
      navigate(`/society/${authClubId}`, { replace: true })
    }
  }, [isClubCoordinator, authClubId, society_id, navigate])

  useEffect(() => {
    // Refresh persisted auth snapshot so dashboard uses the latest club assignment.
    if (!isClubCoordinator) return
    let cancelled = false

    ;(async () => {
      try {
        const { data } = await axiosInstance.get('/auth/me')
        if (!cancelled && data?.role) {
          setAuth(data)
          const sid = data.society_id || (data.role === 'professional_society_coordinator' ? data.club_id : null)
          if (sid && isValidHexId(sid) && (!isValidHexId(society_id) || society_id !== sid)) {
            navigate(`/society/${sid}`, { replace: true })
          }
        }
      } catch {
        // ProtectedRoute will handle auth failures.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isClubCoordinator, setAuth, society_id, navigate])

  useEffect(() => {
    if (requiresProfileSetup && activeTab !== 'settings') {
      setSearchParams({ tab: 'settings' }, { replace: true })
    }
  }, [requiresProfileSetup, activeTab, setSearchParams])

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container">
            {/* Society identity header */}
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-foreground">
                Professional Societies Dashboard
              </h1>
              {club?.name && (
                <p className="mt-1 text-sm font-semibold text-navy">{club.name} {club.slug ? `(${club.slug})` : ''}</p>
              )}
            </div>

            {/* Tab bar */}
            <div className="mb-6 flex gap-1 border-b border-gray-200">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  id={`society-tab-${tab}`}
                  onClick={() => setTab(tab)}
                  className={`
                    relative px-4 py-2.5 text-sm font-medium capitalize transition-colors
                    ${activeTab === tab
                      ? 'text-navy after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-navy after:rounded-t-full'
                      : 'text-gray-500 hover:text-navy'
                    }
                  `}
                >
                  {TAB_LABELS[tab] || tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {requiresProfileSetup && (
              <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                First login setup pending. Please upload society logo and coordinator signature in Settings.
              </div>
            )}

            {missingClubAssignment && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                No professional society is assigned to this coordinator account. Contact Super Admin to assign a society.
              </div>
            )}

            {activeTab === 'events' && <DashboardTab clubId={effectiveClubId} dashboard={dashboard} isLoading={dashLoading} />}
            {activeTab === 'active_members' && <ActiveMembersTab />}
            {activeTab === 'members' && <MembersTab />}
            {activeTab === 'office_bearers' && <OfficeBearersTab />}
            {activeTab === 'settings' && (

              <SettingsTab
                club={club}
                clubId={effectiveClubId}
                clubLoading={dashLoading}
                dashboardError={dashboardError}
                missingClubAssignment={missingClubAssignment}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
