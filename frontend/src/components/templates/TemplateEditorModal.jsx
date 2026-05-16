/**
 * TemplateEditorModal.jsx  —  Visual certificate slot editor
 *
 * No raw HTML is shown. Users see an A4 canvas representing the
 * certificate, with each field slot rendered as a draggable box.
 * Clicking a slot opens its properties in the right panel.
 *
 * Flow:
 *  1. On open → fork the preset (if not already a fork) → get forkId
 *  2. Load field_slots from GET /templates/:forkId/html
 *  3. Render A4 canvas at ~45% scale with draggable slot boxes
 *  4. Properties panel: label, font size, weight, align, color, x/y/w/h
 *  5. Save → PATCH /templates/:forkId/html with updated field_slots
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  useForkTemplate,
  useTemplateHtml,
  useUpdateTemplateHtml,
  useTemplate,
  templateKeys,
} from '../../api/templates'
import LoadingSpinner from '../LoadingSpinner'
import { useToastStore } from '../../store/uiStore'

// ── A4 reference canvas (300 DPI) ────────────────────────────────────────────
const REF_W = 2480
const REF_H = 3508

// ─────────────────────────────────────────────────────────────────────────────
// DraggableSlot — a single field slot box on the canvas
// ─────────────────────────────────────────────────────────────────────────────
function DraggableSlot({ slot, scale, isSelected, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: slot.slot_id })

  const style = {
    position: 'absolute',
    left: slot.x * scale,
    top: slot.y * scale,
    width: slot.width * scale,
    height: slot.height * scale,
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 200 : isSelected ? 10 : 2,
    cursor: isDragging ? 'grabbing' : 'grab',
    display: 'flex',
    alignItems: 'center',
    justifyContent:
      slot.text_align === 'center'
        ? 'center'
        : slot.text_align === 'right'
          ? 'flex-end'
          : 'flex-start',
    boxSizing: 'border-box',
    userSelect: 'none',
    transition: isDragging ? 'none' : 'box-shadow 0.12s',
  }

  const borderColor = isSelected ? '#3B82F6' : isDragging ? '#60A5FA' : 'rgba(99,102,241,0.55)'
  const bgColor = isSelected
    ? 'rgba(59,130,246,0.08)'
    : isDragging
      ? 'rgba(96,165,250,0.12)'
      : 'rgba(99,102,241,0.04)'

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        border: `${Math.max(1, 1.5 * scale)}px dashed ${borderColor}`,
        background: bgColor,
        borderRadius: 3 * scale,
        boxShadow: isSelected
          ? `0 0 0 ${2 * scale}px rgba(59,130,246,0.25)`
          : 'none',
      }}
      onClick={e => { e.stopPropagation(); onSelect(slot.slot_id) }}
      {...listeners}
      {...attributes}
    >
      <span
        style={{
          fontSize: Math.max(8, slot.font_size * scale * 0.55),
          fontWeight: slot.font_weight,
          color: slot.color || '#1B4D3E',
          textAlign: slot.text_align,
          width: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          padding: `0 ${4 * scale}px`,
          opacity: 0.9,
          pointerEvents: 'none',
        }}
      >
        {slot.label || slot.slot_id}
      </span>

      {/* Selection handle label */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: -22 * scale,
          left: 0,
          background: '#3B82F6',
          color: '#fff',
          fontSize: Math.max(8, 9 * scale),
          fontWeight: 700,
          padding: `${1 * scale}px ${5 * scale}px`,
          borderRadius: `${3 * scale}px ${3 * scale}px 0 0`,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {slot.label || slot.slot_id}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// A4Canvas — scaled certificate preview with draggable slots
// ─────────────────────────────────────────────────────────────────────────────
function A4Canvas({ template, slots, selectedId, onSelect, onDragEnd, canvasWidth }) {
  const scale = canvasWidth / REF_W
  const canvasHeight = REF_H * scale

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } })
  )

  const [activeSlotId, setActiveSlotId] = useState(null)

  // Background style from template metadata
  const bg = template?.background
  let bgStyle = { backgroundColor: '#FFFDF7' }
  if (bg?.value?.includes('gradient')) {
    bgStyle = { background: bg.value }
  } else if (bg?.value) {
    bgStyle = { backgroundColor: bg.value }
  }

  const borderColor = template?.border_color || '#1B4D3E'
  const accentColor = '#C9A84C'

  const handleDragStart = ({ active }) => setActiveSlotId(active.id)

  const handleDragEnd = ({ active, delta }) => {
    setActiveSlotId(null)
    if (!active) return
    onDragEnd(active.id, delta.x / scale, delta.y / scale)
  }

  const activeSlot = slots.find(s => s.slot_id === activeSlotId)

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        id="cert-canvas"
        style={{
          position: 'relative',
          width: canvasWidth,
          height: canvasHeight,
          ...bgStyle,
          flexShrink: 0,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          overflow: 'hidden',
          borderRadius: 4,
        }}
        onClick={() => onSelect(null)}
      >
        {/* ── Outer decorative border ── */}
        <div style={{
          position: 'absolute',
          top: 40 * scale, left: 40 * scale,
          right: 40 * scale, bottom: 40 * scale,
          border: `${8 * scale}px solid ${borderColor}`,
          borderRadius: 14 * scale,
          pointerEvents: 'none',
        }} />
        {/* ── Inner accent border ── */}
        <div style={{
          position: 'absolute',
          top: 65 * scale, left: 65 * scale,
          right: 65 * scale, bottom: 65 * scale,
          border: `${2 * scale}px solid ${accentColor}`,
          pointerEvents: 'none',
        }} />

        {/* ── Corner ornaments ── */}
        {[
          { top: 80 * scale, left: 80 * scale, borderTop: `${3 * scale}px solid ${accentColor}`, borderLeft: `${3 * scale}px solid ${accentColor}` },
          { top: 80 * scale, right: 80 * scale, borderTop: `${3 * scale}px solid ${accentColor}`, borderRight: `${3 * scale}px solid ${accentColor}` },
          { bottom: 80 * scale, left: 80 * scale, borderBottom: `${3 * scale}px solid ${accentColor}`, borderLeft: `${3 * scale}px solid ${accentColor}` },
          { bottom: 80 * scale, right: 80 * scale, borderBottom: `${3 * scale}px solid ${accentColor}`, borderRight: `${3 * scale}px solid ${accentColor}` },
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute', width: 100 * scale, height: 100 * scale,
            ...s, pointerEvents: 'none',
          }} />
        ))}

        {/* ── Certificate header (static visual) ── */}
        <div style={{
          position: 'absolute',
          top: 360 * scale, width: '100%',
          textAlign: 'center', pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: 72 * scale, fontWeight: 800,
            color: borderColor, letterSpacing: 6 * scale,
            fontFamily: template?.font_family || 'Georgia, serif',
            textTransform: 'uppercase',
          }}>
            Certificate
          </div>
          <div style={{
            fontSize: 36 * scale, color: accentColor,
            letterSpacing: 8 * scale, textTransform: 'uppercase',
            marginTop: 10 * scale,
            fontFamily: template?.font_family || 'Georgia, serif',
          }}>
            {template?.cert_type?.replace(/_/g, ' ') || 'of Achievement'}
          </div>
        </div>

        {/* ── Divider line ── */}
        <div style={{
          position: 'absolute',
          top: 560 * scale, left: 300 * scale, right: 300 * scale,
          height: 1.5 * scale,
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          pointerEvents: 'none',
        }} />

        {/* ── Fixed zone hints ── */}
        <ZoneHint label="LOGO" x={140} y={140} w={200} h={200} color="#3B82F6" scale={scale} />
        <ZoneHint label="SIGNATURE" x={140} y={REF_H - 580} w={500} h={160} color="#F59E0B" scale={scale} />

        {/* ── Centre watermark ── */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: 28 * scale, fontWeight: 800,
            color: 'rgba(0,0,0,0.035)', textTransform: 'uppercase',
            letterSpacing: 6 * scale,
          }}>
            Preview
          </span>
        </div>

        {/* ── Draggable field slots ── */}
        {slots.map(slot => (
          <DraggableSlot
            key={slot.slot_id}
            slot={slot}
            scale={scale}
            isSelected={slot.slot_id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Drag ghost */}
      <DragOverlay dropAnimation={null}>
        {activeSlot ? (
          <div style={{
            width: activeSlot.width * scale,
            height: activeSlot.height * scale,
            border: '2px dashed #3B82F6',
            background: 'rgba(59,130,246,0.12)',
            borderRadius: 3 * scale,
            opacity: 0.7,
          }} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function ZoneHint({ label, x, y, w, h, color, scale }) {
  return (
    <div style={{
      position: 'absolute',
      left: x * scale, top: y * scale,
      width: w * scale, height: h * scale,
      border: `${1.5 * scale}px dashed ${color}`,
      borderRadius: 3 * scale,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
      background: `${color}08`,
    }}>
      <span style={{ fontSize: Math.max(7, 9 * scale), color, fontWeight: 700, letterSpacing: 1 }}>
        {label}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PropertiesPanel
// ─────────────────────────────────────────────────────────────────────────────
function PropertiesPanel({ slot, onChange }) {
  if (!slot) {
    return (
      <div style={{
        width: 240, flexShrink: 0, borderLeft: '1px solid #e5e7eb',
        background: '#FAFAFA', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 24,
      }}>
        <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
          <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} style={{ margin: '0 auto 10px', display: 'block' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
          </svg>
          <p style={{ fontSize: 12, lineHeight: 1.5 }}>
            Click any field slot on the canvas to edit its properties
          </p>
        </div>
      </div>
    )
  }

  const lbl = (text) => (
    <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#6B7280', marginBottom: 4 }}>
      {text}
    </label>
  )

  const inp = (key, type = 'text', extra = {}) => (
    <input
      type={type}
      value={slot[key] ?? ''}
      onChange={e => onChange({ [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
      style={{
        width: '100%', padding: '5px 8px',
        border: '1px solid #e5e7eb', borderRadius: 6,
        fontSize: 12, background: '#fff', boxSizing: 'border-box',
        fontFamily: type === 'number' ? 'monospace' : 'inherit',
      }}
      {...extra}
    />
  )

  return (
    <div style={{
      width: 240, flexShrink: 0, borderLeft: '1px solid #e5e7eb',
      background: '#fff', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', background: '#F9FAFB' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>Field Properties</div>
        <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, fontFamily: 'monospace' }}>
          {slot.slot_id}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>

        {/* Label */}
        <div style={{ marginBottom: 12 }}>
          {lbl('Display Label')}
          {inp('label')}
          <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3 }}>
            This name appears in the certificate
          </p>
        </div>

        {/* Position */}
        <div style={{ marginBottom: 12 }}>
          {lbl('Position (px)')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div>
              <span style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 2 }}>X (left)</span>
              {inp('x', 'number', { min: 0, max: REF_W, step: 10 })}
            </div>
            <div>
              <span style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 2 }}>Y (top)</span>
              {inp('y', 'number', { min: 0, max: REF_H, step: 10 })}
            </div>
          </div>
        </div>

        {/* Size */}
        <div style={{ marginBottom: 12 }}>
          {lbl('Size (px)')}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div>
              <span style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 2 }}>Width</span>
              {inp('width', 'number', { min: 50, max: REF_W, step: 10 })}
            </div>
            <div>
              <span style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 2 }}>Height</span>
              {inp('height', 'number', { min: 20, max: REF_H, step: 10 })}
            </div>
          </div>
        </div>

        {/* Font size */}
        <div style={{ marginBottom: 12 }}>
          {lbl('Font Size (px)')}
          {inp('font_size', 'number', { min: 6, max: 300, step: 2 })}
        </div>

        {/* Font weight */}
        <div style={{ marginBottom: 12 }}>
          {lbl('Font Weight')}
          <select
            value={slot.font_weight || 'normal'}
            onChange={e => onChange({ font_weight: e.target.value })}
            style={{ width: '100%', padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12 }}
          >
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        </div>

        {/* Alignment */}
        <div style={{ marginBottom: 12 }}>
          {lbl('Text Align')}
          <div style={{ display: 'flex', gap: 4 }}>
            {['left', 'center', 'right'].map(a => (
              <button
                key={a}
                onClick={() => onChange({ text_align: a })}
                style={{
                  flex: 1, padding: '5px 0', fontSize: 11,
                  border: `1px solid ${slot.text_align === a ? '#3B82F6' : '#e5e7eb'}`,
                  background: slot.text_align === a ? '#EFF6FF' : '#fff',
                  color: slot.text_align === a ? '#1D4ED8' : '#6B7280',
                  borderRadius: 6, cursor: 'pointer', textTransform: 'capitalize',
                }}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div style={{ marginBottom: 12 }}>
          {lbl('Text Color')}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={slot.color || '#1B4D3E'}
              onChange={e => onChange({ color: e.target.value })}
              style={{ width: 32, height: 32, border: '1px solid #e5e7eb', borderRadius: 4, padding: 2, cursor: 'pointer' }}
            />
            <input
              type="text"
              value={slot.color || '#1B4D3E'}
              onChange={e => onChange({ color: e.target.value })}
              maxLength={7}
              style={{ flex: 1, padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }}
            />
          </div>
        </div>

        {/* Coordinate readout */}
        <div style={{
          marginTop: 8, padding: '8px 10px',
          background: '#F9FAFB', borderRadius: 6,
          border: '1px solid #F3F4F6',
        }}>
          <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>
            pos ({Math.round(slot.x)}, {Math.round(slot.y)})
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace', marginTop: 2 }}>
            size {Math.round(slot.width)} × {Math.round(slot.height)}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TemplateEditorModal — main export
// ─────────────────────────────────────────────────────────────────────────────
export default function TemplateEditorModal({ templateId, onClose }) {
  const addToast = useToastStore(s => s.addToast)
  const qc = useQueryClient()

  // ── API ──────────────────────────────────────────────────────────────────
  const { data: baseTemplate } = useTemplate(templateId)
  const forkMutation = useForkTemplate()

  const [forkId, setForkId] = useState(null)

  // updateMutation is bound to forkId (re-hooks when forkId changes)
  const updateMutation = useUpdateTemplateHtml(forkId)

  // Fork on mount
  useEffect(() => {
    if (!templateId) return
    forkMutation.mutate(templateId, {
      onSuccess: (res) => {
        const forked = res?.data
        if (forked?.id) {
          setForkId(forked.id)
        } else {
          console.error('[TemplateEditorModal] unexpected fork response', res)
          addToast({ type: 'error', message: 'Could not set up editor. Please try again.' })
        }
      },
    })
  }, [templateId]) // eslint-disable-line

  const { data: htmlData, isLoading: htmlLoading } = useTemplateHtml(forkId)

  // ── Local slot state ────────────────────────────────────────────────────
  const [slots, setSlots] = useState([])      // working copy of field_slots
  const [selectedId, setSelectedId] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [showConfirmClose, setShowConfirmClose] = useState(false)

  // Seed slots once loaded
  useEffect(() => {
    if (seeded || !htmlData?.field_slots) return
    setSlots(htmlData.field_slots.map(s => ({ ...s })))
    setSeeded(true)
  }, [htmlData, seeded])

  // ── Canvas width tracking ────────────────────────────────────────────────
  const canvasContainerRef = useRef(null)
  const [canvasWidth, setCanvasWidth] = useState(500)

  useEffect(() => {
    const el = canvasContainerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setCanvasWidth(Math.max(280, w - 48))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── Slot operations ──────────────────────────────────────────────────────
  const updateSlot = useCallback((patch) => {
    setSlots(prev =>
      prev.map(s => s.slot_id === selectedId ? { ...s, ...patch } : s)
    )
    setIsDirty(true)
  }, [selectedId])

  const handleDragEnd = useCallback((slotId, dx, dy) => {
    setSlots(prev =>
      prev.map(s =>
        s.slot_id === slotId
          ? {
              ...s,
              x: Math.max(0, Math.min(REF_W - s.width, s.x + dx)),
              y: Math.max(0, Math.min(REF_H - s.height, s.y + dy)),
            }
          : s
      )
    )
    setIsDirty(true)
  }, [])

  // ── Save ───────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!forkId) return
    const html_content = htmlData?.html_content || ''
    const field_slots = slots.map(s => ({
      slot_id:     s.slot_id,
      label:       s.label,
      x:           Math.round(s.x),
      y:           Math.round(s.y),
      width:       Math.round(s.width),
      height:      Math.round(s.height),
      font_size:   s.font_size,
      font_weight: s.font_weight,
      text_align:  s.text_align,
      color:       s.color,
    }))

    updateMutation.mutate(
      { html_content, field_slots },
      {
        onSuccess: () => {
          setIsDirty(false)
          // Refresh the templates list in the background
          qc.invalidateQueries({ queryKey: templateKeys.all() })
          // Close the modal automatically after saving
          onClose()
        },
      }
    )
  }

  // ── Close guard ─────────────────────────────────────────────────────────
  const handleClose = () => {
    if (isDirty) setShowConfirmClose(true)
    else onClose()
  }

  const selectedSlot = useMemo(
    () => slots.find(s => s.slot_id === selectedId) || null,
    [slots, selectedId]
  )

  const isSetupLoading = !forkId || htmlLoading || forkMutation.isPending

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', flexDirection: 'column',
      background: 'rgba(15,23,42,0.55)',
      backdropFilter: 'blur(4px)',
    }}>
      {/* Confirm discard */}
      {showConfirmClose && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.4)',
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 28,
            maxWidth: 380, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: '#111' }}>
              Unsaved Changes
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#6B7280' }}>
              You have unsaved slot changes. Close anyway and discard them?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirmClose(false)}
                style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}
              >
                Keep Editing
              </button>
              <button
                onClick={() => { setShowConfirmClose(false); onClose() }}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Discard & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main modal */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', width: '100%',
        background: '#fff', overflow: 'hidden',
        borderTop: '3px solid #6366F1',
      }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #e5e7eb',
          background: '#FAFAFA', flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111' }}>
              Edit Certificate Layout
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6B7280' }}>
              {baseTemplate?.name || 'Loading…'}
              &nbsp;·&nbsp;
              Drag field slots to reposition · Click to edit properties
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isDirty && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: '#B45309',
                background: '#FEF3C7', border: '1px solid #FCD34D',
                padding: '3px 10px', borderRadius: 999,
              }}>
                Unsaved changes
              </span>
            )}
            <button
              id="save-slot-changes-btn"
              onClick={handleSave}
              disabled={!isDirty || updateMutation.isPending || !forkId}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 8,
                background: isDirty && forkId ? '#1E3A5F' : '#E5E7EB',
                color: isDirty && forkId ? '#fff' : '#9CA3AF',
                border: 'none', fontSize: 13, fontWeight: 600,
                cursor: isDirty && forkId ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s',
              }}
            >
              {updateMutation.isPending ? 'Saving…' : '✓ Save Changes'}
            </button>
            {/* Always-visible close / back button */}
            <button
              id="close-template-editor-btn"
              onClick={handleClose}
              title="Close editor"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none',
                border: '1px solid #e5e7eb',
                borderRadius: 8, padding: '7px 14px',
                cursor: 'pointer', color: '#374151', fontSize: 13,
                fontWeight: 500,
              }}
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        {isSetupLoading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
            <LoadingSpinner label="Setting up editor…" />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* Canvas area */}
            <div
              ref={canvasContainerRef}
              style={{
                flex: 1, overflowY: 'auto',
                background: '#F3F4F6',
                padding: 24,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 16,
              }}
              onClick={() => setSelectedId(null)}
            >
              {/* Scale indicator */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                width: canvasWidth, flexShrink: 0,
              }}>
                <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>
                  A4 Canvas · {Math.round((canvasWidth / REF_W) * 100)}% scale
                </span>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                  {slots.length} field slot{slots.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* The A4 canvas */}
              <A4Canvas
                template={baseTemplate}
                slots={slots}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDragEnd={handleDragEnd}
                canvasWidth={canvasWidth}
              />

              {/* Slot list */}
              {slots.length > 0 && (
                <div style={{
                  width: canvasWidth, flexShrink: 0,
                  background: '#fff', borderRadius: 10,
                  border: '1px solid #e5e7eb', overflow: 'hidden',
                }}>
                  <div style={{ padding: '8px 14px', background: '#FAFAFA', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#6B7280' }}>
                      Field Slots
                    </span>
                  </div>
                  {slots.map((slot, i) => (
                    <div
                      key={slot.slot_id}
                      onClick={e => { e.stopPropagation(); setSelectedId(slot.slot_id) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 14px',
                        borderBottom: i < slots.length - 1 ? '1px solid #F9FAFB' : 'none',
                        background: slot.slot_id === selectedId ? '#EFF6FF' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: slot.color || '#1B4D3E', flexShrink: 0,
                        border: '1px solid rgba(0,0,0,0.1)',
                      }} />
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, flex: 1 }}>
                        {slot.label || slot.slot_id}
                      </span>
                      <span style={{ fontSize: 10, color: '#9CA3AF', fontFamily: 'monospace' }}>
                        {slot.font_size}px · ({Math.round(slot.x)}, {Math.round(slot.y)})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Properties panel */}
            <PropertiesPanel
              slot={selectedSlot}
              onChange={updateSlot}
            />
          </div>
        )}
      </div>
    </div>
  )
}
