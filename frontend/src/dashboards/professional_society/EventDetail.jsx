import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import LoadingSpinner from '../../components/LoadingSpinner'
import ConfirmModal from '../../components/ConfirmModal'
import {
  useSocietyEvent,
  useUpdateSocietyEvent,
  useDeleteSocietyEvent,
  useUploadSocietyEventPoster,
} from './api'
import { BACKEND_URL } from '../../utils/axiosInstance'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

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

export default function SocietyEventDetail() {
  const { society_id: societyId, event_id: eventId } = useParams()
  const navigate = useNavigate()

  const { data: event, isLoading } = useSocietyEvent(societyId, eventId)
  const updateEvent = useUpdateSocietyEvent(societyId)
  const deleteEvent = useDeleteSocietyEvent(societyId)
  const uploadPoster = useUploadSocietyEventPoster(societyId)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [posterFile, setPosterFile] = useState(null)
  const [showPosterUpload, setShowPosterUpload] = useState(false)
  const [editVenueOption, setEditVenueOption] = useState('')
  const [editCustomVenue, setEditCustomVenue] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm()

  const handleOpenEdit = () => {
    const curVenue = event?.venue || ''
    if (VENUE_OPTIONS.filter((v) => v !== 'Other').includes(curVenue)) {
      setEditVenueOption(curVenue)
      setEditCustomVenue('')
    } else if (curVenue) {
      setEditVenueOption('Other')
      setEditCustomVenue(curVenue)
    } else {
      setEditVenueOption('')
      setEditCustomVenue('')
    }
    reset({
      name: event?.name || '',
      description: event?.description || '',
      event_date: event?.event_date ? String(event.event_date).split('T')[0] : '',
      event_time: event?.event_time || '',
      session: event?.session || 'FN',
      venue: event?.venue || '',
      category: event?.category || 'Workshop',
      max_participants: event?.max_participants != null ? String(event.max_participants) : '',
      volunteers_required: event?.volunteers_required || 0,
      is_published: !!event?.is_published,
      registration_stopped: !!event?.registration_stopped,
    })
    setIsEditModalOpen(true)
  }

  const onSubmitEdit = async (formData) => {
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
      is_published: !!formData.is_published,
      registration_stopped: !!formData.registration_stopped,
    }

    await updateEvent.mutateAsync({ eventId, ...payload })
    setIsEditModalOpen(false)
  }

  const handlePosterSubmit = async (e) => {
    e.preventDefault()
    if (!posterFile) return
    await uploadPoster.mutateAsync({ eventId, posterFile })
    setPosterFile(null)
    setShowPosterUpload(false)
  }

  const togglePublish = async () => {
    if (!event) return
    await updateEvent.mutateAsync({
      eventId,
      is_published: !event.is_published,
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-background p-6">
            <LoadingSpinner fullPage label="Loading event details…" />
          </main>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-background p-6">
            <div className="card p-12 text-center space-y-3">
              <p className="text-base font-semibold text-gray-700">Event not found</p>
              <button
                type="button"
                onClick={() => navigate(`/society/${societyId}`)}
                className="btn-primary text-xs"
              >
                Return to Dashboard
              </button>
            </div>
          </main>
        </div>
      </div>
    )
  }

  const sessionLabel = event.session === 'AN' ? 'Afternoon (AN)' : 'Morning (FN)'

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Navigation back and Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/society/${societyId}`)}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors"
                  title="Back to Society Dashboard"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🌐</span>
                    <h1 className="text-2xl font-bold text-foreground">{event.name}</h1>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Professional Society Event Details & Management
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={togglePublish}
                  disabled={updateEvent.isPending}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    event.is_published
                      ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {event.is_published ? 'Unpublish Event' : 'Publish Event'}
                </button>
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Details
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                >
                  Delete Event
                </button>
              </div>
            </div>

            {/* Event Meta Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Main Info & Overview */}
              <div className="lg:col-span-2 space-y-6">
                <div className="card p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-2.5 py-1 rounded">
                        {event.category || 'Event'}
                      </span>
                      <span className="text-xs font-semibold text-navy bg-navy/5 px-2.5 py-1 rounded">
                        {sessionLabel}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        event.is_published
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {event.is_published ? 'Published' : 'Draft'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-foreground">Description</h3>
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap leading-relaxed">
                      {event.description || 'No detailed description provided for this event.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-100 text-sm">
                    <div>
                      <span className="text-xs font-semibold uppercase text-gray-400">Date & Session</span>
                      <p className="font-semibold text-gray-800 mt-0.5">
                        {fmtDate(event.event_date)} ({sessionLabel})
                      </p>
                      {event.event_time && (
                        <p className="text-xs text-gray-500">Scheduled: {event.event_time}</p>
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase text-gray-400">Venue</span>
                      <p className="font-semibold text-gray-800 mt-0.5">{event.venue || 'To be announced'}</p>
                    </div>
                  </div>
                </div>

                {/* Participation & Volunteers Stats */}
                <div className="card p-6 space-y-4">
                  <h3 className="text-base font-bold text-foreground">Registrations & Capacity</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <span className="text-xs font-semibold uppercase text-gray-500">Participants Registered</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-extrabold text-navy">
                          {event.participant_count ?? 0}
                        </span>
                        {event.max_participants && (
                          <span className="text-xs text-gray-500 font-medium">
                            / {event.max_participants} capacity
                          </span>
                        )}
                      </div>
                      {event.registration_stopped && (
                        <span className="inline-flex mt-2 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                          Registration Closed
                        </span>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <span className="text-xs font-semibold uppercase text-gray-500">Student Volunteers</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-extrabold text-teal-700">
                          {event.volunteers_registered ?? 0}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          / {event.volunteers_required ?? 0} required
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-2">
                        {(event.volunteers_registered || 0) >= (event.volunteers_required || 0) && (event.volunteers_required || 0) > 0
                          ? 'Volunteer quota fulfilled'
                          : 'Accepting volunteer requests'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Col: Poster */}
              <div className="space-y-6">
                <div className="card p-5 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <h3 className="text-sm font-bold text-foreground">Event Poster</h3>
                    <button
                      type="button"
                      onClick={() => setShowPosterUpload(!showPosterUpload)}
                      className="text-xs font-semibold text-teal-700 hover:underline"
                    >
                      {showPosterUpload ? 'Close' : 'Replace Poster'}
                    </button>
                  </div>

                  {event.poster_url ? (
                    <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                      {event.poster_url.toLowerCase().endsWith('.pdf') ? (
                        <div className="p-8 text-center space-y-2">
                          <span className="text-4xl">📄</span>
                          <p className="text-xs font-semibold text-gray-700">PDF Poster Document</p>
                          <a
                            href={`${BACKEND_URL}${event.poster_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary text-xs inline-flex"
                          >
                            Open PDF
                          </a>
                        </div>
                      ) : (
                        <a
                          href={`${BACKEND_URL}${event.poster_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Click to view full size"
                        >
                          <img
                            src={event.poster_url.startsWith('/') ? `${BACKEND_URL}${event.poster_url}` : event.poster_url}
                            alt={event.name}
                            className="w-full h-auto object-contain max-h-80 mx-auto"
                          />
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 border border-dashed border-gray-200 rounded-lg text-center text-gray-400">
                      <span className="text-3xl">🖼️</span>
                      <p className="text-xs mt-1">No poster uploaded yet</p>
                    </div>
                  )}

                  {showPosterUpload && (
                    <form onSubmit={handlePosterSubmit} className="pt-2 border-t border-gray-100 space-y-3">
                      <div>
                        <label className="form-label">Upload New Poster File</label>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,application/pdf"
                          onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
                          className="form-input text-xs"
                          required
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowPosterUpload(false)}
                          className="btn-secondary text-xs"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={!posterFile || uploadPoster.isPending}
                          className="btn-primary text-xs"
                        >
                          {uploadPoster.isPending ? 'Uploading…' : 'Upload'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-foreground">Edit Event Details</h3>
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
                    <div>
                      <label className="form-label">Event Name *</label>
                      <input
                        type="text"
                        className="form-input text-sm"
                        {...register('name', { required: 'Event name is required' })}
                      />
                      {errors.name && <p className="form-error">{errors.name.message}</p>}
                    </div>

                    <div>
                      <label className="form-label">Description</label>
                      <textarea
                        rows={3}
                        className="form-input text-sm"
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
                        value={editVenueOption}
                        onChange={(e) => {
                          const val = e.target.value
                          setEditVenueOption(val)
                          if (val !== 'Other') {
                            setValue('venue', val, { shouldValidate: true })
                          } else {
                            setValue('venue', editCustomVenue.trim(), { shouldValidate: true })
                          }
                        }}
                      >
                        <option value="">Select venue</option>
                        {VENUE_OPTIONS.map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                      {editVenueOption === 'Other' && (
                        <div className="mt-2">
                          <input
                            type="text"
                            className="form-input text-sm"
                            placeholder="Type custom venue…"
                            value={editCustomVenue}
                            onChange={(e) => {
                              const val = e.target.value
                              setEditCustomVenue(val)
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
                          className="form-input text-sm"
                          {...register('max_participants')}
                        />
                      </div>
                      <div>
                        <label className="form-label">Volunteers Required</label>
                        <input
                          type="number"
                          min={0}
                          className="form-input text-sm"
                          {...register('volunteers_required')}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-1 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="edit-event-published"
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          {...register('is_published')}
                        />
                        <label htmlFor="edit-event-published" className="text-xs font-semibold text-gray-700 cursor-pointer">
                          Published to students
                        </label>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="edit-event-reg-stopped"
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          {...register('registration_stopped')}
                        />
                        <label htmlFor="edit-event-reg-stopped" className="text-xs font-semibold text-gray-700 cursor-pointer">
                          Stop new registrations
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setIsEditModalOpen(false)}
                        className="btn-secondary text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || updateEvent.isPending}
                        className="btn-primary text-xs"
                      >
                        {updateEvent.isPending ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmModal
              isOpen={isDeleteModalOpen}
              onClose={() => setIsDeleteModalOpen(false)}
              onConfirm={async () => {
                await deleteEvent.mutateAsync(eventId)
                navigate(`/society/${societyId}`)
              }}
              title="Delete Event?"
              message={`Are you sure you want to permanently delete "${event.name}"? This action cannot be undone.`}
              confirmLabel="Delete Event"
              isLoading={deleteEvent.isPending}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
