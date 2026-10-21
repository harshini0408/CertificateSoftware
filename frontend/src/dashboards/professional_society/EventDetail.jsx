import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import QRCode from 'qrcode'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import FileUpload from '../../components/FileUpload'
import LoadingSpinner from '../../components/LoadingSpinner'
import DataTable from '../../components/DataTable'
import {
  useEvent,
  eventKeys,
  useUploadPoster,
  useSocietyCreditRules,
  useVolunteerRequests,
  useUpdateVolunteerStatus,
  useUpdateVolunteerCount,
  useUpdateEvent,
} from './eventsApi'
import {
  participantKeys,
  useParticipants,
  useUpdateParticipantType,
  useVerifyParticipant,
  useDeleteParticipant,
} from './participantsApi'
import { certKeys } from './certificatesApi'
import { useToastStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'

import CertificateIssue from './CertificateIssue'
import axiosInstance, { BACKEND_URL } from '../../utils/axiosInstance'

// ── Tab ids (No report tab, report requirement completely removed) ─────────
const TABS = ['overview', 'volunteer-requests', 'participants', 'certificates']

const IST_TIMEZONE = 'Asia/Kolkata'
const HAS_TZ_RE = /(Z|[+\-]\d{2}:\d{2})$/i

function parseApiDateTime(value) {
  if (!value) return null
  const raw = String(value)
  const parsed = new Date(HAS_TZ_RE.test(raw) ? raw : `${raw}Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDateTime(value) {
  const dt = parseApiDateTime(value)
  if (!dt) return '—'
  return dt.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: IST_TIMEZONE,
  })
}

function formatDateOnly(value) {
  if (!value) return '—'
  const raw = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }
  const dt = parseApiDateTime(raw)
  if (!dt) return '—'
  return dt.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: IST_TIMEZONE,
  })
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

// ─────────────────────────────────────────────────────────────────────────────
// Overview Tab (NO event report section)
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ event, societyId, eventId, onNextStep }) {
  const logoPreview = event?.assets?.logo_url ?? null
  const sigPreview = event?.assets?.signature_url ?? null
  const uploadPoster = useUploadPoster(societyId, eventId)
  const updateEvent = useUpdateEvent(societyId, eventId)
  const [selectedPosterFile, setSelectedPosterFile] = useState(null)

  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  // QR Modal state
  const [qrModal, setQrModal] = useState(null)
  const qrTimerRef = useRef(null)

  const openQRModal = useCallback(async () => {
    try {
      const { data } = await axiosInstance.post(
        `/societies/${societyId}/events/${eventId}/generate-qr`
      )
      const dataUrl = await QRCode.toDataURL(data.payload, {
        width: 720,
        margin: 2,
        color: { dark: '#1E3A5F', light: '#FFFFFF' },
      })
      setQrModal({
        eventId,
        eventName: event?.name,
        payload: data.payload,
        issuedAt: data.issued_at,
        expiresIn: data.expires_in,
        qrDataUrl: dataUrl,
        secondsLeft: data.expires_in,
        generationsCount: data.qr_generations_count ?? 1,
        expired: false,
      })
      qc.invalidateQueries({ queryKey: eventKeys.detail(societyId, eventId) })
      qc.invalidateQueries({ queryKey: eventKeys.list(societyId) })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to generate QR.'
      addToast({ type: 'error', message: msg })
      console.error(msg)
    }
  }, [societyId, eventId, event?.name, qc, addToast])

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
  }, [qrModal?.eventId, qrModal?.issuedAt])

  // Edit Details state
  const [isEditing, setIsEditing] = useState(false)
  const [editStatus, setEditStatus] = useState(event?.status || 'draft')
  const [editName, setEditName] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editSession, setEditSession] = useState('FN')
  const [editSlot, setEditSlot] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editVenue, setEditVenue] = useState('')
  const [editVenueOption, setEditVenueOption] = useState('')
  const [editCustomVenue, setEditCustomVenue] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editMaxParticipants, setEditMaxParticipants] = useState('')
  const [editIsTeamEvent, setEditIsTeamEvent] = useState(false)
  const [editMinTeamSize, setEditMinTeamSize] = useState(2)
  const [editMaxTeamSize, setEditMaxTeamSize] = useState(4)
  const [editMaxTeams, setEditMaxTeams] = useState('')

  const EDIT_SLOTS = {
    FN: ['8:45 AM - 10:15 AM', '10:30 AM - 12:00 PM'],
    AN: ['1:10 PM - 2:50 PM', '3:05 PM - 4:45 PM'],
  }

  const VENUE_OPTIONS = [
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

  const EVENT_CATEGORIES = [
    'Workshop',
    'Technical Talk',
    'Technical Event',
    'Non-Technical Event',
    'Hackathon',
    'Symposium',
    'Conference',
    'Cultural Event',
    'Sports',
    'Other',
  ]

  const startEditing = () => {
    setEditStatus(event?.status || 'draft')
    setEditName(event?.name || '')
    setEditDate(event?.event_date ? String(event.event_date).slice(0, 10) : '')
    setEditSession(event?.session || 'FN')
    setEditSlot(event?.slot || '')
    setEditTime(event?.event_time || '')
    const venue = event?.venue || ''
    setEditVenue(venue)
    if (VENUE_OPTIONS.includes(venue)) {
      setEditVenueOption(venue)
      setEditCustomVenue('')
    } else if (venue) {
      setEditVenueOption('Other')
      setEditCustomVenue(venue)
    } else {
      setEditVenueOption('')
      setEditCustomVenue('')
    }
    setEditCategory(event?.category || '')
    setEditMaxParticipants(event?.max_participants ? String(event.max_participants) : '')
    setEditIsTeamEvent(event?.is_team_event || false)
    setEditMinTeamSize(event?.min_team_size || 2)
    setEditMaxTeamSize(event?.max_team_size || 4)
    setEditMaxTeams(event?.max_teams ? String(event.max_teams) : '')
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
  }

  const handleSaveDetails = () => {
    const finalVenue = editVenueOption === 'Other' ? editCustomVenue.trim() : editVenueOption
    const payload = {
      name: editName.trim(),
      status: editStatus,
      event_date: editDate || undefined,
      session: editSession,
      slot: editSlot,
      event_time: editTime,
      venue: finalVenue,
      category: editCategory,
      max_participants: editMaxParticipants ? parseInt(editMaxParticipants, 10) : null,
      is_team_event: editIsTeamEvent,
      min_team_size: editIsTeamEvent ? parseInt(editMinTeamSize, 10) : 2,
      max_team_size: editIsTeamEvent ? parseInt(editMaxTeamSize, 10) : 4,
      max_teams: editIsTeamEvent && editMaxTeams ? parseInt(editMaxTeams, 10) : null,
    }

    updateEvent.mutate(payload, {
      onSuccess: () => setIsEditing(false),
    })
  }

  const handlePosterUpload = () => {
    if (!selectedPosterFile) return
    uploadPoster.mutate(selectedPosterFile, {
      onSuccess: () => setSelectedPosterFile(null),
    })
  }

  const toAssetSrc = (url, hash) => {
    if (!url) return null
    const base = url.startsWith('http') || url.startsWith('blob:') ? url : `${BACKEND_URL}${url}`
    return hash ? `${base}?v=${hash}` : base
  }

  return (
    <div className="space-y-6">
      {/* ── Event Details Section ────────────────────────────────────────── */}
      <section className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Event Information</h2>
          {!isEditing ? (
            <div className="flex items-center gap-2">
              {isEventDay(event?.event_date) && event?.status === 'active' && (
                <button
                  type="button"
                  onClick={openQRModal}
                  disabled={(event?.qr_generations_count ?? 0) >= 3}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${
                    (event?.qr_generations_count ?? 0) >= 3
                      ? 'opacity-50 bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 cursor-pointer shadow-xs'
                  }`}
                  title={
                    (event?.qr_generations_count ?? 0) >= 3
                      ? 'Maximum QR generation limit (3/3) reached'
                      : 'Generate Attendance QR'
                  }
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Generate QR ({Math.max(0, 3 - (event?.qr_generations_count ?? 0))}/3)
                </button>
              )}
              <button
                type="button"
                onClick={startEditing}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Details
            </button>
          </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEditing}
                disabled={updateEvent.isPending}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDetails}
                disabled={updateEvent.isPending}
                className="btn-primary text-xs px-3 py-1.5"
              >
                {updateEvent.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4 pt-2">
            <div>
              <label className="form-label text-xs">Event Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="form-input text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="form-label text-xs">Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="form-label text-xs">Session</label>
                <select
                  value={editSession}
                  onChange={(e) => {
                    setEditSession(e.target.value)
                    setEditSlot(EDIT_SLOTS[e.target.value]?.[0] || '')
                  }}
                  className="form-input text-xs"
                >
                  <option value="FN">FN (Morning)</option>
                  <option value="AN">AN (Afternoon)</option>
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Slot</label>
                <select
                  value={editSlot}
                  onChange={(e) => setEditSlot(e.target.value)}
                  className="form-input text-xs"
                >
                  {(EDIT_SLOTS[editSession] || []).map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="form-input text-xs"
                >
                  <option value="">Select category</option>
                  {EVENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label text-xs">Venue</label>
                <select
                  value={editVenueOption}
                  onChange={(e) => setEditVenueOption(e.target.value)}
                  className="form-input text-xs"
                >
                  <option value="">Select venue</option>
                  {VENUE_OPTIONS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                {editVenueOption === 'Other' && (
                  <input
                    type="text"
                    value={editCustomVenue}
                    onChange={(e) => setEditCustomVenue(e.target.value)}
                    placeholder="Enter custom venue"
                    className="form-input text-xs mt-2"
                  />
                )}
              </div>

              <div>
                <label className="form-label text-xs">Max Registrations</label>
                <input
                  type="number"
                  value={editMaxParticipants}
                  onChange={(e) => setEditMaxParticipants(e.target.value)}
                  placeholder="Unlimited if blank"
                  className="form-input text-xs"
                />
              </div>

              <div>
                <label className="form-label text-xs">Event Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="form-input text-xs"
                >
                  <option value="draft">Draft (Hidden)</option>
                  <option value="active">Active (Open)</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsTeamEvent}
                  onChange={(e) => setEditIsTeamEvent(e.target.checked)}
                  className="rounded border-gray-300 text-navy focus:ring-navy"
                />
                <span className="text-xs font-semibold text-gray-700">This is a Team Event</span>
              </label>

              {editIsTeamEvent && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-6">
                  <div>
                    <label className="form-label text-xs">Min Team Size</label>
                    <input
                      type="number"
                      min={2}
                      value={editMinTeamSize}
                      onChange={(e) => setEditMinTeamSize(e.target.value)}
                      className="form-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="form-label text-xs">Max Team Size</label>
                    <input
                      type="number"
                      min={2}
                      value={editMaxTeamSize}
                      onChange={(e) => setEditMaxTeamSize(e.target.value)}
                      className="form-input text-xs"
                    />
                  </div>
                  <div>
                    <label className="form-label text-xs">Max Teams Allowed</label>
                    <input
                      type="number"
                      min={1}
                      value={editMaxTeams}
                      onChange={(e) => setEditMaxTeams(e.target.value)}
                      placeholder="Unlimited if blank"
                      className="form-input text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Date</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {formatDateOnly(event?.event_date)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Time / Slot</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {event?.slot || event?.event_time || (event?.session ? `Session ${event.session}` : '—')}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Venue</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{event?.venue || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Category</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{event?.category || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Format</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {event?.is_team_event
                    ? `Team Event (${event.min_team_size || 2} - ${event.max_team_size || 4} members)`
                    : 'Individual Event'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Registration Cap</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {event?.is_team_event
                    ? (event?.max_teams ? `${event.max_teams} Teams Max` : 'Unlimited Teams')
                    : (event?.max_participants ? `${event.max_participants} Participants` : 'Unlimited')}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Volunteers Required</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{event?.volunteers_required ?? 0} volunteers</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <select
                    value={(event?.status || 'draft').toLowerCase()}
                    onChange={(e) => {
                      updateEvent.mutate({ status: e.target.value })
                    }}
                    disabled={updateEvent.isPending}
                    className={`text-xs font-semibold rounded-full px-2.5 py-1 border-0 cursor-pointer shadow-sm transition-all focus:ring-2 focus:ring-navy focus:outline-none ${
                      event?.status === 'active'
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : event?.status === 'completed'
                        ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        : event?.status === 'closed'
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
                </dd>
              </div>
            </dl>

            {event?.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Description</dt>
                <dd className="mt-1 text-sm text-gray-600">{event.description}</dd>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Event Poster Section ─────────────────────────────────────────── */}
      <section className="card p-6 space-y-4">
        <h2 className="section-title">Event Poster</h2>
        {event?.poster_url ? (
          <div className="space-y-3">
            <img
              src={toAssetSrc(event.poster_url, event.poster_uploaded_at)}
              alt="Event Poster"
              className="max-h-72 rounded-lg border border-gray-200 object-contain shadow-xs"
            />
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedPosterFile(e.target.files?.[0] || null)}
                className="form-input text-xs max-w-xs"
              />
              <button
                type="button"
                onClick={handlePosterUpload}
                disabled={!selectedPosterFile || uploadPoster.isPending}
                className="btn-secondary text-xs"
              >
                {uploadPoster.isPending ? 'Uploading…' : 'Replace Poster'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Upload an attractive promotional poster for this event.</p>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedPosterFile(e.target.files?.[0] || null)}
                className="form-input text-xs max-w-xs"
              />
              <button
                type="button"
                onClick={handlePosterUpload}
                disabled={!selectedPosterFile || uploadPoster.isPending}
                className="btn-primary text-xs"
              >
                {uploadPoster.isPending ? 'Uploading…' : 'Upload Poster'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Society Assets Preview ───────────────────────────────────────── */}
      <section className="card p-6 space-y-4">
        <h2 className="section-title">Professional Society Branding Assets</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Logo */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Society Logo</p>
            {logoPreview && (
              <img
                src={toAssetSrc(logoPreview, event?.assets?.logo_hash)}
                alt="Society logo preview"
                className="h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50 p-2"
              />
            )}
          </div>

          {/* Signature */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Organiser / Advisor Signature</p>
            {sigPreview && (
              <img
                src={toAssetSrc(sigPreview, event?.assets?.signature_hash)}
                alt="Signature preview"
                className="h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50 p-2"
              />
            )}
          </div>
        </div>
        <p className="mt-5 text-xs text-gray-500">
          To update your logo or signatures, visit the Settings tab on your Society Dashboard.
        </p>
      </section>

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

            {/* QR image area */}
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
                      onClick={openQRModal}
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

// ─────────────────────────────────────────────────────────────────────────────
// Volunteer Requests Tab
// ─────────────────────────────────────────────────────────────────────────────
function VolunteerRequestsTab({ societyId, eventId, event }) {
  const { data: volunteerRequests, isLoading } = useVolunteerRequests(societyId, eventId)
  const updateStatus = useUpdateVolunteerStatus(societyId, eventId)
  const updateCount = useUpdateVolunteerCount(societyId, eventId)
  const [isEditingCount, setIsEditingCount] = useState(false)
  const [countInput, setCountInput] = useState(event?.volunteers_required ?? 0)

  useEffect(() => {
    setCountInput(event?.volunteers_required ?? 0)
  }, [event?.volunteers_required])

  const requests = Array.isArray(volunteerRequests) ? volunteerRequests : []
  const acceptedCount = requests.filter((r) => r.status === 'accepted' || (r.verified && r.status !== 'rejected')).length
  const pendingCount = requests.filter((r) => r.status === 'pending' || (!r.verified && r.status !== 'rejected')).length
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length
  const volunteersRequired = event?.volunteers_required ?? 0

  const handleSaveCount = () => {
    const num = Math.max(0, parseInt(countInput, 10) || 0)
    updateCount.mutate(num, {
      onSuccess: () => setIsEditingCount(false),
    })
  }

  const columns = [
    {
      key: 'student_name',
      header: 'Student Name',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <div>
          <div className="font-semibold text-foreground">{v || row.student_email || '—'}</div>
          {row.registration_number && (
            <div className="text-xs font-mono text-gray-400">{row.registration_number}</div>
          )}
        </div>
      ),
    },
    {
      key: 'student_email',
      header: 'Email',
      sortable: true,
      searchKey: true,
      render: (v) => <span className="text-xs text-gray-600">{v}</span>,
    },
    {
      key: 'department',
      header: 'Department',
      sortable: true,
      searchKey: true,
      render: (v) => <span className="text-xs text-gray-600">{v || '—'}</span>,
    },
    {
      key: 'registered_at',
      header: 'Applied Date',
      sortable: true,
      render: (v) => <span className="text-xs text-gray-500">{formatDateTime(v)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (v, row) => {
        const isAccepted = v === 'accepted' || (row.verified && v !== 'rejected')
        const isRejected = v === 'rejected'
        if (isAccepted) {
          return (
            <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
              Accepted
            </span>
          )
        }
        if (isRejected) {
          return (
            <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
              Rejected
            </span>
          )
        }
        return (
          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            Pending Review
          </span>
        )
      },
    },
    {
      key: '_actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => {
        const isAccepted = row.status === 'accepted' || (row.verified && row.status !== 'rejected')
        const isRejected = row.status === 'rejected'
        return (
          <div className="flex items-center justify-end gap-2">
            {!isAccepted && (
              <button
                type="button"
                onClick={() => updateStatus.mutate({ itemId: row.id, status: 'accepted' })}
                disabled={updateStatus.isPending}
                className="btn-primary text-xs px-2.5 py-1"
              >
                Accept
              </button>
            )}
            {!isRejected && (
              <button
                type="button"
                onClick={() => updateStatus.mutate({ itemId: row.id, status: 'rejected' })}
                disabled={updateStatus.isPending}
                className="btn-secondary text-xs px-2.5 py-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Reject
              </button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 flex flex-col justify-between border-l-4 border-navy">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Volunteers Required</span>
            {!isEditingCount ? (
              <button
                type="button"
                onClick={() => setIsEditingCount(true)}
                className="text-xs text-navy hover:underline font-semibold"
              >
                Edit Target
              </button>
            ) : null}
          </div>
          {isEditingCount ? (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={countInput}
                onChange={(e) => setCountInput(e.target.value)}
                className="form-input text-xs w-24 py-1"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveCount}
                className="btn-primary text-xs px-2.5 py-1"
                disabled={updateCount.isPending}
              >
                {updateCount.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-navy">{volunteersRequired}</span>
              <span className="text-xs text-gray-500">slots needed</span>
            </div>
          )}
        </div>

        <div className="card p-5 flex flex-col justify-between border-l-4 border-green-500">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Accepted Volunteers</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-green-700">{acceptedCount}</span>
            <span className="text-xs text-gray-500">/ {volunteersRequired} filled</span>
          </div>
        </div>

        <div className="card p-5 flex flex-col justify-between border-l-4 border-amber-400">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Pending Requests</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600">{pendingCount}</span>
            <span className="text-xs text-gray-500">awaiting decision</span>
          </div>
        </div>
      </div>

      {/* Volunteer Requests Table */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Volunteer Requests</h2>
            <p className="text-xs text-gray-500">Review, accept, or reject student requests to volunteer for this event.</p>
          </div>
          {acceptedCount >= volunteersRequired && volunteersRequired > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              ✓ Required volunteer capacity reached
            </span>
          )}
        </div>

        <DataTable
          columns={columns}
          data={requests}
          isLoading={isLoading}
          emptyMessage="No volunteer requests received yet for this event."
          searchable
          searchPlaceholder="Search volunteer applicants…"
          rowKey="id"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Certificate Types / Role Presets (STRICTLY THE 8 REQUESTED ROLES ONLY)
// ─────────────────────────────────────────────────────────────────────────────
export const EVENT_CERT_ROLES = [
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'first_place', label: 'First Place' },
  { value: 'non_technical_participant', label: 'Non-Technical Participant' },
  { value: 'organizer', label: 'Organizer' },
  { value: 'second_place', label: 'Second Place' },
  { value: 'student_volunteer', label: 'Student Volunteer' },
  { value: 'technical_participant', label: 'Technical Participant' },
  { value: 'third_place', label: 'Third Place' },
]

export function getDefaultCertType(cat) {
  if (cat === 'Non-Technical Event') return 'non_technical_participant'
  return 'technical_participant'
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual Entry Sub-tab
// ─────────────────────────────────────────────────────────────────────────────
function ManualEntryTab({ societyId, eventId, event }) {
  const addToast = useToastStore((s) => s.addToast)
  const qc = useQueryClient()
  const defaultCertType = getDefaultCertType(event?.category)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      email: '',
      registration_number: '',
      cert_type: defaultCertType,
    },
  })

  useEffect(() => {
    setValue('cert_type', getDefaultCertType(event?.category))
  }, [event?.category, setValue])

  const onSubmit = async (values) => {
    try {
      await axiosInstance.post(
        `/societies/${societyId}/events/${eventId}/participants`,
        {
          name: values.name,
          email: values.email,
          registration_number: values.registration_number,
          cert_type: values.cert_type,
          fields: {
            Name: values.name,
            Email: values.email,
            'Registration Number': values.registration_number,
            Role: values.cert_type,
          },
        },
      )
      qc.invalidateQueries({ queryKey: ['participants', societyId, eventId] })
      addToast({ type: 'success', message: 'Participant added successfully.' })
      reset({
        name: '',
        email: '',
        registration_number: '',
        cert_type: getDefaultCertType(event?.category),
      })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to add participant.'
      addToast({ type: 'error', message: msg })
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-4">
        {/* Name */}
        <div>
          <label className="form-label" htmlFor="manual-name">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id="manual-name"
            type="text"
            className="form-input"
            placeholder="e.g. Jane Doe"
            {...register('name', { required: 'Name is required' })}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="form-label" htmlFor="manual-email">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            id="manual-email"
            type="email"
            className="form-input"
            placeholder="e.g. jane@example.com"
            {...register('email', {
              required: 'Email is required',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Invalid email address',
              },
            })}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        {/* Reg No */}
        <div>
          <label className="form-label" htmlFor="manual-regno">
            Registration Number
          </label>
          <input
            id="manual-regno"
            type="text"
            className="form-input"
            placeholder="e.g. 21CS001 (optional)"
            {...register('registration_number')}
          />
        </div>

        {/* Cert Type */}
        <div>
          <label className="form-label" htmlFor="manual-cert-type">
            Certificate Type / Role <span className="text-red-500">*</span>
          </label>
          <select
            id="manual-cert-type"
            className="form-input"
            {...register('cert_type')}
          >
            {EVENT_CERT_ROLES.map((ct) => (
              <option key={ct.value} value={ct.value}>
                {ct.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Adding…' : 'Add Participant'}
        </button>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel Upload Sub-tab
// ─────────────────────────────────────────────────────────────────────────────
function ExcelUploadTab({ societyId, eventId }) {
  const addToast = useToastStore((s) => s.addToast)
  const qc = useQueryClient()
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      const a = document.createElement('a')
      a.href = `${BACKEND_URL}/societies/${societyId}/events/${eventId}/excel-template`
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.download = ''
      a.click()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to download template.'
      addToast({ type: 'error', message: msg })
    } finally {
      setDownloading(false)
    }
  }

  const uploadExcel = async () => {
    if (!file) {
      addToast({ type: 'warning', message: 'Please select an Excel file first.' })
      return
    }
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await axiosInstance.post(
        `/societies/${societyId}/events/${eventId}/participants/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      setResult(data)
      qc.invalidateQueries({ queryKey: ['participants', societyId, eventId] })
      addToast({
        type: 'success',
        message: `Import complete: ${data.created ?? 0} participants added.`,
      })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Excel upload failed.'
      addToast({ type: 'error', message: msg })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Step 1: Download Template */}
      <div className="card p-6 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Step 1 — Download Excel Template</h3>
        <p className="text-xs text-gray-500">
          The template contains standard columns (Name, Email, Registration Number, Role). Fill it in and upload below.
        </p>
        <button
          type="button"
          onClick={downloadTemplate}
          disabled={downloading}
          className="btn-secondary text-xs flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {downloading ? 'Preparing…' : 'Download Template (.xlsx)'}
        </button>
      </div>

      {/* Step 2: Upload */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Step 2 — Upload Filled Sheet</h3>
        <FileUpload
          accept=".xlsx,.xls,.csv"
          onFileSelect={(f) => setFile(f)}
          label="Drop your participants Excel file here, or browse"
        />

        {file && (
          <div className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
            <span className="font-medium truncate">{file.name}</span>
            <button
              type="button"
              onClick={uploadExcel}
              disabled={uploading}
              className="btn-primary text-xs px-3 py-1"
            >
              {uploading ? 'Processing…' : 'Upload & Import'}
            </button>
          </div>
        )}

        {result && (
          <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800 space-y-1">
            <p className="font-semibold">✓ Upload Processed:</p>
            <p>• Added: {result.created ?? 0}</p>
            <p>• Skipped (duplicates): {result.skipped ?? 0}</p>
            {result.errors?.length > 0 && (
              <p className="text-red-600">• Errors: {result.errors.length} rows</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Participant List Sub-tab
// ─────────────────────────────────────────────────────────────────────────────
function ParticipantListTab({ societyId, eventId }) {
  const { data: participants, isLoading } = useParticipants(societyId, eventId)
  const updateType = useUpdateParticipantType(societyId, eventId)
  const verifyParticipant = useVerifyParticipant(societyId, eventId)
  const deleteParticipant = useDeleteParticipant(societyId, eventId)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const columns = [
    {
      key: 'name',
      header: 'Name',
      searchKey: true,
      sortable: true,
      render: (_, row) => (
        <div className="flex flex-col items-start gap-0.5">
          <span className="font-semibold text-gray-900">{row.fields?.Name || '—'}</span>
          {row.team_name && (
            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
              👥 {row.team_name} {row.team_role === 'leader' ? '👑 Leader' : '• Member'}
            </span>
          )}
        </div>
      ),
    },
    { key: 'email', header: 'Email', searchKey: true, sortable: true },
    { key: 'registration_number', header: 'Reg No.', searchKey: true, sortable: true, render: (v) => v || '—' },
    {
      key: 'cert_type',
      header: 'Type',
      sortable: true,
      render: (v, row) => {
        const currentVal = v === 'volunteer' ? 'student_volunteer' : v
        const hasMatch = EVENT_CERT_ROLES.some((r) => r.value === currentVal)
        return (
          <select
            className="form-input text-xs py-1 h-auto"
            value={hasMatch ? currentVal : ''}
            onChange={(e) => updateType.mutate({ participantId: row.id, cert_type: e.target.value })}
            disabled={updateType.isPending}
          >
            {!hasMatch && (
              <option value="" disabled>
                Select Type
              </option>
            )}
            {EVENT_CERT_ROLES.map((ct) => (
              <option key={ct.value} value={ct.value}>
                {ct.label}
              </option>
            ))}
          </select>
        )
      },
    },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
      render: (v) => <span className="capitalize text-xs text-gray-500">{v}</span>,
    },
    {
      key: 'verified',
      header: 'Attendance Status',
      align: 'center',
      sortable: true,
      render: (v, row) => (
        <button
          type="button"
          onClick={() => verifyParticipant.mutate({ participantId: row.id, verified: !v })}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold cursor-pointer transition-all shadow-sm ${
            v
              ? 'bg-green-100 text-green-800 hover:bg-green-200 ring-1 ring-green-600/20'
              : 'bg-amber-50 text-amber-800 hover:bg-amber-100 ring-1 ring-amber-600/20'
          }`}
          title="Click to toggle attendance status (Present / Absent)"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${v ? 'bg-green-600' : 'bg-amber-500'}`} />
          {v ? '✓ Present' : '○ Absent'}
        </button>
      ),
    },
    {
      key: '_delete',
      header: 'Actions',
      align: 'right',
      render: (_, row) =>
        confirmDeleteId === row.id ? (
          <div className="flex items-center gap-1 justify-end">
            <button
              type="button"
              onClick={() => {
                deleteParticipant.mutate(row.id, {
                  onSettled: () => setConfirmDeleteId(null),
                })
              }}
              className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-0.5 bg-red-50 rounded"
              disabled={deleteParticipant.isPending}
            >
              {deleteParticipant.isPending ? '…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="text-xs text-gray-500 hover:text-gray-700 px-1 py-0.5"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDeleteId(row.id)}
            className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
            title="Remove participant"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        ),
    },
  ]

  const handleExport = async () => {
    try {
      const response = await axiosInstance.get(
        `/societies/${societyId}/events/${eventId}/participants/export`,
        { responseType: 'blob' },
      )
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `participants_${eventId}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
    } catch (err) {
      console.error('Export failed', err)
      alert('Failed to export participants')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={handleExport} className="btn-secondary text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export to Excel
        </button>
      </div>
      <DataTable
        columns={columns}
        data={participants || []}
        isLoading={isLoading}
        emptyMessage="No participants found. Students who register or get uploaded will appear here."
        searchable
        searchPlaceholder="Search participants..."
        rowKey="id"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Participants Tab Wrapper
// ─────────────────────────────────────────────────────────────────────────────
const PARTICIPANT_SUBTABS = [
  { id: 'list',   label: 'Registered List' },
  { id: 'excel',  label: 'Excel Upload' },
  { id: 'manual', label: 'Manual Entry' },
]

function ParticipantsTab({ societyId, eventId, event }) {
  const [subTab, setSubTab] = useState('list')

  return (
    <div className="space-y-6">
      {/* Sub-tab bar */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {PARTICIPANT_SUBTABS.map((st) => (
          <button
            key={st.id}
            id={`participants-subtab-${st.id}`}
            onClick={() => setSubTab(st.id)}
            className={`
              rounded-md px-4 py-1.5 text-sm font-medium transition-colors
              ${subTab === st.id
                ? 'bg-white text-navy shadow-sm'
                : 'text-gray-500 hover:text-navy'
              }
            `}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === 'list' && (
        <ParticipantListTab
          societyId={societyId}
          eventId={eventId}
        />
      )}
      {subTab === 'excel' && (
        <ExcelUploadTab
          societyId={societyId}
          eventId={eventId}
        />
      )}
      {subTab === 'manual' && (
        <ManualEntryTab
          societyId={societyId}
          eventId={eventId}
          event={event}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main EventDetail Component
// ─────────────────────────────────────────────────────────────────────────────
export default function SocietyEventDetail() {
  const { society_id, club_id, event_id } = useParams()
  const societyId = society_id || club_id
  const [searchParams, setSearchParams] = useSearchParams()

  const navigate = useNavigate()
  const { data: event, isLoading } = useEvent(societyId, event_id)

  const deriveDefaultTab = (evt) => {
    if ((evt?.cert_count ?? 0) > 0) return 'certificates'
    if ((evt?.participant_count ?? 0) > 0) return 'participants'
    return 'overview'
  }
  const requestedTab = searchParams.get('tab')
  const activeTab = TABS.includes(requestedTab) ? requestedTab : deriveDefaultTab(event)

  const setActiveTab = (tab) => {
    setSearchParams({ tab }, { replace: true })
  }

  if (isLoading) {
    return (
      <div className="flex h-dvh flex-col">
        <Navbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 bg-background">
            <LoadingSpinner fullPage label="Loading event…" />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container">
            {/* Breadcrumb */}
            <nav className="mb-4 flex items-center gap-1.5 text-xs text-gray-400">
              <span
                className="cursor-pointer hover:text-navy transition-colors"
                onClick={() => navigate(`/society/${societyId}`)}
              >
                Events
              </span>
              <span>›</span>
              <span className="font-medium text-foreground truncate max-w-xs">
                {event?.name ?? 'Event'}
              </span>
            </nav>

            {/* Page heading */}
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {event?.name ?? 'Event Detail'}
                </h1>
                {event?.event_date && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {formatDateOnly(event.event_date)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Tab bar */}
            <div className="mb-6 flex gap-1 border-b border-gray-200 overflow-x-auto scrollbar-hide">
              {TABS.map((tab) => {
                const labels = {
                  overview: 'Overview',
                  'volunteer-requests': 'Volunteer Requests',
                  participants: 'Participants',
                  certificates: 'Certificates',
                }
                return (
                  <button
                    key={tab}
                    id={`event-tab-${tab}`}
                    onClick={() => setActiveTab(tab)}
                    className={`
                      relative whitespace-nowrap shrink-0 px-4 py-2.5 text-sm font-medium transition-colors
                      ${activeTab === tab
                        ? 'text-navy after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-navy after:rounded-t-full'
                        : 'text-gray-500 hover:text-navy'
                      }
                    `}
                  >
                    {labels[tab] || tab}
                  </button>
                )
              })}
            </div>

            {/* Tab content */}
            {activeTab === 'overview' && (
              <OverviewTab
                event={event}
                societyId={societyId}
                eventId={event_id}
                onNextStep={() => setActiveTab('volunteer-requests')}
              />
            )}
            {activeTab === 'volunteer-requests' && (
              <VolunteerRequestsTab
                societyId={societyId}
                eventId={event_id}
                event={event}
              />
            )}
            {activeTab === 'participants' && (
              <ParticipantsTab
                societyId={societyId}
                eventId={event_id}
                event={event}
              />
            )}
            {activeTab === 'certificates' && (
              <CertificateIssue
                embedded
                societyId={societyId}
                eventId={event_id}
                event={event}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
