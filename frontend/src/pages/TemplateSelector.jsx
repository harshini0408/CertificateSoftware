import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTemplates, usePresetTemplates, useAssignPreset } from '../api/templates'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Cert type badge colours ───────────────────────────────────────────────────
const certTypeMeta = {
  participant:  { label: 'Participant',  cls: 'bg-blue-100 text-blue-700' },
  coordinator:  { label: 'Coordinator', cls: 'bg-purple-100 text-purple-700' },
  winner_1st:   { label: '1st Place',   cls: 'bg-amber-100 text-amber-700' },
  winner_2nd:   { label: '2nd Place',   cls: 'bg-gray-100  text-gray-600' },
  winner_3rd:   { label: '3rd Place',   cls: 'bg-orange-100 text-orange-700' },
  mentor:       { label: 'Mentor',      cls: 'bg-green-100 text-green-700' },
  judge:        { label: 'Judge',       cls: 'bg-red-100   text-red-700' },
  volunteer:    { label: 'Volunteer',   cls: 'bg-teal-100  text-teal-700' },
}

// ── Mini certificate thumbnail ────────────────────────────────────────────────
function CertThumbnail({ template }) {
  const bg = template?.background ?? {}
  const typography = template?.typography ?? {}

  const bgStyle =
    bg.type === 'gradient' && bg.colors?.length >= 2
      ? { background: `linear-gradient(135deg, ${bg.colors[0]}, ${bg.colors[1]})` }
      : { backgroundColor: bg.colors?.[0] ?? '#FFFFFF' }

  return (
    <div
      className="relative h-32 w-full rounded-md overflow-hidden flex flex-col items-center justify-center gap-1 border border-gray-100"
      style={bgStyle}
    >
      {/* Watermark lines */}
      <div
        className="w-3/4 h-1 rounded-full opacity-30"
        style={{ backgroundColor: typography.font_color ?? '#1E3A5F' }}
      />
      <div
        className="w-1/2 h-0.5 rounded-full opacity-20"
        style={{ backgroundColor: typography.font_color ?? '#1E3A5F' }}
      />
      <div
        className="w-1/3 h-0.5 rounded-full opacity-15"
        style={{ backgroundColor: typography.font_color ?? '#1E3A5F' }}
      />

      {/* Preset badge */}
      {template?.is_preset && (
        <span className="absolute top-2 right-2 rounded-full bg-gold/90 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow">
          Preset
        </span>
      )}
    </div>
  )
}

// ── Template card ─────────────────────────────────────────────────────────────
function TemplateCard({ template, selected, onSelect }) {
  const meta = certTypeMeta[template.cert_type] ?? { label: template.cert_type, cls: 'bg-gray-100 text-gray-600' }

  return (
    <button
      onClick={() => onSelect(template)}
      className={`
        group flex flex-col gap-3 rounded-xl border-2 p-3 text-left
        transition-all duration-150
        ${selected
          ? 'border-navy bg-navy/5 shadow-md'
          : 'border-gray-200 bg-white hover:border-navy/40 hover:shadow-sm'
        }
      `}
    >
      {/* Thumbnail */}
      <CertThumbnail template={template} />

      {/* Info */}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground truncate group-hover:text-navy transition-colors">
          {template.name}
        </p>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
          {meta.label}
        </span>
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
/**
 * Can be used as:
 *   1. A modal — pass `onSelect` + `onClose` props (isModal=true)
 *   2. A standalone page — no props needed, uses URL params
 */
export default function TemplateSelector({
  isModal = false,
  onSelect,
  onClose,
  clubId: propClubId,
  eventId: propEventId,
}) {
  const params = useParams()
  const navigate = useNavigate()

  const clubId  = propClubId  ?? params.club_id
  const eventId = propEventId ?? params.event_id

  const [selected, setSelected] = useState(null)
  const [filter, setFilter]     = useState('all')   // 'all' | 'preset' | 'custom'

  const { data: clubTemplates, isLoading: clubLoading } = useTemplates(clubId)
  const { data: presets,       isLoading: presetsLoading } = usePresetTemplates()

  const assignPreset = useAssignPreset(clubId, eventId)

  const isLoading = clubLoading || presetsLoading

  // Merge: presets first, then club's custom templates
  const allTemplates = [
    ...(presets ?? []).map((t) => ({ ...t, is_preset: true })),
    ...(clubTemplates ?? []).filter((t) => !t.is_preset),
  ]

  const filteredTemplates = allTemplates.filter((t) => {
    if (filter === 'preset') return t.is_preset
    if (filter === 'custom') return !t.is_preset
    return true
  })

  const handleSelect = (template) => {
    setSelected(template)
    if (isModal && onSelect) onSelect(template)        // immediate select in modal
  }

  const handleConfirm = () => {
    if (!selected) return
    if (isModal && onSelect) {
      onSelect(selected)
      onClose?.()
    } else {
      navigate(-1)
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
          <h2 className="text-base font-bold text-foreground">Choose a Template</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Select a preset certificate design or build a custom one.
          </p>
        </div>
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
            {f === 'all' ? 'All Templates' : f === 'preset' ? 'Presets (6)' : 'Custom'}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <LoadingSpinner fullPage label="Loading templates…" />
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
                selected={selected?._id === (t._id ?? t.id) || selected?.id === (t._id ?? t.id)}
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
            disabled={!selected}
            onClick={handleConfirm}
          >
            Use This Template
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
    <div className="min-h-dvh bg-background">
      <div className="page-container">
        <div className="card overflow-hidden" style={{ height: '80vh' }}>
          {content}
        </div>
      </div>
    </div>
  )
}
