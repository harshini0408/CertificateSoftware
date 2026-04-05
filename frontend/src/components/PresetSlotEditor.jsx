import { useState, useEffect, useRef, useCallback } from 'react'
import { useUpdatePresetSlots } from '../api/templates'
import LoadingSpinner from './LoadingSpinner'

// ── A4 canvas constants ─────────────────────────────────────────────────────
const CANVAS_W = 2480
const CANVAS_H = 3508

// ── Color map for cert-type themed slot outlines ─────────────────────────────
const CERT_ACCENT = {
  participant:  '#1B4D3E',
  coordinator:  '#1B5E20',
  winner_1st:   '#DAA520',
  winner_2nd:   '#8C8C8C',
  winner_3rd:   '#CD7F32',
  volunteer:    '#B8860B',
}

// ── Slot rectangle on the live canvas ────────────────────────────────────────
function SlotBox({ slot, scale, accentColor }) {
  const fontSize = Math.max(slot.font_size * scale, 6)

  return (
    <div
      style={{
        position: 'absolute',
        left: `${slot.x * scale}px`,
        top: `${slot.y * scale}px`,
        width: `${slot.width * scale}px`,
        height: `${slot.height * scale}px`,
        border: '2px dashed #6366f1',
        background: 'rgba(99, 102, 241, 0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
      }}
    >
      <span
        style={{
          fontSize: `${fontSize}px`,
          color: '#6366f1',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          padding: '0 4px',
          lineHeight: 1.2,
        }}
      >
        {slot.label}
      </span>
    </div>
  )
}

// ── Live A4 Canvas Preview ──────────────────────────────────────────────────
function CanvasPreview({ slots, certType, bgColor }) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(0.2)

  const recalcScale = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const scaleW = rect.width / CANVAS_W
    const maxH = window.innerHeight - 128
    const scaleH = maxH / CANVAS_H
    setScale(Math.min(scaleW, scaleH, 0.35))
  }, [])

  useEffect(() => {
    recalcScale()
    window.addEventListener('resize', recalcScale)
    return () => window.removeEventListener('resize', recalcScale)
  }, [recalcScale])

  const accent = CERT_ACCENT[certType] ?? '#6366f1'

  return (
    <div ref={containerRef} className="flex flex-col items-center w-full">
      <div
        className="relative overflow-hidden rounded-lg shadow-lg"
        style={{
          width: `${CANVAS_W * scale}px`,
          height: `${CANVAS_H * scale}px`,
          background: bgColor || '#FFFDF7',
          border: `3px solid ${accent}20`,
        }}
      >
        {/* Corner decorations */}
        <div style={{ position: 'absolute', top: 4*scale, left: 4*scale, right: 4*scale, bottom: 4*scale, border: `${2*scale}px solid ${accent}40`, borderRadius: 4*scale, pointerEvents: 'none' }} />

        {/* Certificate title watermark */}
        <div
          className="absolute inset-0 flex flex-col items-center pointer-events-none select-none"
          style={{ paddingTop: `${400 * scale}px` }}
        >
          <span style={{ fontSize: `${80 * scale}px`, color: `${accent}30`, fontWeight: 700, letterSpacing: `${6*scale}px`, textTransform: 'uppercase' }}>
            CERTIFICATE
          </span>
        </div>

        {/* Logo placeholder */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            top: `${160 * scale}px`,
            left: `${140 * scale}px`,
            width: `${200 * scale}px`,
            height: `${200 * scale}px`,
            border: `1.5px dashed ${accent}40`,
            borderRadius: `${4 * scale}px`,
            background: `${accent}08`,
          }}
        >
          <span style={{ fontSize: `${Math.max(9 * scale, 6)}px`, color: `${accent}60` }}>LOGO</span>
        </div>

        {/* Signature placeholder */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            bottom: `${420 * scale}px`,
            left: `${200 * scale}px`,
            width: `${500 * scale}px`,
            height: `${60 * scale}px`,
            borderTop: `1.5px solid ${accent}30`,
          }}
        >
          <span style={{ fontSize: `${Math.max(9 * scale, 6)}px`, color: `${accent}50` }}>SIGNATURE</span>
        </div>

        {/* Dynamic field slot boxes */}
        {slots.map((slot) => (
          <SlotBox
            key={slot.slot_id}
            slot={slot}
            scale={scale}
            accentColor={accent}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border-2 border-dashed border-indigo-400 bg-indigo-50" />
          Dynamic fields
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-dashed" style={{ borderColor: `${accent}60` }} />
          Fixed zones
        </span>
      </div>
      <p className="mt-1 text-[10px] text-gray-400 text-center">
        Dashed boxes = dynamic fields. Position is locked on presets.
      </p>
    </div>
  )
}

// ── Main PresetSlotEditor ───────────────────────────────────────────────────
export default function PresetSlotEditor({ isOpen, onClose, clubId, eventId, certType, template }) {
  const updateSlots = useUpdatePresetSlots(clubId, eventId)
  const [editedSlots, setEditedSlots] = useState([])
  const [originalSlots, setOriginalSlots] = useState([])
  const [hasChanged, setHasChanged] = useState(false)

  // Seed from template on open
  useEffect(() => {
    if (template?.field_slots) {
      const mapped = template.field_slots.map(s => ({
        slot_id: s.slot_id ?? s.name,
        label: s.label ?? s.slot_id ?? s.name,
        x: s.x ?? 0,
        y: s.y ?? 0,
        width: s.width ?? 200,
        height: s.height ?? 50,
        font_size: s.font_size ?? 24,
        font_weight: s.font_weight ?? 'normal',
        text_align: s.text_align ?? 'center',
      }))
      setEditedSlots(mapped)
      setOriginalSlots(JSON.parse(JSON.stringify(mapped)))
      setHasChanged(false)
    }
  }, [template])

  const handleChange = (index, field, value) => {
    const updated = [...editedSlots]
    updated[index] = { ...updated[index], [field]: Number(value) || 0 }
    setEditedSlots(updated)
    setHasChanged(true)
  }

  const resetToDefaults = () => {
    setEditedSlots(JSON.parse(JSON.stringify(originalSlots)))
    setHasChanged(false)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    updateSlots.mutate({
      cert_type: certType,
      slot_updates: editedSlots.map(s => ({
        slot_id: s.slot_id,
        width: s.width,
        height: s.height,
        font_size: s.font_size,
      })),
    }, {
      onSuccess: () => {
        setHasChanged(false)
        onClose()
      },
    })
  }

  if (!isOpen) return null

  const bgColor = template?.background?.value ?? '#FFFDF7'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-xl w-full overflow-hidden"
        style={{ maxWidth: '1200px', maxHeight: '90vh', animation: 'fadeIn 0.15s ease-out' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-navy">Adjust Field Slots</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Resize slots for <b className="capitalize">{(certType ?? '').replace(/_/g, ' ')}</b>
              {template?.name && <> — {template.name}</>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — two panels */}
        <div className="flex flex-col lg:flex-row overflow-hidden" style={{ maxHeight: 'calc(90vh - 4rem)' }}>

          {/* ── Left: Controls (40%) ─────────────────────────────── */}
          <div className="w-full lg:w-[40%] border-r border-gray-100 overflow-y-auto">
            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {/* Info banner */}
              <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
                <svg className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-blue-700">
                    {editedSlots.length} dynamic field slot{editedSlots.length !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Your Excel file must have matching columns for each slot.
                  </p>
                </div>
              </div>

              {/* Slot controls */}
              {editedSlots.length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-8">No field slots to edit.</div>
              ) : (
                <div className="space-y-3">
                  {editedSlots.map((slot, i) => (
                    <div key={slot.slot_id} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-600">
                          {i + 1}
                        </span>
                        {slot.label}
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">
                            Width (px)
                          </label>
                          <input
                            type="number"
                            min={10}
                            max={2480}
                            value={slot.width}
                            onChange={(e) => handleChange(i, 'width', e.target.value)}
                            className="form-input py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">
                            Height (px)
                          </label>
                          <input
                            type="number"
                            min={10}
                            max={3508}
                            value={slot.height}
                            onChange={(e) => handleChange(i, 'height', e.target.value)}
                            className="form-input py-1.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1 block">
                            Font (px)
                          </label>
                          <input
                            type="number"
                            min={12}
                            max={200}
                            value={slot.font_size}
                            onChange={(e) => handleChange(i, 'font_size', e.target.value)}
                            className="form-input py-1.5 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Note */}
              <p className="text-[10px] text-gray-400 text-center italic">
                Position (x, y) is set during the Field Mapping step.
              </p>

              {/* Actions */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={resetToDefaults}
                  disabled={!hasChanged}
                  className="btn-ghost text-xs disabled:opacity-40"
                >
                  Reset to Default
                </button>
                <div className="flex gap-3">
                  <button type="button" onClick={onClose} className="btn-secondary text-sm">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!hasChanged || updateSlots.isPending}
                    className="btn-primary text-sm disabled:opacity-50"
                  >
                    {updateSlots.isPending ? (
                      <><LoadingSpinner size="sm" label="" /> Saving…</>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* ── Right: Live Canvas Preview (60%) ─────────────────── */}
          <div className="hidden lg:flex w-[60%] bg-gray-50 p-6 items-start justify-center overflow-y-auto">
            <CanvasPreview
              slots={editedSlots}
              certType={certType}
              bgColor={bgColor}
            />
          </div>

          {/* Mobile: canvas below */}
          <div className="lg:hidden bg-gray-50 p-4 border-t border-gray-100 overflow-y-auto">
            <CanvasPreview
              slots={editedSlots}
              certType={certType}
              bgColor={bgColor}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
