import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTemplates, usePresetTemplates, useAssignPreset, useClubPresets } from '../api/templates'
import LoadingSpinner from '../components/LoadingSpinner'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'

// ── Cert type badge colours ───────────────────────────────────────────────────
const certTypeMeta = {
  participant:  { label: 'Participant',  cls: 'bg-blue-100 text-blue-700',   accent: '#1B4D3E', bg: '#FFFDF7' },
  coordinator:  { label: 'Coordinator', cls: 'bg-green-100 text-green-700',  accent: '#1B5E20', bg: '#F0FFF0' },
  winner_1st:   { label: '1st Place',   cls: 'bg-amber-100 text-amber-700',  accent: '#DAA520', bg: '#FFFEF5' },
  winner_2nd:   { label: '2nd Place',   cls: 'bg-gray-100  text-gray-600',   accent: '#8C8C8C', bg: '#FAFAFA' },
  winner_3rd:   { label: '3rd Place',   cls: 'bg-orange-100 text-orange-700', accent: '#CD7F32', bg: '#FFF9F0' },
  volunteer:    { label: 'Appreciation', cls: 'bg-yellow-100 text-yellow-700', accent: '#B8860B', bg: '#FFF8F0' },
  mentor:       { label: 'Mentor',      cls: 'bg-purple-100 text-purple-700', accent: '#6A1B9A', bg: '#F5F0FF' },
  judge:        { label: 'Judge',       cls: 'bg-red-100   text-red-700',    accent: '#B71C1C', bg: '#FFF5F5' },
}

// ── Mini certificate thumbnail with slot outlines ─────────────────────────────
function CertThumbnail({ template }) {
  const meta = certTypeMeta[template.cert_type] ?? { accent: '#6366f1', bg: '#fff' }
  const accent = meta.accent
  const bgColor = template.background?.value ?? meta.bg

  // Parse background
  const bgStyle = bgColor.includes('gradient')
    ? { background: bgColor }
    : { backgroundColor: bgColor }

  // Derived slot positions (scaled from 2480×3508 to thumbnail)
  const slots = template.field_slots ?? []
  const scaleX = 1 / 2480
  const scaleY = 1 / 3508

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg"
      style={{ ...bgStyle, aspectRatio: '210/297' }}
    >
      {/* Decorative border */}
      <div className="absolute inset-1 rounded border-2" style={{ borderColor: `${accent}50` }} />

      {/* Certificate title */}
      <div className="absolute top-[12%] w-full text-center pointer-events-none">
        <div className="font-bold uppercase tracking-widest" style={{ fontSize: '7px', color: `${accent}90`, letterSpacing: '2px' }}>
          CERTIFICATE
        </div>
        <div className="mt-0.5 font-medium capitalize" style={{ fontSize: '5px', color: `${accent}60` }}>
          {template.cert_type?.replace(/_/g, ' ')}
        </div>
      </div>

      {/* Slot outlines */}
      {slots.slice(0, 4).map((slot, i) => (
        <div
          key={slot.slot_id ?? i}
          className="absolute"
          style={{
            left: `${(slot.x ?? 200) * scaleX * 100}%`,
            top: `${(slot.y ?? (800 + i * 80)) * scaleY * 100}%`,
            width: `${(slot.width ?? 1680) * scaleX * 100}%`,
            height: `${(slot.height ?? 60) * scaleY * 100}%`,
            border: `1px dashed ${accent}40`,
            background: `${accent}08`,
            borderRadius: '1px',
          }}
        />
      ))}

      {/* Signature line */}
      <div
        className="absolute"
        style={{
          bottom: '14%',
          left: '15%',
          width: '30%',
          height: '1px',
          background: `${accent}30`,
        }}
      />

      {/* QR placeholder */}
      <div
        className="absolute"
        style={{
          bottom: '8%',
          right: '10%',
          width: '12%',
          height: `${12 * (210/297)}%`,
          border: `1px dashed ${accent}25`,
          borderRadius: '2px',
        }}
      />

      {/* Preset badge */}
      {template.is_preset && (
        <span className="absolute top-1.5 right-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-sm">
          Preset
        </span>
      )}
    </div>
  )
}

// ── Template card ─────────────────────────────────────────────────────────────
function TemplateCard({ template, selected, onSelect }) {
  const meta = certTypeMeta[template.cert_type] ?? { label: template.cert_type, cls: 'bg-gray-100 text-gray-600' }
  const slotCount = template.field_slots?.length ?? 0

  return (
    <button
      onClick={() => onSelect(template)}
      className={`
        group flex flex-col gap-3 rounded-xl border-2 p-3 text-left
        transition-all duration-200
        ${selected
          ? 'border-navy bg-navy/5 shadow-lg ring-2 ring-navy/20'
          : 'border-gray-200 bg-white hover:border-navy/40 hover:shadow-md'
        }
      `}
    >
      {/* Thumbnail */}
      <CertThumbnail template={template} />

      {/* Info */}
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground truncate group-hover:text-navy transition-colors">
          {template.name}
        </p>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
            {meta.label}
          </span>
          <span className="text-[10px] text-gray-400">
            {slotCount} slot{slotCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Selection indicator */}
      {selected && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-navy">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Selected
        </div>
      )}
    </button>
  )
}

// ── TemplateSelector ──────────────────────────────────────────────────────────
export default function TemplateSelector({
  isModal = false,
  onSelect,
  onClose,
  clubId: propClubId,
  eventId: propEventId,
}) {
  const params = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const clubId  = propClubId  ?? params.club_id
  const eventId = propEventId ?? params.event_id
  const certTypeFilter = searchParams.get('certType')

  const [selected, setSelected] = useState(null)
  const [filter, setFilter]     = useState('all')

  const { data: clubTemplates, isLoading: clubLoading, error: clubError, refetch: refetchClub } = useTemplates(clubId)
  const { data: presets,       isLoading: presetsLoading, error: presetsError, refetch: refetchPresets } = usePresetTemplates()

  const assignPreset = useAssignPreset(clubId, eventId)

  const isLoading = clubLoading || presetsLoading
  const error = clubError || presetsError

  // Merge: presets first, then club's custom templates
  const allTemplates = [
    ...(presets ?? []).map((t) => ({ ...t, is_preset: true })),
    ...(clubTemplates ?? []).filter((t) => !t.is_preset),
  ]

  // Apply cert_type filter from URL if present
  const certFiltered = certTypeFilter
    ? allTemplates.filter((t) => t.cert_type === certTypeFilter || t.cert_type === 'volunteer')
    : allTemplates

  const filteredTemplates = certFiltered.filter((t) => {
    if (filter === 'preset') return t.is_preset
    if (filter === 'custom') return !t.is_preset
    return true
  })

  const handleSelect = (template) => {
    setSelected(template)
    if (isModal && onSelect) onSelect(template)
  }

  const handleConfirm = async () => {
    if (!selected) return
    if (isModal && onSelect) {
      onSelect(selected)
      onClose?.()
    } else {
      // Assign and go back
      try {
        await assignPreset.mutateAsync({
          preset_id: selected.id ?? selected._id,
          cert_type: certTypeFilter ?? selected.cert_type,
        })
        navigate(-1)
      } catch {
        // Error handled by mutation
      }
    }
  }

  const handleBuildCustom = () => {
    if (isModal) onClose?.()
    navigate(`/club/${clubId}/templates/new`)
  }

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
        <div>
          <h2 className="text-base font-bold text-foreground">
            Choose a Template
            {certTypeFilter && (
              <span className="ml-2 text-sm font-normal text-gray-400 capitalize">
                — {certTypeFilter.replace(/_/g, ' ')}
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Select a preset certificate design or build a custom one.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isModal && (
            <button
              onClick={() => navigate(-1)}
              className="btn-ghost text-sm flex items-center gap-1.5"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          )}
          {isModal && (
            <button
              onClick={onClose}
              className="rounded p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-3 shrink-0">
        {['all', 'preset', 'custom'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`
              rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors
              ${filter === f
                ? 'bg-navy text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-navy/10 hover:text-navy'
              }
            `}
          >
            {f === 'all' ? 'All Templates' : f === 'preset' ? `Presets (${(presets ?? []).length})` : 'Custom'}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <LoadingSpinner fullPage label="Loading templates…" />
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <svg className="h-10 w-10 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-500">Failed to load templates.</p>
            <button
              className="btn-secondary text-xs"
              onClick={() => { refetchClub(); refetchPresets() }}
            >
              Retry
            </button>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            <p className="text-sm text-gray-500">
              {filter === 'custom' ? 'No custom templates yet.' : 'No templates found.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filteredTemplates.map((t) => (
              <TemplateCard
                key={t._id ?? t.id}
                template={t}
                selected={selected?.id === (t._id ?? t.id) || selected?._id === (t._id ?? t.id)}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 shrink-0">
        <button
          id="template-selector-build-custom"
          className="btn-ghost text-sm"
          onClick={handleBuildCustom}
        >
          + Build Custom Template
        </button>
        <div className="flex gap-3">
          {isModal && (
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          )}
          <button
            id="template-selector-confirm"
            className="btn-primary"
            disabled={!selected || assignPreset.isPending}
            onClick={handleConfirm}
          >
            {assignPreset.isPending ? (
              <><LoadingSpinner size="sm" label="" /> Assigning…</>
            ) : (
              'Use This Template'
            )}
          </button>
        </div>
      </div>
    </div>
  )

  // ── Modal wrapper ──────────────────────────────────────────────────────────
  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div
          className="relative z-10 flex flex-col w-full max-w-4xl rounded-2xl bg-white shadow-modal overflow-hidden"
          style={{ maxHeight: '85vh', animation: 'fadeIn 0.15s ease-out' }}
        >
          {content}
        </div>
      </div>
    )
  }

  // ── Standalone page ────────────────────────────────────────────────────────
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden bg-background">
          <div className="h-full flex flex-col">
            {content}
          </div>
        </main>
      </div>
    </div>
  )
}
