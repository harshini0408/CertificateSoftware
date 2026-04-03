import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import StatCard from '../components/StatCard'
import DataTable from '../components/DataTable'
import StatusBadge from '../components/StatusBadge'
import LoadingSpinner from '../components/LoadingSpinner'
import ConfirmModal from '../components/ConfirmModal'
import { useClubDashboard, useClubMembers } from '../api/clubs'
import { useCreateEvent, useDeleteEvent } from '../api/events'
import { useTemplates, usePresetTemplates, useClubOwnedTemplates } from '../api/templates'
import TemplateEditorModal from '../components/templates/TemplateEditorModal'
import { useAuthStore } from '../store/authStore'
import { useChangePassword } from '../api/auth'
import axiosInstance from '../utils/axiosInstance'

// ── Tab ids ───────────────────────────────────────────────────────────────────
const TABS = ['dashboard', 'events', 'templates', 'settings']

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const roleBadge = {
  club_coordinator: 'bg-blue-50 text-blue-700 ring-blue-200',
  guest: 'bg-amber-50 text-amber-700 ring-amber-200',
}
const roleLabel = {
  club_coordinator: 'Coordinator',
  guest: 'Guest',
}

// ── Icon helpers ──────────────────────────────────────────────────────────────
const Icon = {
  events: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  active: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  certs: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
  participants: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
  email: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  failed: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
}

// ═══════════════════════════════════════════════════════════════════════════════
// Dashboard tab
// ═══════════════════════════════════════════════════════════════════════════════
function DashboardTab({ clubId, dashboard, isLoading }) {
  const role = useAuthStore((s) => s.role)
  const { data: members, isLoading: membersLoading } = useClubMembers(
    role !== 'guest' ? clubId : null
  )

  if (isLoading) return <LoadingSpinner fullPage label="Loading dashboard…" />

  const stats = dashboard?.stats || {}
  const club = dashboard?.club || {}
  const recentEvents = dashboard?.recent_events || []

  const eventColumns = [
    { key: 'name', header: 'Event', sortable: true },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'participant_count', header: 'Participants', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
    { key: 'cert_count', header: 'Certs Issued', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-foreground">{club.name || 'Club Dashboard'}</h1>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono font-bold text-navy">{club.slug}</span>
        <StatusBadge status={club.is_active ? 'Active' : 'Inactive'} size="sm" />
      </div>

      {/* Stat cards — 2 rows of 3 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Total Events" value={stats.total_events ?? 0} icon={Icon.events} accent="navy" />
        <StatCard label="Active Events" value={stats.active_events ?? 0} icon={Icon.active} accent="gold" />
        <StatCard label="Certificates Issued" value={stats.total_certificates_issued ?? 0} icon={Icon.certs} accent="green" />
        <StatCard label="Total Participants" value={stats.total_participants ?? 0} icon={Icon.participants} accent="blue" />
        <StatCard label="Pending Emails" value={stats.pending_emails ?? 0} icon={Icon.email} accent="teal" />
        <StatCard label="Failed Emails" value={stats.failed_emails ?? 0} icon={Icon.failed} accent="red" />
      </div>

      {/* Recent events */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Recent Events</h2>
        </div>
        <DataTable
          columns={eventColumns}
          data={recentEvents}
          isLoading={false}
          emptyMessage="No events yet. Create your first event."
          rowKey="event_id"
        />
      </div>

      {/* Members section — visible to coordinators only */}
      {role !== 'guest' && (
        <div>
          <h2 className="section-title mb-3">Club Members</h2>
          {membersLoading ? (
            <LoadingSpinner label="Loading members…" />
          ) : (members || []).length === 0 ? (
            <p className="text-sm text-gray-500">No other members. Admin can add coordinators and guests.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {members.map((m) => (
                <div key={m.id} className="card flex items-center gap-3 px-4 py-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm font-bold text-white shrink-0">
                    {m.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <span className={`inline-flex items-center rounded-full ring-1 ring-inset px-2 py-0.5 text-xs font-medium ${roleBadge[m.role] || 'bg-gray-100 text-gray-600 ring-gray-200'}`}>
                      {roleLabel[m.role] || m.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Events tab
// ═══════════════════════════════════════════════════════════════════════════════
function EventsTab({ clubId }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const createEvent = useCreateEvent(clubId)
  const deleteEvent = useDeleteEvent(clubId)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm()

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', clubId, 'list'],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/clubs/${clubId}/events`)
      return data
    },
    enabled: !!clubId,
  })

  const onSubmit = (data) => {
    createEvent.mutate(data, {
      onSuccess: (res) => {
        setIsModalOpen(false)
        reset()
        navigate(`/club/${clubId}/events/${res.id ?? res._id}`)
      }
    })
  }

  const handleDelete = () => {
    deleteEvent.mutate(deleteTarget.id ?? deleteTarget._id, {
      onSuccess: () => setDeleteTarget(null)
    })
  }

  const eventColumns = [
    { key: 'name', header: 'Event Name', sortable: true, searchKey: true,
      render: (v, row) => (
        <button
          className="text-sm font-semibold text-navy hover:underline text-left"
          onClick={() => navigate(`/club/${clubId}/events/${row.id ?? row._id}`)}
        >
          {v}
          {v}
        </button>
      ) },
    { key: 'event_date', header: 'Date', sortable: true, render: (v) => fmtDate(v) },
    { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'participant_count', header: 'Participants', align: 'right', render: (v) => (v ?? 0).toLocaleString() },
    { key: '_actions', header: 'Actions', align: 'center', searchKey: false, render: (_, row) => (
        <div className="flex justify-center gap-2">
          <button onClick={() => navigate(`/club/${clubId}/events/${row.id ?? row._id}`)} className="text-navy hover:bg-gray-100 p-1.5 rounded" title="Edit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button onClick={() => setDeleteTarget(row)} className="text-red-500 hover:bg-red-50 p-1.5 rounded" title="Delete">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      ) }
  ]

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Events</h1>
        <button
          className="btn-primary"
          onClick={() => setIsModalOpen(true)}
        >
          + New Event
        </button>
      </div>
      <DataTable
        columns={eventColumns}
        data={events ?? []}
        isLoading={isLoading}
        emptyMessage="No events yet. Click '+ New Event' to create one."
        searchable
        searchPlaceholder="Search events…"
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy">Create New Event</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="form-label" htmlFor="title">Event Name *</label>
                <input id="title" type="text" className={`form-input ${errors.name ? 'form-input-error' : ''}`} placeholder="e.g. Hackathon 2024" {...register('name', { required: 'Event name is required' })} />
                {errors.name && <p className="form-error">{errors.name.message}</p>}
              </div>
              <div>
                <label className="form-label" htmlFor="date">Event Date</label>
                <input id="date" type="date" className="form-input" {...register('event_date')} />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">{isSubmitting ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Event"
        message={`Are you sure you want to delete '${deleteTarget?.name}'? This will remove all associated certificates and history.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isLoading={deleteEvent.isPending}
      />
    </div>
  )
}

// ── Cert type metadata for thumbnail rendering ──────────────────────────────
const certTypeMeta = {
  participant:  { label: 'Participant',   cls: 'bg-blue-100 text-blue-700',     accent: '#1B4D3E', bg: '#FFFDF7' },
  coordinator:  { label: 'Coordinator',   cls: 'bg-green-100 text-green-700',   accent: '#1B5E20', bg: '#F0FFF0' },
  winner_1st:   { label: '1st Place',     cls: 'bg-amber-100 text-amber-700',   accent: '#DAA520', bg: '#FFFEF5' },
  winner_2nd:   { label: '2nd Place',     cls: 'bg-gray-200 text-gray-700',     accent: '#8C8C8C', bg: '#FAFAFA' },
  winner_3rd:   { label: '3rd Place',     cls: 'bg-orange-100 text-orange-700', accent: '#CD7F32', bg: '#FFF9F0' },
  volunteer:    { label: 'Appreciation',  cls: 'bg-yellow-100 text-yellow-700', accent: '#B8860B', bg: '#FFF8F0' },
}

// ── Rich certificate thumbnail ───────────────────────────────────────────────
function CertThumbnail({ template }) {
  const meta = certTypeMeta[template.cert_type] ?? { accent: '#6366f1', bg: '#fff' }
  const accent = meta.accent
  const bgColor = template.background?.value ?? meta.bg
  const bgStyle = bgColor.includes('gradient') ? { background: bgColor } : { backgroundColor: bgColor }
  const slots = template.field_slots ?? []
  const scaleX = 1 / 2480
  const scaleY = 1 / 3508

  return (
    <div className="relative w-full overflow-hidden rounded-lg" style={{ ...bgStyle, aspectRatio: '210/297' }}>
      {/* Border */}
      <div className="absolute inset-1 rounded border-2" style={{ borderColor: `${accent}50` }} />
      {/* Title watermark */}
      <div className="absolute top-[12%] w-full text-center pointer-events-none">
        <div className="font-bold uppercase tracking-widest" style={{ fontSize: '7px', color: `${accent}90`, letterSpacing: '2px' }}>CERTIFICATE</div>
        <div className="mt-0.5 font-medium capitalize" style={{ fontSize: '5px', color: `${accent}60` }}>{template.cert_type?.replace(/_/g, ' ')}</div>
      </div>
      {/* Slot outlines */}
      {slots.slice(0, 4).map((slot, i) => (
        <div key={slot.slot_id ?? i} className="absolute" style={{
          left: `${(slot.x ?? 200) * scaleX * 100}%`,
          top: `${(slot.y ?? (800 + i * 80)) * scaleY * 100}%`,
          width: `${(slot.width ?? 1680) * scaleX * 100}%`,
          height: `${(slot.height ?? 60) * scaleY * 100}%`,
          border: `1px dashed ${accent}40`,
          background: `${accent}08`,
          borderRadius: '1px',
        }} />
      ))}
      {/* Signature line */}
      <div className="absolute" style={{ bottom: '14%', left: '15%', width: '30%', height: '1px', background: `${accent}30` }} />
      {/* QR zone */}
      <div className="absolute" style={{ bottom: '8%', right: '10%', width: '12%', height: `${12 * (210/297)}%`, border: `1px dashed ${accent}25`, borderRadius: '2px' }} />
      {/* Preset badge */}
      {template.is_preset && (
        <span className="absolute top-1.5 right-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-sm">Preset</span>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Templates tab
// ═══════════════════════════════════════════════════════════════════════════════
function TemplatesTab({ clubId }) {
  const navigate = useNavigate()
  const { data: templates, isLoading } = useTemplates(clubId)
  const { data: clubDocs, isLoading: isClubDocsLoading } = useClubOwnedTemplates()

  const [editingTemplateId, setEditingTemplateId] = useState(null)

  const presets = (templates ?? []).filter(t => t.is_preset)
  const custom = (templates ?? []).filter(t => !t.is_preset)

  // Map of preset_id -> club's forked document
  const clubForkMap = {}
  if (clubDocs) {
    for (const doc of clubDocs) {
      if (doc.forked_from) {
        clubForkMap[doc.forked_from] = doc
      }
    }
  }

  const RichTemplateCard = ({ template }) => {
    const meta = certTypeMeta[template.cert_type] ?? { label: template.cert_type, cls: 'bg-gray-100 text-gray-600' }
    const slotCount = template.field_slots?.length ?? 0
    
    // Check if this is a preset that the club has customized
    const clubFork = template.is_preset ? clubForkMap[template.id] : null
    const hasFork = !!clubFork

    const handleCustomize = (e) => {
      e.stopPropagation()
      setEditingTemplateId(template.id)
    }

    return (
      <div
        className="card group cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-navy/20 relative"
        onClick={() => navigate(`/templates/${template.id}`)}
      >
        {/* Customized Badge */}
        {hasFork && (
          <div className="absolute top-2 left-2 z-10 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-emerald-200 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            Customized
          </div>
        )}

        {/* Rich thumbnail */}
        <div className="p-3 pb-0">
          <CertThumbnail template={template} />
        </div>
        {/* Info */}
        <div className="p-3 pt-2.5 space-y-2">
          <div>
            <p className="text-sm font-semibold text-foreground truncate group-hover:text-navy transition-colors">
              {template.name}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
                {meta.label}
              </span>
              <span className="text-[10px] text-gray-400">
                {slotCount} slot{slotCount !== 1 ? 's' : ''} · {template.font_family?.split(',')[0] || 'Default'}
              </span>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 relative z-20">
            <button 
              className="flex-1 btn-primary text-xs py-1.5"
              onClick={(e) => { e.stopPropagation(); navigate(`/templates/${template.id}`) }}
            >
              Assign
            </button>
            <button 
              className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors border ${
                hasFork 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
              onClick={handleCustomize}
            >
              {hasFork ? 'Edit Custom' : 'Customize'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading || isClubDocsLoading) return <LoadingSpinner fullPage label="Loading templates…" />

  return (
    <div className="space-y-6 relative">
      {editingTemplateId && (
        <TemplateEditorModal 
          templateId={editingTemplateId} 
          onClose={() => setEditingTemplateId(null)} 
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Templates</h1>
          <p className="text-sm text-gray-500 mt-1">{(templates ?? []).length} template{(templates ?? []).length !== 1 ? 's' : ''} available</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => navigate(`/club/${clubId}/templates/new`)}
        >
          + Create Template
        </button>
      </div>

      {/* Custom templates */}
      {custom.length > 0 && (
        <div>
          <h2 className="section-title mb-3">Custom Templates</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {custom.map(t => <RichTemplateCard key={t.id} template={t} />)}
          </div>
        </div>
      )}

      {/* Preset templates */}
      {presets.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="section-title">Preset Templates</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{presets.length} presets</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Built-in certificate designs. Assign these to your events from the event detail page.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {presets.map(t => <RichTemplateCard key={t.id} template={t} />)}
          </div>
        </div>
      )}

      {templates?.length === 0 && (
        <div className="card p-12 text-center text-gray-400">
          <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
          <p className="text-lg font-semibold">No templates available</p>
          <p className="text-sm mt-1">Preset templates may not be seeded yet. Contact admin.</p>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Settings tab
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsTab({ club, clubLoading }) {
  const changePassword = useChangePassword()
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

  if (clubLoading) return <LoadingSpinner fullPage label="Loading club info…" />

  return (
    <div className="max-w-lg space-y-8">
      {/* Club info (read-only) */}
      <div>
        <h2 className="section-title mb-3">Club Information</h2>
        <div className="card divide-y divide-gray-100 overflow-hidden">
          {[
            ['Club Name', club?.name],
            ['Slug', club?.slug],
            ['Contact Email', club?.contact_email],
            ['Status', club?.is_active ? 'Active' : 'Inactive'],
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

      {/* Change password */}
      <div>
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
export default function ClubDashboard() {
  const { club_id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = TABS.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'dashboard'

  const setTab = (tab) =>
    setSearchParams(tab === 'dashboard' ? {} : { tab }, { replace: true })

  const { data: dashboard, isLoading: dashLoading } = useClubDashboard(club_id)
  const club = dashboard?.club || null

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container">
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
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'dashboard' && (
              <DashboardTab clubId={club_id} dashboard={dashboard} isLoading={dashLoading} />
            )}
            {activeTab === 'events' && <EventsTab clubId={club_id} />}
            {activeTab === 'templates' && <TemplatesTab clubId={club_id} />}
            {activeTab === 'settings' && (
              <SettingsTab club={club} clubLoading={dashLoading} />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
