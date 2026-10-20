import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import StatCard from '../../components/StatCard'
import DataTable from '../../components/DataTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import ConfirmModal from '../../components/ConfirmModal'
import {
  useSocietyDashboard,
  useSocietyEvents,
  useCreateSocietyEvent,
  useUpdateSocietyEvent,
  useDeleteSocietyEvent,
  useUploadSocietyEventPoster,
  useUpdateSocietyAssets,
  useSocietyMembershipRequests,
  useReviewSocietyMembership,
  useBulkApproveSocietyMemberships,
  useDeleteSocietyMembership,
  useSocietyOfficeBearers,
  useAssignSocietyOfficeBearer,
  useRemoveSocietyOfficeBearer,
  useSocietyActiveMembers,
} from './api'
import { useAuthStore } from '../../store/authStore'
import { useToastStore } from '../../store/uiStore'
import { useChangePassword } from '../auth/api'
import { BACKEND_URL } from '../../utils/axiosInstance'

// ── Tab configuration ────────────────────────────────────────────────────────
const TABS = ['events', 'active_members', 'members', 'office_bearers', 'settings']

const TAB_LABELS = {
  events: 'Society Dashboard',
  active_members: 'Active Members',
  members: 'Membership Requests',
  office_bearers: 'Office Bearers',
  settings: 'Settings',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ═══════════════════════════════════════════════════════════════════════════════
// Events / Dashboard Tab
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

// ═══════════════════════════════════════════════════════════════════════════════
function DashboardTab({ societyId, dashboard, isLoading }) {
  const navigate = useNavigate()
  const { data: events, isLoading: eventsLoading } = useSocietyEvents(societyId)
  const eventList = Array.isArray(events) ? events : []
  const createEvent = useCreateSocietyEvent(societyId)
  const updateEvent = useUpdateSocietyEvent(societyId)
  const deleteEvent = useDeleteSocietyEvent(societyId)
  const uploadPoster = useUploadSocietyEventPoster(societyId)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [posterUploadEvent, setPosterUploadEvent] = useState(null)
  const [posterFile, setPosterFile] = useState(null)
  const [selectedVenueOption, setSelectedVenueOption] = useState('')
  const [customVenue, setCustomVenue] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      name: '',
      description: '',
      event_date: '',
      event_time: '',
      session: 'FN',
      venue: '',
      category: 'Workshop',
      max_participants: '',
      volunteers_required: 0,
      is_team_event: false,
      min_team_size: 2,
      max_team_size: 4,
      max_teams: '',
      is_published: true,
    },
  })

  const onSubmitEvent = async (formData) => {
    const payload = {
      name: formData.name.trim(),
      description: formData.description?.trim() || null,
      event_date: formData.event_date ? new Date(formData.event_date).toISOString() : null,
      event_time: formData.event_time?.trim() || null,
      session: formData.session || 'FN',
      venue: formData.venue?.trim() || null,
      category: formData.category || 'Workshop',
      max_participants: formData.max_participants ? parseInt(formData.max_participants, 10) : null,
      volunteers_required: formData.volunteers_required ? parseInt(formData.volunteers_required, 10) : 0,
      is_team_event: !!formData.is_team_event,
      min_team_size: formData.min_team_size ? parseInt(formData.min_team_size, 10) : 2,
      max_team_size: formData.max_team_size ? parseInt(formData.max_team_size, 10) : 4,
      max_teams: formData.is_team_event && formData.max_teams ? parseInt(formData.max_teams, 10) : null,
      is_published: !!formData.is_published,
    }

    if (editingEvent) {
      await updateEvent.mutateAsync({ eventId: editingEvent.id, ...payload })
      setEditingEvent(null)
    } else {
      await createEvent.mutateAsync(payload)
    }
    reset()
    setSelectedVenueOption('')
    setCustomVenue('')
    setIsModalOpen(false)
  }

  const handleOpenEdit = (ev) => {
    setEditingEvent(ev)
    const curVenue = ev.venue || ''
    if (VENUE_OPTIONS.filter((v) => v !== 'Other').includes(curVenue)) {
      setSelectedVenueOption(curVenue)
      setCustomVenue('')
    } else if (curVenue) {
      setSelectedVenueOption('Other')
      setCustomVenue(curVenue)
    } else {
      setSelectedVenueOption('')
      setCustomVenue('')
    }
    reset({
      name: ev.name || '',
      description: ev.description || '',
      event_date: ev.event_date ? String(ev.event_date).split('T')[0] : '',
      event_time: ev.event_time || '',
      session: ev.session || 'FN',
      venue: ev.venue || '',
      category: ev.category || 'Workshop',
      max_participants: ev.max_participants != null ? String(ev.max_participants) : '',
      volunteers_required: ev.volunteers_required || 0,
      is_team_event: !!ev.is_team_event,
      min_team_size: ev.min_team_size || 2,
      max_team_size: ev.max_team_size || 4,
      max_teams: ev.max_teams != null ? String(ev.max_teams) : '',
      is_published: !!ev.is_published,
    })
    setIsModalOpen(true)
  }

  const handlePosterSubmit = async (e) => {
    e.preventDefault()
    if (!posterFile || !posterUploadEvent) return
    await uploadPoster.mutateAsync({
      eventId: posterUploadEvent.id,
      posterFile,
    })
    setPosterUploadEvent(null)
    setPosterFile(null)
  }

  return (
    <div className="space-y-6">
      {/* Assets Missing Warning Alert */}
      {dashboard && !dashboard.assets_configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-bold">Society Assets Incomplete</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Official society Logo and Coordinator Signature have not been uploaded yet. Please configure them in the Settings tab.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`?tab=settings`)}
            className="btn-secondary text-xs shrink-0 py-1 px-3 border-amber-300 text-amber-900 hover:bg-amber-100"
          >
            Configure Assets
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Events Conducted"
          value={dashboard?.total_events ?? eventList.length}
          icon={<span className="text-xl">🌐</span>}
          accent="navy"
          loading={isLoading}
        />
        <StatCard
          label="Active Approved Members"
          value={dashboard?.active_members_count ?? 0}
          icon={<span className="text-xl">👥</span>}
          accent="green"
          loading={isLoading}
        />
        <StatCard
          label="Published Events"
          value={dashboard?.published_events_count ?? eventList.filter((e) => e.is_published).length}
          icon={<span className="text-xl">📅</span>}
          accent="purple"
          loading={isLoading}
        />
      </div>

      {/* Events Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Events</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Create, manage, and schedule professional society events and workshops.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingEvent(null)
            setSelectedVenueOption('')
            setCustomVenue('')
            reset({
              name: '',
              description: '',
              event_date: '',
              event_time: '',
              session: 'FN',
              venue: '',
              category: 'Workshop',
              max_participants: '',
              volunteers_required: 0,
              is_team_event: false,
              min_team_size: 2,
              max_team_size: 4,
              max_teams: '',
              is_published: true,
            })
            setIsModalOpen(true)
          }}
          className="btn-primary text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Event
        </button>
      </div>

      {/* Events List */}
      {eventsLoading ? (
        <LoadingSpinner fullPage={false} label="Loading events…" />
      ) : eventList.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="text-4xl">🗓️</div>
          <p className="text-base font-semibold text-gray-700">No events created yet</p>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Get started by creating your society&apos;s first event or workshop.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="btn-primary text-xs mx-auto mt-2"
          >
            Create Event
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventList.map((ev) => {
            const sessionLabel = ev.session === 'AN' ? 'Afternoon (AN)' : 'Morning (FN)'
            return (
              <div
                key={ev.id}
                className="card overflow-hidden flex flex-col justify-between border border-gray-200 hover:shadow-md transition-shadow group"
              >
                <div>
                  {/* Poster Thumbnail */}
                  <div className="aspect-[16/9] w-full bg-slate-100 border-b border-gray-200 relative overflow-hidden flex items-center justify-center">
                    {ev.poster_url ? (
                      <img
                        src={ev.poster_url.startsWith('/') ? `${BACKEND_URL}${ev.poster_url}` : ev.poster_url}
                        alt={ev.name}
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <span className="text-3xl">🌐</span>
                        <p className="text-[11px] text-gray-400 mt-1 font-medium">No poster uploaded</p>
                      </div>
                    )}
                    <span
                      className={`absolute top-2.5 right-2.5 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs ${
                        ev.is_published
                          ? 'bg-green-100 text-green-800 border border-green-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {ev.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                        {ev.category || 'Event'}
                      </span>
                      <span className="text-xs font-semibold text-navy">
                        {sessionLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-foreground line-clamp-1">{ev.name}</h3>
                      {ev.is_team_event && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
                          👥 Team ({ev.min_team_size || 2}-{ev.max_team_size || 4})
                        </span>
                      )}
                    </div>
                    {ev.description && (
                      <p className="text-xs text-gray-600 line-clamp-2">{ev.description}</p>
                    )}

                    <div className="pt-2 border-t border-gray-100 space-y-1 text-xs text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <span>📅</span>
                        <span>{fmtDate(ev.event_date)}</span>
                        {ev.event_time && <span className="text-gray-400">at {ev.event_time}</span>}
                      </div>
                      {ev.venue && (
                        <div className="flex items-center gap-1.5 truncate">
                          <span>📍</span>
                          <span className="truncate">{ev.venue}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                        <span>
                          {ev.is_team_event ? (
                            <>
                              🛡️ Teams: <strong className="text-gray-700">{ev.team_count ?? 0}</strong>
                              {ev.max_teams ? ` / ${ev.max_teams}` : ''}
                            </>
                          ) : (
                            <>
                              👥 Participants: <strong className="text-gray-700">{ev.participant_count ?? 0}</strong>
                              {ev.max_participants ? ` / ${ev.max_participants}` : ''}
                            </>
                          )}
                        </span>
                        {(ev.volunteers_required || 0) > 0 && (
                          <span>🤝 Volunteers: {ev.volunteers_registered || 0}/{ev.volunteers_required}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-4 pt-0 border-t border-gray-50 flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/society/${societyId}/events/${ev.id}`)}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 hover:underline"
                    >
                      View Details
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPosterUploadEvent(ev)
                        setPosterFile(null)
                      }}
                      className="text-xs text-gray-600 hover:text-navy hover:underline"
                    >
                      Poster
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(ev)}
                      className="p-1 rounded text-gray-400 hover:text-navy hover:bg-gray-100"
                      title="Edit event"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(ev)}
                      className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                      title="Delete event"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-lg font-bold text-foreground">
                {editingEvent ? 'Edit Event' : 'Create New Event'}
              </h3>
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); setSelectedVenueOption(''); setCustomVenue(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitEvent)} className="space-y-4">
              <div>
                <label className="form-label">Event Name *</label>
                <input
                  type="text"
                  className="form-input text-sm"
                  placeholder="e.g. Workshop on Embedded Systems"
                  {...register('name', { required: 'Event name is required' })}
                />
                {errors.name && <p className="form-error">{errors.name.message}</p>}
              </div>

              <div>
                <label className="form-label">Description</label>
                <textarea
                  rows={3}
                  className="form-input text-sm"
                  placeholder="Brief overview of the event, agenda, and speakers…"
                  {...register('description')}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Event Date</label>
                  <input
                    type="date"
                    className="form-input text-sm"
                    {...register('event_date')}
                  />
                </div>
                <div>
                  <label className="form-label">Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 10:00 AM"
                    className="form-input text-sm"
                    {...register('event_time')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Session *</label>
                  <select className="form-input text-sm" {...register('session')}>
                    <option value="FN">Morning (FN)</option>
                    <option value="AN">Afternoon (AN)</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Category</label>
                  <select className="form-input text-sm" {...register('category')}>
                    {['Workshop', 'Technical Talk', 'Technical Event', 'Non-Technical Event', 'Hackathon', 'Conference', 'Other'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Venue</label>
                <select
                  className="form-input text-sm"
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
                      type="text"
                      className="form-input text-sm"
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
                <input type="hidden" {...register('venue')} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Max Participants</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Leave blank for unlimited"
                    className="form-input text-sm"
                    {...register('max_participants')}
                  />
                </div>
                <div>
                  <label className="form-label">Volunteers Required</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    className="form-input text-sm"
                    {...register('volunteers_required')}
                  />
                </div>
              </div>

              {/* Participation Mode */}
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-2.5">
                <label className="form-label mb-1">Participation Type *</label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                    <input
                      type="radio"
                      name="society_participation_type"
                      checked={!watch('is_team_event')}
                      onChange={() => setValue('is_team_event', false)}
                      className="text-teal-600 focus:ring-teal-500 h-4 w-4"
                    />
                    <span>👤 Individual (Solo)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700">
                    <input
                      type="radio"
                      name="society_participation_type"
                      checked={!!watch('is_team_event')}
                      onChange={() => setValue('is_team_event', true)}
                      className="text-teal-600 focus:ring-teal-500 h-4 w-4"
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
                    </div>
                    <div>
                      <label className="form-label text-xs">Max Teams (Optional)</label>
                      <input
                        type="number"
                        min={1}
                        placeholder="Unlimited"
                        className="form-input text-xs"
                        {...register('max_teams')}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="society-event-published"
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                  {...register('is_published')}
                />
                <label htmlFor="society-event-published" className="text-xs font-semibold text-gray-700 cursor-pointer">
                  Publish immediately (visible to students in Upcoming Events)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setSelectedVenueOption(''); setCustomVenue(''); }}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || createEvent.isPending || updateEvent.isPending}
                  className="btn-primary text-xs"
                >
                  {isSubmitting || createEvent.isPending || updateEvent.isPending
                    ? 'Saving…'
                    : editingEvent ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Poster Upload Modal */}
      {posterUploadEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-foreground">
                Upload Poster: {posterUploadEvent.name}
              </h3>
              <button
                type="button"
                onClick={() => setPosterUploadEvent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePosterSubmit} className="space-y-4">
              <div>
                <label className="form-label">Select Poster Image / PDF</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
                  className="form-input text-xs"
                />
                <p className="text-[11px] text-gray-400 mt-1">Recommended: 16:9 ratio, max 10MB.</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPosterUploadEvent(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!posterFile || uploadPoster.isPending}
                  className="btn-primary text-xs"
                >
                  {uploadPoster.isPending ? 'Uploading…' : 'Upload Poster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteEvent.mutateAsync(deleteTarget.id)
          setDeleteTarget(null)
        }}
        title="Delete Event?"
        message={`Are you sure you want to permanently delete "${deleteTarget?.name}"? All registrations and event records will be removed.`}
        confirmLabel="Delete Event"
        isLoading={deleteEvent.isPending}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Active Members Tab
// ═══════════════════════════════════════════════════════════════════════════════
function ActiveMembersTab() {
  const { data: members, isLoading } = useSocietyActiveMembers()
  const deleteMembership = useDeleteSocietyMembership()
  const [memberToRemove, setMemberToRemove] = useState(null)
  const memberList = Array.isArray(members) ? members : []

  const columns = [
    {
      key: 'student_name',
      header: 'Name',
      sortable: true,
      searchKey: true,
      render: (v) => <span className="font-semibold text-foreground text-sm">{v || '—'}</span>,
    },
    {
      key: 'registration_number',
      header: 'Register Number',
      sortable: true,
      searchKey: true,
      render: (v) => <span className="font-mono text-xs text-gray-600">{v || '—'}</span>,
    },
    {
      key: 'student_email',
      header: 'Email Address',
      sortable: true,
      searchKey: true,
      render: (v) => <span className="text-xs text-gray-600">{v || '—'}</span>,
    },
    {
      key: 'office_bearer_role',
      header: 'Office Bearer Position',
      sortable: true,
      render: (v) =>
        v ? (
          <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-800 ring-1 ring-inset ring-teal-600/20">
            {v}
          </span>
        ) : (
          <span className="text-xs text-gray-400 italic">Member</span>
        ),
    },
    {
      key: 'applied_at',
      header: 'Joined Date',
      sortable: true,
      render: (v) => <span className="text-xs text-gray-500">{fmtDate(v)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      align: 'right',
      render: (_, row) => (
        <button
          type="button"
          onClick={() => setMemberToRemove(row)}
          className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
        >
          Remove Member
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Active Members</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Official student roster of approved members for this professional society.
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800 ring-1 ring-inset ring-teal-600/20">
          {memberList.length} Total Members
        </span>
      </div>

      <DataTable
        columns={columns}
        data={memberList}
        isLoading={isLoading}
        emptyMessage="No active approved members in this society yet."
        rowKey="id"
        searchable
        searchPlaceholder="Search active members by name, email, register number…"
      />

      <ConfirmModal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={async () => {
          if (!memberToRemove) return
          await deleteMembership.mutateAsync(memberToRemove.id)
          setMemberToRemove(null)
        }}
        title="Remove Member from Society?"
        message={`Are you sure you want to remove ${memberToRemove?.student_name || 'this student'} (${memberToRemove?.student_email})? Their membership and any assigned office bearer role will be revoked.`}
        confirmLabel="Remove Member"
        isLoading={deleteMembership.isPending}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Membership Requests Tab
// ═══════════════════════════════════════════════════════════════════════════════
function MembershipRequestsTab() {
  const { data: requests, isLoading } = useSocietyMembershipRequests()
  const reviewMembership = useReviewSocietyMembership()
  const bulkApprove = useBulkApproveSocietyMemberships()
  const deleteMembership = useDeleteSocietyMembership()

  const [selectedIds, setSelectedIds] = useState([])
  const [reviewNotes, setReviewNotes] = useState({})
  const [requestToDelete, setRequestToDelete] = useState(null)
  const [statusFilter, setStatusFilter] = useState('pending')

  const allRequests = Array.isArray(requests) ? requests : []
  const filtered = allRequests.filter((r) => {
    if (statusFilter === 'all') return true
    return (r.status || '').toLowerCase() === statusFilter.toLowerCase()
  })

  const pendingList = filtered.filter((r) => (r.status || '').toLowerCase() === 'pending')

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === pendingList.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(pendingList.map((r) => r.id))
    }
  }

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return
    await bulkApprove.mutateAsync({
      membershipIds: selectedIds,
    })
    setSelectedIds([])
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Membership Requests</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Review, approve, reject, or remove student membership applications.
          </p>
        </div>

        {/* Filter and Bulk Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
            {['pending', 'approved', 'rejected', 'all'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md font-semibold capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-gray-600 hover:text-foreground'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {statusFilter === 'pending' && pendingList.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="btn-secondary text-xs"
              >
                {selectedIds.length === pendingList.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                type="button"
                onClick={handleBulkApprove}
                disabled={selectedIds.length === 0 || bulkApprove.isPending}
                className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {bulkApprove.isPending ? 'Approving…' : `Approve Selected (${selectedIds.length})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner fullPage={false} label="Loading requests…" />
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          No membership requests found for this filter.
        </div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {filtered.map((req) => {
            const isPending = (req.status || '').toLowerCase() === 'pending'
            return (
              <div
                key={req.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {isPending && (
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(req.id)}
                      onChange={() => toggleSelect(req.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{req.student_name || '—'}</p>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          req.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : req.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{req.student_email}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Applied: {fmtDate(req.applied_at)}</p>
                    {req.review_note && (
                      <p className="text-xs text-gray-600 mt-1 italic">&ldquo;{req.review_note}&rdquo;</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:self-center">
                  {isPending && (
                    <>
                      <input
                        type="text"
                        placeholder="Optional note…"
                        value={reviewNotes[req.id] || ''}
                        onChange={(e) =>
                          setReviewNotes((p) => ({ ...p, [req.id]: e.target.value }))
                        }
                        className="form-input text-xs w-36 h-7"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          reviewMembership.mutate({
                            membershipId: req.id,
                            action: 'approve',
                            reviewNote: reviewNotes[req.id],
                          })
                        }
                        disabled={reviewMembership.isPending}
                        className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          reviewMembership.mutate({
                            membershipId: req.id,
                            action: 'reject',
                            reviewNote: reviewNotes[req.id],
                          })
                        }
                        disabled={reviewMembership.isPending}
                        className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </>
                  )}

                  {/* Provision to Delete/Remove the member or request */}
                  <button
                    type="button"
                    onClick={() => setRequestToDelete(req)}
                    disabled={deleteMembership.isPending}
                    className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors flex items-center gap-1"
                    title={req.status === 'approved' ? 'Remove member from society' : 'Delete request'}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>{req.status === 'approved' ? 'Remove Member' : 'Delete'}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete / Remove Confirmation Modal */}
      <ConfirmModal
        isOpen={!!requestToDelete}
        onClose={() => setRequestToDelete(null)}
        onConfirm={async () => {
          if (!requestToDelete) return
          await deleteMembership.mutateAsync(requestToDelete.id)
          setRequestToDelete(null)
        }}
        title={requestToDelete?.status === 'approved' ? 'Remove Society Member?' : 'Delete Membership Request?'}
        message={
          requestToDelete?.status === 'approved'
            ? `Are you sure you want to remove ${requestToDelete?.student_name || 'this student'} (${requestToDelete?.student_email}) from this professional society? Their membership and any associated office bearer role will be revoked.`
            : `Are you sure you want to delete the membership request for ${requestToDelete?.student_name || 'this student'} (${requestToDelete?.student_email})?`
        }
        confirmLabel={requestToDelete?.status === 'approved' ? 'Remove Member' : 'Delete'}
        isLoading={deleteMembership.isPending}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Office Bearers Tab
// ═══════════════════════════════════════════════════════════════════════════════
function OfficeBearersTab() {
  const { data: obData, isLoading } = useSocietyOfficeBearers()
  const { data: activeMembers } = useSocietyActiveMembers()
  const assignBearer = useAssignSocietyOfficeBearer()
  const removeBearer = useRemoveSocietyOfficeBearer()

  const [assignModalPos, setAssignModalPos] = useState(null)
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [removePosConfirm, setRemovePosConfirm] = useState(null)

  const positions = Array.isArray(obData?.positions) ? obData.positions : []
  const bearers = Array.isArray(obData?.office_bearers) ? obData.office_bearers : []

  // Map position -> bearer
  const bearerMap = {}
  bearers.forEach((b) => {
    if (b.position) bearerMap[b.position] = b
  })

  const handleAssign = async (e) => {
    e.preventDefault()
    if (!assignModalPos || !selectedStudentId) return
    await assignBearer.mutateAsync({
      position: assignModalPos,
      studentId: selectedStudentId,
    })
    setAssignModalPos(null)
    setSelectedStudentId('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Professional Society Office Bearers</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Assign designated executive leadership roles for this professional society.
        </p>
      </div>

      {/* Mandatory Guidelines Informational Box */}
      <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4 sm:p-5 shadow-xs space-y-2.5">
        <div className="flex items-center gap-2 text-teal-900 font-bold text-sm">
          <svg className="w-5 h-5 text-teal-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Important Guidelines for Office Bearer Allocation</span>
        </div>
        <ul className="text-xs sm:text-sm text-teal-950/80 space-y-2 list-disc list-inside leading-relaxed pl-1">
          <li>
            <strong className="text-teal-900">Mandatory Society Membership:</strong> To be appointed as an Office Bearer, the student <span className="font-semibold underline decoration-teal-400">must first be an approved active member</span> of this professional society. If the student has not yet joined, they must submit a membership request and have it approved under the <em>Membership Requests</em> tab before they can be allocated to an office bearer role.
          </li>
          <li>
            <strong className="text-teal-900">Handling Multiple Positions with the Same Role:</strong> Each position slot can hold only one student. If your society has multiple members serving in the same capacity (for example, 4 Event Coordinators or 2 Joint Secretaries), assign them sequentially as <span className="inline-flex font-mono font-semibold bg-white px-1.5 py-0.5 rounded border border-teal-200 text-teal-800">Event Coordinator 1</span>, <span className="inline-flex font-mono font-semibold bg-white px-1.5 py-0.5 rounded border border-teal-200 text-teal-800">Event Coordinator 2</span>, <span className="inline-flex font-mono font-semibold bg-white px-1.5 py-0.5 rounded border border-teal-200 text-teal-800">Event Coordinator 3</span>, etc., and assign each student to their designated number.
          </li>
        </ul>
      </div>

      {/* Position Cards Grid */}
      {isLoading ? (
        <LoadingSpinner fullPage={false} label="Loading office bearers…" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {positions.map((pos) => {
            const holder = bearerMap[pos]
            return (
              <div
                key={pos}
                className="card p-5 flex flex-col justify-between space-y-4 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md">
                      {pos}
                    </span>
                    {holder ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
                        Assigned
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
                        Vacant
                      </span>
                    )}
                  </div>

                  {holder ? (
                    <div className="pt-2 space-y-1">
                      <p className="text-base font-bold text-foreground">{holder.student_name || '—'}</p>
                      <p className="text-xs text-gray-500">{holder.student_email}</p>
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <p className="text-xs text-gray-400 italic">No member assigned to this position yet.</p>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                  {holder ? (
                    <button
                      type="button"
                      onClick={() => setRemovePosConfirm(pos)}
                      disabled={removeBearer.isPending}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors w-full"
                    >
                      Unassign Role
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignModalPos(pos)
                        setSelectedStudentId('')
                      }}
                      className="btn-primary text-xs w-full justify-center"
                    >
                      Assign Student
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Assign Modal */}
      {assignModalPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-foreground">Assign Office Bearer</h3>
                <p className="text-xs text-teal-700 font-semibold mt-0.5">Position: {assignModalPos}</p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalPos(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="form-label">Select Approved Society Member *</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="form-input text-xs"
                  required
                >
                  <option value="">-- Choose a student member --</option>
                  {(Array.isArray(activeMembers) ? activeMembers : []).map((m) => (
                    <option key={m.student_id} value={m.student_id}>
                      {m.student_name} ({m.student_email})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Only students with approved society membership can be assigned as office bearers.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalPos(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedStudentId || assignBearer.isPending}
                  className="btn-primary text-xs"
                >
                  {assignBearer.isPending ? 'Assigning…' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Role Confirmation Modal */}
      <ConfirmModal
        isOpen={!!removePosConfirm}
        onClose={() => setRemovePosConfirm(null)}
        onConfirm={async () => {
          if (!removePosConfirm) return
          await removeBearer.mutateAsync(removePosConfirm)
          setRemovePosConfirm(null)
        }}
        title="Unassign Office Bearer Role?"
        message={`Are you sure you want to unassign the office bearer position "${removePosConfirm}"? The student will remain an active member of the society.`}
        confirmLabel="Unassign"
        isLoading={removeBearer.isPending}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Settings Tab (Assets & Password)
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsTab({ societyId, dashboard }) {
  const updateAssets = useUpdateAssetsWrapper(societyId)
  const changePassword = useChangePassword()

  const [logoFile, setLogoFile] = useState(null)
  const [signatureFile, setSignatureFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [signaturePreview, setSignaturePreview] = useState(null)

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [pwError, setPwError] = useState('')

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  const handleSignatureChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setSignatureFile(file)
      setSignaturePreview(URL.createObjectURL(file))
    }
  }

  const handleUploadAssets = async (e) => {
    e.preventDefault()
    if (!logoFile && !signatureFile) return
    await updateAssets.mutateAsync({ logoFile, signatureFile })
    setLogoFile(null)
    setSignatureFile(null)
  }

  const handlePwSubmit = (e) => {
    e.preventDefault()
    if (!pwForm.current_password || !pwForm.new_password || !pwForm.confirm_password) {
      setPwError('Please fill in all password fields.')
      return
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError('New passwords do not match.')
      return
    }
    if (pwForm.new_password.length < 6) {
      setPwError('New password must be at least 6 characters.')
      return
    }
    setPwError('')
    changePassword.mutate(
      {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      },
      {
        onSuccess: () => {
          setPwForm({ current_password: '', new_password: '', confirm_password: '' })
        },
      }
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Society Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Configure society assets (logo, coordinator signature) and security credentials.
        </p>
      </div>

      {/* Society Assets Card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-foreground">Official Society Assets</h2>
            <p className="text-xs text-gray-500">
              Uploaded assets are automatically formatted and used for event publicity and documentation.
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
              dashboard?.assets_configured
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {dashboard?.assets_configured ? '✓ Fully Configured' : '⚠ Assets Missing'}
          </span>
        </div>

        <form onSubmit={handleUploadAssets} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Logo */}
            <div className="space-y-2">
              <label className="form-label">Society Logo</label>
              <div className="border border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center bg-gray-50/50 min-h-[160px]">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="max-h-24 object-contain mb-2" />
                ) : (
                  <div className="text-center text-gray-400 mb-2">
                    <span className="text-3xl">🌐</span>
                    <p className="text-xs mt-1">No logo chosen</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleLogoChange}
                  className="form-input text-xs w-full"
                />
              </div>
              <p className="text-[11px] text-gray-400">PNG or SVG with transparent background recommended.</p>
            </div>

            {/* Signature */}
            <div className="space-y-2">
              <label className="form-label">Coordinator Signature</label>
              <div className="border border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center bg-gray-50/50 min-h-[160px]">
                {signaturePreview ? (
                  <img src={signaturePreview} alt="Signature preview" className="max-h-24 object-contain mb-2" />
                ) : (
                  <div className="text-center text-gray-400 mb-2">
                    <span className="text-3xl">✍️</span>
                    <p className="text-xs mt-1">No signature chosen</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleSignatureChange}
                  className="form-input text-xs w-full"
                />
              </div>
              <p className="text-[11px] text-gray-400">Processed with automatic background removal.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={(!logoFile && !signatureFile) || updateAssets.isPending}
              className="btn-primary text-xs"
            >
              {updateAssets.isPending ? 'Saving Assets…' : 'Save Assets'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-bold text-foreground">Change Password</h2>
        <form onSubmit={handlePwSubmit} className="space-y-3">
          {pwError && <p className="form-error">{pwError}</p>}
          <div>
            <label className="form-label">Current Password *</label>
            <input
              type="password"
              value={pwForm.current_password}
              onChange={(e) => setPwForm((p) => ({ ...p, current_password: e.target.value }))}
              className="form-input text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">New Password *</label>
              <input
                type="password"
                value={pwForm.new_password}
                onChange={(e) => setPwForm((p) => ({ ...p, new_password: e.target.value }))}
                className="form-input text-sm"
              />
            </div>
            <div>
              <label className="form-label">Confirm New Password *</label>
              <input
                type="password"
                value={pwForm.confirm_password}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm_password: e.target.value }))}
                className="form-input text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={changePassword.isPending}
              className="btn-primary text-xs"
            >
              {changePassword.isPending ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function useUpdateAssetsWrapper(societyId) {
  return useUpdateSocietyAssets(societyId)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Professional Society Coordinator Dashboard
// ═══════════════════════════════════════════════════════════════════════════════
export default function ProfessionalSocietyDashboard() {
  const { society_id: routeSocietyId } = useParams()
  const userSocietyId = useAuthStore((s) => s.society_id)
  const role = useAuthStore((s) => s.role)
  const navigate = useNavigate()

  // For coordinator, lock to their assigned society_id; for superadmin, allow viewing route society
  const societyId = (role === 'professional_society_coordinator' && userSocietyId)
    ? userSocietyId
    : (routeSocietyId || userSocietyId)

  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'events'

  const { data: dashboard, isLoading, isError: dashboardError } = useSocietyDashboard(societyId)

  // Auto-correct route URL if coordinator is on a different/stale URL
  useEffect(() => {
    if (role === 'professional_society_coordinator' && userSocietyId && routeSocietyId && routeSocietyId !== userSocietyId) {
      navigate(`/society/${userSocietyId}`, { replace: true })
    }
  }, [role, userSocietyId, routeSocietyId, navigate])

  const handleTabChange = (tab) => {
    setSearchParams(tab === 'events' ? {} : { tab })
  }

  if (dashboardError && !isLoading) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-background p-6">
            <div className="max-w-md mx-auto mt-16 card p-8 text-center space-y-4 border border-amber-200 bg-amber-50/50 shadow-sm">
              <div className="text-4xl">⚠️</div>
              <h1 className="text-lg font-bold text-gray-900">Professional Society Not Found</h1>
              <p className="text-xs text-gray-600">
                The requested professional society does not exist or you do not have permission to view it.
              </p>
              {userSocietyId && userSocietyId !== routeSocietyId ? (
                <button
                  type="button"
                  onClick={() => navigate(`/society/${userSocietyId}`, { replace: true })}
                  className="btn-primary text-xs mx-auto"
                >
                  Go to My Assigned Society
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="btn-secondary text-xs mx-auto"
                >
                  Return to Login
                </button>
              )}
            </div>
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
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header with Title and Tab Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🌐</span>
                  <h1 className="text-2xl font-bold text-foreground">
                    {dashboard?.name || 'Professional Society'}
                  </h1>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Professional Society Coordinator Portal
                </p>
              </div>

              {/* Sub-tabs */}
              <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1 text-xs font-semibold overflow-x-auto">
                {TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleTabChange(tab)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                      activeTab === tab
                        ? 'bg-white text-teal-800 shadow-xs font-bold'
                        : 'text-gray-600 hover:text-foreground'
                    }`}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Contents */}
            {activeTab === 'events' && (
              <DashboardTab societyId={societyId} dashboard={dashboard} isLoading={isLoading} />
            )}
            {activeTab === 'active_members' && (
              <ActiveMembersTab />
            )}
            {activeTab === 'members' && (
              <MembershipRequestsTab />
            )}
            {activeTab === 'office_bearers' && (
              <OfficeBearersTab />
            )}
            {activeTab === 'settings' && (
              <SettingsTab societyId={societyId} dashboard={dashboard} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
