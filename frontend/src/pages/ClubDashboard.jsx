import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import StatCard from '../components/StatCard'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import { useClub, useClubStats } from '../api/clubs'
import { useEvents, useCreateEvent } from '../api/events'

// ── Tab ids ───────────────────────────────────────────────────────────────────
const TABS = ['dashboard', 'events', 'templates', 'settings']

// ── Icon helpers ──────────────────────────────────────────────────────────────
const Icon = {
  events: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  certs: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  email: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  failed: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

// ─────────────────────────────────────────────────────────────────────────────
// New Event Modal
// ─────────────────────────────────────────────────────────────────────────────
function NewEventModal({ clubId, onClose }) {
  const createEvent = useCreateEvent(clubId)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { name: '', description: '', event_date: '' },
  })

  const onSubmit = async (values) => {
    await createEvent.mutateAsync(values)
    onClose()
  }

  const busy = isSubmitting || createEvent.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-modal"
        style={{ animation: 'fadeIn 0.15s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">New Event</h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="form-label" htmlFor="event-name">
              Event name <span className="text-red-500">*</span>
            </label>
            <input
              id="event-name"
              className={`form-input ${errors.name ? 'form-input-error' : ''}`}
              placeholder="e.g. Annual Tech Fest 2025"
              disabled={busy}
              {...register('name', { required: 'Event name is required.' })}
            />
            {errors.name && <p className="form-error">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="form-label" htmlFor="event-desc">
              Description
            </label>
            <textarea
              id="event-desc"
              rows={3}
              className="form-input resize-none"
              placeholder="Brief description of the event…"
              disabled={busy}
              {...register('description')}
            />
          </div>

          {/* Date */}
          <div>
            <label className="form-label" htmlFor="event-date">
              Event date <span className="text-red-500">*</span>
            </label>
            <input
              id="event-date"
              type="date"
              className={`form-input ${errors.event_date ? 'form-input-error' : ''}`}
              disabled={busy}
              {...register('event_date', { required: 'Event date is required.' })}
            />
            {errors.event_date && (
              <p className="form-error">{errors.event_date.message}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard tab
// ─────────────────────────────────────────────────────────────────────────────
function DashboardTab({ clubId, stats, statsLoading, events, eventsLoading, onNewEvent, onViewEvent }) {
  const recentEvents = (events ?? []).slice(0, 5)

  const eventColumns = [
    { key: 'name',       header: 'Event',        sortable: true },
    {
      key: 'event_date',
      header: 'Date',
      sortable: true,
      render: (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'cert_count',
      header: 'Certs Issued',
      align: 'right',
      render: (v) => (v ?? 0).toLocaleString(),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Events"
          value={stats?.total_events ?? 0}
          icon={Icon.events}
          accent="navy"
          isLoading={statsLoading}
        />
        <StatCard
          label="Certs Issued"
          value={stats?.certs_issued ?? 0}
          icon={Icon.certs}
          accent="gold"
          isLoading={statsLoading}
        />
        <StatCard
          label="Pending Emails"
          value={stats?.pending_emails ?? 0}
          icon={Icon.email}
          accent="blue"
          isLoading={statsLoading}
        />
        <StatCard
          label="Failed Emails"
          value={stats?.failed_emails ?? 0}
          icon={Icon.failed}
          accent="red"
          isLoading={statsLoading}
        />
      </div>

      {/* Recent events */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Recent Events</h2>
          <div className="flex gap-2">
            <button className="btn-primary text-sm" onClick={onNewEvent} id="dashboard-new-event">
              + New Event
            </button>
            <button className="btn-secondary text-sm" onClick={() => {}}>
              View All
            </button>
          </div>
        </div>
        <DataTable
          columns={eventColumns}
          data={recentEvents}
          isLoading={eventsLoading}
          emptyMessage="No events yet. Create your first event!"
          onRowClick={(row) => onViewEvent(row)}
          rowKey="id"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Events tab
// ─────────────────────────────────────────────────────────────────────────────
function EventsTab({ clubId, events, eventsLoading, onNewEvent, onViewEvent }) {
  const columns = [
    { key: 'name',       header: 'Event Name', sortable: true, searchKey: true },
    {
      key: 'event_date',
      header: 'Date',
      sortable: true,
      render: (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'participant_count',
      header: 'Participants',
      align: 'right',
      render: (v) => (v ?? 0).toLocaleString(),
    },
    {
      key: 'cert_count',
      header: 'Certs Issued',
      align: 'right',
      render: (v) => (v ?? 0).toLocaleString(),
    },
  ]

  return (
    <div>
      <DataTable
        columns={columns}
        data={events ?? []}
        isLoading={eventsLoading}
        emptyMessage="No events found. Create one to get started."
        searchable
        searchPlaceholder="Search events…"
        onRowClick={(row) => onViewEvent(row)}
        rowKey="id"
        actions={
          <button
            id="events-tab-new-event"
            className="btn-primary text-sm"
            onClick={onNewEvent}
          >
            + New Event
          </button>
        }
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates tab (placeholder — TemplateBuilder is Batch 10)
// ─────────────────────────────────────────────────────────────────────────────
function TemplatesTab({ clubId }) {
  const navigate = useNavigate()
  return (
    <div className="card p-8 flex flex-col items-center gap-4 text-center">
      <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
      <div>
        <p className="section-title">Certificate Templates</p>
        <p className="mt-1 text-sm text-gray-500">
          Choose a preset or build a fully custom template for your events.
        </p>
      </div>
      <button
        id="templates-new"
        className="btn-primary"
        onClick={() => navigate(`/club/${clubId}/templates/new`)}
      >
        + New Template
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings tab
// ─────────────────────────────────────────────────────────────────────────────
function SettingsTab({ club, clubLoading }) {
  if (clubLoading) return <LoadingSpinner fullPage label="Loading club info…" />

  return (
    <div className="max-w-lg space-y-6">
      <div className="card divide-y divide-gray-100 overflow-hidden">
        {[
          ['Club Name',     club?.name],
          ['Slug',          club?.slug],
          ['Contact Email', club?.contact_email],
          ['Status',        club?.is_active ? 'Active' : 'Inactive'],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-medium text-gray-500">{label}</span>
            <span className="text-sm text-foreground font-semibold">
              {value ?? '—'}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400">
        To update club details, contact the platform administrator.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ClubDashboard (main export)
// ─────────────────────────────────────────────────────────────────────────────
export default function ClubDashboard() {
  const { club_id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showNewEvent, setShowNewEvent] = useState(false)

  // Derive active tab from URL ?tab= param
  const activeTab = TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'dashboard'

  const setTab = (tab) =>
    setSearchParams(tab === 'dashboard' ? {} : { tab }, { replace: true })

  // Data
  const { data: club,   isLoading: clubLoading   } = useClub(club_id)
  const { data: stats,  isLoading: statsLoading  } = useClubStats(club_id)
  const { data: events, isLoading: eventsLoading } = useEvents(club_id)

  const handleViewEvent = (row) =>
    navigate(`/club/${club_id}/events/${row.id}`)

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container">
            {/* Page header */}
            <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {clubLoading ? (
                    <span className="inline-block h-7 w-40 animate-pulse rounded bg-gray-200" />
                  ) : (
                    club?.name ?? 'Club Dashboard'
                  )}
                </h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  Manage your events, participants, and certificates.
                </p>
              </div>
            </div>

            {/* Tab bar */}
            <div className="mb-6 flex gap-1 border-b border-gray-200">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  id={`club-tab-${tab}`}
                  onClick={() => setTab(tab)}
                  className={`
                    relative px-4 py-2.5 text-sm font-medium capitalize transition-colors
                    ${activeTab === tab
                      ? 'text-navy after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-navy after:rounded-t-full'
                      : 'text-gray-500 hover:text-navy'
                    }
                  `}
                >
                  {tab === 'dashboard' ? 'Dashboard' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'dashboard' && (
              <DashboardTab
                clubId={club_id}
                stats={stats}
                statsLoading={statsLoading}
                events={events}
                eventsLoading={eventsLoading}
                onNewEvent={() => setShowNewEvent(true)}
                onViewEvent={handleViewEvent}
              />
            )}
            {activeTab === 'events' && (
              <EventsTab
                clubId={club_id}
                events={events}
                eventsLoading={eventsLoading}
                onNewEvent={() => setShowNewEvent(true)}
                onViewEvent={handleViewEvent}
              />
            )}
            {activeTab === 'templates' && (
              <TemplatesTab clubId={club_id} />
            )}
            {activeTab === 'settings' && (
              <SettingsTab club={club} clubLoading={clubLoading} />
            )}
          </div>
        </main>
      </div>

      {/* New event modal */}
      {showNewEvent && (
        <NewEventModal
          clubId={club_id}
          onClose={() => setShowNewEvent(false)}
        />
      )}
    </div>
  )
}
