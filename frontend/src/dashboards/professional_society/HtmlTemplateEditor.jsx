/**
 * ⚠️  DEPRECATED — NOT ROUTED
 *
 * This page component is no longer reachable via the application router (App.jsx).
 * It was superseded by:
 *   - TemplateSelector.jsx   — browse & select image-based PNG templates
 *   - TemplateEditorModal    — inline visual editor inside EventDetail
 *
 * This file is preserved for reference / possible future reuse.
 * DO NOT add a <Route> for this page without reviewing whether its
 * API hooks (useTemplateHtml, useUpdateTemplateHtml, useForkTemplate)
 * still match the current backend.
 *
 * If this file is no longer needed, it can be safely deleted.
 *
 * Original docs:
 * ──────────────────────────────────────────────────────────────────────────────
 * HtmlTemplateEditor.jsx
 *
 * A drag-and-drop HTML certificate editor.
 *
 * Layout
 * ───────
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  Navbar                                                         │
 *  ├──────────┬──────────────────────────────────────┬──────────────┤
 *  │ Sidebar  │  A4 Canvas (drag elements freely)    │ Props Panel  │
 *  │          │                                       │              │
 *  └──────────┴──────────────────────────────────────┴──────────────┘
 */

import { useState, useRef, useCallback, useEffect, useMemo, useId } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import LoadingSpinner from '../components/LoadingSpinner'
import {
  useTemplate,
  useTemplateHtml,
  useUpdateTemplateHtml,
  useForkTemplate,
} from ./templatesApi

// ── A4 reference canvas dimensions (pixels at 300 DPI) ───────────────────────
const REF_W = 2480
const REF_H = 3508

// ── Unique ID counter ─────────────────────────────────────────────────────────
let _uid = 0
const uid = () => `el-${++_uid}`

// ── Element type defaults ─────────────────────────────────────────────────────
const ELEMENT_DEFAULTS = {
  static: {
    type: 'static',
    value: 'Static Text',
    x: 200, y: 300,
    width: 800, height: 120,
    font_size: 48, font_weight: 'normal',
    text_align: 'center', color: '#1B4D3E',
    slot_id: null, label: null,
  },
  dynamic: {
    type: 'dynamic',
    value: '[Participant Name]',
    label: 'participant_name',
    x: 200, y: 500,
    width: 1200, height: 140,
    font_size: 72, font_weight: 'bold',
    text_align: 'center', color: '#1B4D3E',
    slot_id: 'name_slot',
  },
  divider: {
    type: 'divider',
    value: '',
    x: 300, y: 700,
    width: 1880, height: 6,
    font_size: 0, font_weight: 'normal',
    text_align: 'left', color: '#C9A84C',
    slot_id: null, label: null,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// DraggableElement  — each element on the canvas
// ─────────────────────────────────────────────────────────────────────────────
function DraggableElement({ el, scale, isSelected, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: el.id })

  const style = {
    position: 'absolute',
    left: el.x * scale,
    top: el.y * scale,
    width: el.width * scale,
    height: el.height * scale,
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 100 : isSelected ? 10 : 1,
    cursor: 'grab',
    outline: isSelected
      ? '2px solid #3B82F6'
      : isDragging
        ? '2px dashed #60A5FA'
        : '1px dashed rgba(0,0,0,0.15)',
    outlineOffset: '2px',
    borderRadius: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: el.text_align === 'center'
      ? 'center'
      : el.text_align === 'right'
        ? 'flex-end'
        : 'flex-start',
    userSelect: 'none',
    background: isSelected ? 'rgba(59,130,246,0.04)' : 'transparent',
    transition: isDragging ? 'none' : 'outline 0.1s',
  }

  if (el.type === 'divider') {
    return (
      <div
        ref={setNodeRef}
        style={{ ...style, alignItems: 'center' }}
        onClick={(e) => { e.stopPropagation(); onSelect(el.id) }}
        {...listeners}
        {...attributes}
      >
        <div style={{
          width: '100%',
          height: Math.max(2, el.height * scale),
          background: el.color || '#C9A84C',
          opacity: 0.8,
        }} />
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { e.stopPropagation(); onSelect(el.id) }}
      {...listeners}
      {...attributes}
    >
      <span style={{
        fontSize: el.font_size * scale,
        fontWeight: el.font_weight,
        textAlign: el.text_align,
        color: el.color || '#1B4D3E',
        fontStyle: el.type === 'dynamic' ? 'italic' : 'normal',
        opacity: el.type === 'dynamic' ? 0.75 : 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        width: '100%',
        display: 'block',
      }}>
        {el.value || (el.type === 'dynamic' ? `[${el.label || 'field'}]` : '')}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// A4Canvas  — scaled-down cert preview with drop zone
// ─────────────────────────────────────────────────────────────────────────────
function A4Canvas({ elements, selectedId, onSelect, onDragEnd, canvasWidth }) {
  const scale = canvasWidth / REF_W
  const canvasHeight = REF_H * scale

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  )

  const [activeEl, setActiveEl] = useState(null)

  const handleDragStart = ({ active }) => {
    setActiveEl(elements.find(e => e.id === active.id) || null)
  }

  const handleDragEnd = (event) => {
    setActiveEl(null)
    const { active, delta } = event
    if (!active) return
    onDragEnd(active.id, delta.x / scale, delta.y / scale)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Canvas */}
      <div
        id="cert-canvas"
        style={{
          position: 'relative',
          width: canvasWidth,
          height: canvasHeight,
          background: '#FFFDF7',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
        onClick={() => onSelect(null)}
      >
        {/* ── Reference guides ─── */}
        {/* Outer border simulation */}
        <div style={{
          position: 'absolute',
          inset: 40 * scale,
          border: `${8 * scale}px solid #1B4D3E`,
          borderRadius: 12 * scale,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          inset: 65 * scale,
          border: `${2 * scale}px solid #C9A84C`,
          pointerEvents: 'none',
        }} />

        {/* Fixed-zone hints */}
        <ZoneHint label="LOGO" x={140} y={160} w={200} h={200} color="#3B82F6" scale={scale} />
        <ZoneHint label="SIGN" x={140} y={REF_H - 560} w={500} h={160} color="#F59E0B" scale={scale} />

        {/* Centre watermark */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{
            fontSize: 36 * scale, fontWeight: 800,
            color: 'rgba(0,0,0,0.04)', textTransform: 'uppercase',
            letterSpacing: 8 * scale, userSelect: 'none',
          }}>
            Certificate Preview
          </span>
        </div>

        {/* Draggable elements */}
        {elements.map(el => (
          <DraggableElement
            key={el.id}
            el={el}
            scale={scale}
            isSelected={el.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeEl ? (
          <div style={{
            background: 'rgba(59,130,246,0.1)',
            border: '2px dashed #3B82F6',
            borderRadius: 4,
            width: activeEl.width * scale,
            height: activeEl.height * scale,
            opacity: 0.8,
          }} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// Tiny helper for fixed-zone overlays
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
      <span style={{ fontSize: 9 * scale, color, fontWeight: 700, letterSpacing: 1.5 * scale }}>
        {label}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PropertiesPanel  — edits the currently selected element
// ─────────────────────────────────────────────────────────────────────────────
function PropertiesPanel({ el, onChange, onDelete, onDuplicate, totalCount }) {
  if (!el) {
    return (
      <aside style={{
        width: 260, flexShrink: 0,
        borderLeft: '1px solid #e5e7eb',
        background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>
          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2} style={{ margin: '0 auto 8px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.536-6.536a2 2 0 112.828 2.828L11.828 15.828A2 2 0 0111 16.4V18h1.6a2 2 0 001.414-.586l6.536-6.536" />
          </svg>
          <p style={{ fontSize: 12, margin: 0 }}>Click an element on the canvas to edit its properties</p>
        </div>
      </aside>
    )
  }

  const row = (label, children) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#6B7280', marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  )

  const numInput = (key, min, max, step = 1) => (
    <input
      type="number" min={min} max={max} step={step}
      value={el[key] ?? 0}
      onChange={e => onChange({ [key]: Number(e.target.value) })}
      style={{ width: '100%', padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }}
    />
  )

  const grid2 = (children) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {children}
    </div>
  )

  return (
    <aside style={{
      width: 260, flexShrink: 0,
      borderLeft: '1px solid #e5e7eb',
      background: '#fff',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', background: '#FAFAFA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1,
            padding: '2px 7px', borderRadius: 999,
            background: el.type === 'static' ? '#DBEAFE' : el.type === 'dynamic' ? '#D1FAE5' : '#F3F4F6',
            color: el.type === 'static' ? '#1D4ED8' : el.type === 'dynamic' ? '#065F46' : '#4B5563',
          }}>
            {el.type}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              title="Duplicate element"
              onClick={onDuplicate}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4, borderRadius: 4 }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              title="Delete element"
              onClick={onDelete}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 4, borderRadius: 4 }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable properties */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* Content */}
        {el.type !== 'divider' && row(
          el.type === 'dynamic' ? 'Field Label (slot key)' : 'Text Content',
          <>
            <input
              type="text"
              value={el.type === 'dynamic' ? (el.label || '') : (el.value || '')}
              onChange={e =>
                onChange(el.type === 'dynamic'
                  ? { label: e.target.value, value: `[${e.target.value}]` }
                  : { value: e.target.value }
                )
              }
              placeholder={el.type === 'dynamic' ? 'e.g. participant_name' : 'Enter text…'}
              style={{ width: '100%', padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12 }}
            />
            {el.type === 'dynamic' && (
              <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
                This becomes a Jinja2 <code style={{ background: '#f3f4f6', padding: '0 3px', borderRadius: 3 }}>{'{{ slot_values.get(...) }}'}</code> in the template.
              </p>
            )}
          </>
        )}

        {/* Position */}
        {row('Position (px on 2480×3508)', grid2([
          <div key="x">
            <label style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 2 }}>X</label>
            {numInput('x', 0, REF_W)}
          </div>,
          <div key="y">
            <label style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 2 }}>Y</label>
            {numInput('y', 0, REF_H)}
          </div>,
        ]))}

        {/* Size */}
        {row('Size (px)', grid2([
          <div key="w">
            <label style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 2 }}>Width</label>
            {numInput('width', 10, REF_W)}
          </div>,
          <div key="h">
            <label style={{ fontSize: 10, color: '#9CA3AF', display: 'block', marginBottom: 2 }}>Height</label>
            {numInput('height', 4, REF_H)}
          </div>,
        ]))}

        {/* Typography (not for dividers) */}
        {el.type !== 'divider' && (
          <>
            {row('Font Size (px)', numInput('font_size', 6, 300))}

            {row('Font Weight',
              <select
                value={el.font_weight || 'normal'}
                onChange={e => onChange({ font_weight: e.target.value })}
                style={{ width: '100%', padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12 }}
              >
                <option value="normal">Normal</option>
                <option value="semibold">Semibold</option>
                <option value="bold">Bold</option>
              </select>
            )}

            {row('Text Align',
              <div style={{ display: 'flex', gap: 4 }}>
                {['left', 'center', 'right'].map(a => (
                  <button
                    key={a}
                    onClick={() => onChange({ text_align: a })}
                    style={{
                      flex: 1, padding: '5px 0', fontSize: 11,
                      border: '1px solid',
                      borderColor: el.text_align === a ? '#3B82F6' : '#e5e7eb',
                      background: el.text_align === a ? '#EFF6FF' : '#fff',
                      color: el.text_align === a ? '#1D4ED8' : '#6B7280',
                      borderRadius: 6, cursor: 'pointer', textTransform: 'capitalize',
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Color */}
        {row('Color',
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={el.color || '#1B4D3E'}
              onChange={e => onChange({ color: e.target.value })}
              style={{ width: 32, height: 32, border: '1px solid #e5e7eb', borderRadius: 4, cursor: 'pointer', padding: 2 }}
            />
            <input
              type="text"
              value={el.color || '#1B4D3E'}
              onChange={e => onChange({ color: e.target.value })}
              maxLength={7}
              style={{ flex: 1, padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, fontFamily: 'monospace' }}
              placeholder="#1B4D3E"
            />
          </div>
        )}

        {/* Coordinates summary */}
        <div style={{
          marginTop: 16, padding: '8px 10px',
          background: '#F9FAFB', borderRadius: 8,
          border: '1px solid #F3F4F6',
        }}>
          <p style={{ fontSize: 10, color: '#9CA3AF', margin: 0, fontFamily: 'monospace' }}>
            ({Math.round(el.x)}, {Math.round(el.y)}) · {Math.round(el.width)} × {Math.round(el.height)}
          </p>
          <p style={{ fontSize: 10, color: '#9CA3AF', margin: '2px 0 0', fontFamily: 'monospace' }}>
            {el.font_size}px {el.font_weight}
          </p>
        </div>

      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AddElementToolbar  — the little "add element" strip
// ─────────────────────────────────────────────────────────────────────────────
function AddElementToolbar({ onAdd }) {
  const btnStyle = (color, bg) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 12px', borderRadius: 8,
    border: `1px solid ${color}30`,
    background: bg, color,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    transition: 'background 0.15s',
    whiteSpace: 'nowrap',
  })

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button id="add-static-text-btn" style={btnStyle('#1D4ED8', '#EFF6FF')} onClick={() => onAdd('static')}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
        </svg>
        + Static Text
      </button>
      <button id="add-dynamic-field-btn" style={btnStyle('#065F46', '#D1FAE5')} onClick={() => onAdd('dynamic')}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
        + Dynamic Field
      </button>
      <button id="add-divider-btn" style={btnStyle('#92400E', '#FEF3C7')} onClick={() => onAdd('divider')}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
        </svg>
        + Divider
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HtmlTemplateEditor  — main export
// ─────────────────────────────────────────────────────────────────────────────
export default function HtmlTemplateEditor() {
  const { club_id, template_id } = useParams()
  const navigate = useNavigate()

  // ── Data fetching ────────────────────────────────────────────────────────
  const { data: tplMeta, isLoading: metaLoading } = useTemplate(template_id)
  const { data: htmlData, isLoading: htmlLoading } = useTemplateHtml(template_id)
  const updateHtml = useUpdateTemplateHtml(template_id)
  const forkTemplate = useForkTemplate()

  // ── Local state ──────────────────────────────────────────────────────────
  const [elements, setElements] = useState([])  // { id, type, x, y, width, height, font_size, font_weight, text_align, color, value, label, slot_id }
  const [selectedId, setSelectedId] = useState(null)
  const [seeded, setSeeded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Canvas width tracking (dynamic)
  const canvasContainerRef = useRef(null)
  const [canvasWidth, setCanvasWidth] = useState(560)

  useEffect(() => {
    const el = canvasContainerRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setCanvasWidth(Math.max(300, w - 32))
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Seed elements from backend field_slots once loaded
  useEffect(() => {
    if (seeded || !htmlData?.field_slots) return
    const loaded = htmlData.field_slots.map((s, i) => ({
      id: uid(),
      type: s.slot_id ? 'dynamic' : 'static',
      slot_id: s.slot_id,
      label: s.label || s.slot_id,
      value: s.label ? `[${s.label}]` : 'Static Text',
      x: s.x ?? 200 + i * 20,
      y: s.y ?? 300 + i * 80,
      width: s.width ?? 800,
      height: s.height ?? 120,
      font_size: s.font_size ?? 48,
      font_weight: s.font_weight ?? 'normal',
      text_align: s.text_align ?? 'center',
      color: s.color ?? '#1B4D3E',
    }))
    setElements(loaded)
    setSeeded(true)
  }, [htmlData, seeded])

  // ── Element operations ────────────────────────────────────────────────────
  const addElement = useCallback((type) => {
    const newEl = { id: uid(), ...ELEMENT_DEFAULTS[type] }
    // Offset slightly so multiple adds don't stack exactly
    newEl.x += elements.length * 30
    newEl.y += elements.length * 30
    setElements(prev => [...prev, newEl])
    setSelectedId(newEl.id)
  }, [elements.length])

  const updateElement = useCallback((patch) => {
    setElements(prev =>
      prev.map(e => e.id === selectedId ? { ...e, ...patch } : e)
    )
  }, [selectedId])

  const deleteElement = useCallback(() => {
    setElements(prev => prev.filter(e => e.id !== selectedId))
    setSelectedId(null)
  }, [selectedId])

  const duplicateElement = useCallback(() => {
    const src = elements.find(e => e.id === selectedId)
    if (!src) return
    const copy = { ...src, id: uid(), x: src.x + 60, y: src.y + 60 }
    setElements(prev => [...prev, copy])
    setSelectedId(copy.id)
  }, [elements, selectedId])

  const handleDragEnd = useCallback((id, dx, dy) => {
    setElements(prev =>
      prev.map(e => e.id === id
        ? {
          ...e,
          x: Math.max(0, Math.min(REF_W - e.width, e.x + dx)),
          y: Math.max(0, Math.min(REF_H - e.height, e.y + dy)),
        }
        : e
      )
    )
  }, [])

  // ── Derived: selected element ─────────────────────────────────────────────
  const selectedEl = useMemo(() => elements.find(e => e.id === selectedId) || null, [elements, selectedId])

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!tplMeta) return

    // If this is a preset, fork it first
    if (tplMeta.is_preset) {
      try {
        setIsSaving(true)
        const res = await forkTemplate.mutateAsync(template_id)
        const forkedId = res?.data?.id
        if (forkedId) {
          navigate(`/club/${club_id}/templates/${forkedId}/edit`, { replace: true })
        }
      } catch {
        setIsSaving(false)
      }
      return
    }

    // Build field_slots from elements
    const field_slots = elements
      .filter(e => e.type === 'dynamic')
      .map(e => ({
        slot_id: e.slot_id || e.label || e.id,
        label: e.label || e.slot_id || 'field',
        x: Math.round(e.x),
        y: Math.round(e.y),
        width: Math.round(e.width),
        height: Math.round(e.height),
        font_size: e.font_size,
        font_weight: e.font_weight,
        text_align: e.text_align,
        color: e.color,
      }))

    // Use the existing html_content (we only manage slot positions, not raw HTML here)
    const html_content = htmlData?.html_content || ''

    setIsSaving(true)
    try {
      await updateHtml.mutateAsync({ html_content, field_slots })
    } finally {
      setIsSaving(false)
    }
  }

  // ── Loading states ────────────────────────────────────────────────────────
  const isLoading = metaLoading || htmlLoading
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
        <Navbar />
        <div style={{ display: 'flex', flex: 1 }}>
          <Sidebar />
          <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LoadingSpinner fullPage label="Loading template editor…" />
          </main>
        </div>
      </div>
    )
  }

  const isEditable = tplMeta?.is_editable || false
  const isPreset = tplMeta?.is_preset || false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      <Navbar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />

        {/* ── Main editor layout ───────────────────────────────────────── */}
        <main style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: '#F9FAFB' }}>

          {/* Top toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 20px',
            background: '#fff', borderBottom: '1px solid #e5e7eb',
            flexShrink: 0, gap: 16, flexWrap: 'wrap',
          }}>
            {/* Left: back + title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => navigate(-1)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#6B7280', fontSize: 13,
                }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  {tplMeta?.name || 'Template Editor'}
                </p>
                <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF' }}>
                  {isPreset ? '⚠ Read-only preset — save to fork & edit' : 'Drag elements to reposition · Click to edit properties'}
                </p>
              </div>
            </div>

            {/* Centre: add element toolbar */}
            <AddElementToolbar onAdd={addElement} />

            {/* Right: element count + save */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                {elements.length} element{elements.length !== 1 ? 's' : ''}
              </span>
              <button
                id="save-template-html-btn"
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 16px', borderRadius: 8,
                  background: isPreset ? '#F59E0B' : '#1E3A5F',
                  color: '#fff', border: 'none', fontSize: 13, fontWeight: 600,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  opacity: isSaving ? 0.7 : 1,
                }}
              >
                {isSaving ? (
                  <>Saving…</>
                ) : isPreset ? (
                  <>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Fork & Edit
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── Content area: canvas + properties ────────────────────── */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* Canvas scroll area */}
            <div
              ref={canvasContainerRef}
              style={{
                flex: 1, overflow: 'auto',
                padding: 20, background: '#F3F4F6',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 12,
              }}
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
                  Reference: 2480 × 3508 px (300 DPI)
                </span>
              </div>

              {/* The canvas */}
              <A4Canvas
                elements={elements}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDragEnd={handleDragEnd}
                canvasWidth={canvasWidth}
              />

              {/* Element list below canvas */}
              {elements.length > 0 && (
                <div style={{
                  width: canvasWidth, flexShrink: 0,
                  background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb',
                  overflow: 'hidden', marginTop: 8,
                }}>
                  <div style={{ padding: '8px 14px', borderBottom: '1px solid #f3f4f6', background: '#FAFAFA' }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#6B7280' }}>
                      Elements ({elements.length})
                    </p>
                  </div>
                  {elements.map((el, i) => (
                    <div
                      key={el.id}
                      onClick={() => setSelectedId(el.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 14px',
                        borderBottom: i < elements.length - 1 ? '1px solid #f9fafb' : 'none',
                        background: el.id === selectedId ? '#EFF6FF' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                    >
                      <span style={{ fontSize: 11, color: '#9CA3AF', width: 18, textAlign: 'center' }}>{i + 1}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5,
                        padding: '1px 6px', borderRadius: 999,
                        background: el.type === 'static' ? '#DBEAFE' : el.type === 'dynamic' ? '#D1FAE5' : '#F3F4F6',
                        color: el.type === 'static' ? '#1D4ED8' : el.type === 'dynamic' ? '#065F46' : '#4B5563',
                        flexShrink: 0,
                      }}>
                        {el.type}
                      </span>
                      <span style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {el.type === 'dynamic'
                          ? `[${el.label || el.slot_id || 'field'}]`
                          : el.type === 'divider'
                            ? '— Divider —'
                            : (el.value || '—')}
                      </span>
                      <span style={{ fontSize: 10, color: '#9CA3AF', flexShrink: 0, fontFamily: 'monospace' }}>
                        ({Math.round(el.x)}, {Math.round(el.y)})
                      </span>
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* Properties panel */}
            <PropertiesPanel
              el={selectedEl}
              onChange={updateElement}
              onDelete={deleteElement}
              onDuplicate={duplicateElement}
              totalCount={elements.length}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
