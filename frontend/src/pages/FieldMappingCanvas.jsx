import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  useDraggable,
  closestCenter,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import LoadingSpinner from '../components/LoadingSpinner'
import { useExcelColumns, useFieldMapping, useConfirmMapping } from '../api/participants'
import { useEvent } from '../api/events'
import { useToastStore } from '../store/uiStore'

// ─────────────────────────────────────────────────────────────────────────────
// Draggable column chip
// ─────────────────────────────────────────────────────────────────────────────
function ColumnChip({ id, label, isMapped }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id, data: { label } })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        flex items-center gap-2 rounded-lg border px-3 py-2
        text-sm font-medium cursor-grab active:cursor-grabbing
        select-none transition-colors duration-100
        ${isMapped
          ? 'border-green-300 bg-green-50 text-green-700 opacity-60'
          : 'border-navy/20 bg-white text-navy shadow-sm hover:border-navy/50 hover:bg-navy/5'
        }
      `}
    >
      {/* Drag handle dots */}
      <svg className="h-3.5 w-3.5 shrink-0 text-gray-300" viewBox="0 0 12 20" fill="currentColor">
        <circle cx="4" cy="4"  r="1.5" />
        <circle cx="4" cy="10" r="1.5" />
        <circle cx="4" cy="16" r="1.5" />
        <circle cx="9" cy="4"  r="1.5" />
        <circle cx="9" cy="10" r="1.5" />
        <circle cx="9" cy="16" r="1.5" />
      </svg>
      <span className="truncate max-w-[150px]">{label}</span>
      {isMapped && (
        <svg className="h-3.5 w-3.5 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Draggable overlay (shown while dragging)
// ─────────────────────────────────────────────────────────────────────────────
function DragChip({ label }) {
  return (
    <div className="
      flex items-center gap-2 rounded-lg border border-navy bg-navy px-3 py-2
      text-sm font-medium text-white shadow-lg cursor-grabbing select-none
      rotate-2
    ">
      <svg className="h-3.5 w-3.5 shrink-0 text-white/60" viewBox="0 0 12 20" fill="currentColor">
        <circle cx="4" cy="4"  r="1.5" />
        <circle cx="4" cy="10" r="1.5" />
        <circle cx="4" cy="16" r="1.5" />
        <circle cx="9" cy="4"  r="1.5" />
        <circle cx="9" cy="10" r="1.5" />
        <circle cx="9" cy="16" r="1.5" />
      </svg>
      {label}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Droppable field slot on the A4 canvas
// ─────────────────────────────────────────────────────────────────────────────
function FieldSlot({ slotId, label, mappedColumn, sampleText, position, canvasScale }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId })

  const isFilled = !!mappedColumn

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        left:   `${position.x * canvasScale}px`,
        top:    `${position.y * canvasScale}px`,
        width:  `${(position.width  ?? 200) * canvasScale}px`,
        minHeight: `${(position.height ?? 32) * canvasScale}px`,
      }}
      className={`
        flex flex-col items-start justify-center rounded
        border-2 border-dashed px-2 py-1
        transition-all duration-150
        ${isOver
          ? 'border-navy bg-navy/10 scale-105'
          : isFilled
          ? 'border-green-400 bg-green-50/80'
          : 'border-gray-300 bg-white/60'
        }
      `}
    >
      {/* Slot label */}
      <span
        className={`text-[10px] font-semibold uppercase tracking-wide leading-tight
          ${isFilled ? 'text-green-600' : 'text-gray-400'}`}
        style={{ fontSize: `${10 * canvasScale}px` }}
      >
        {label}
      </span>

      {/* Mapped column / sample text */}
      {isFilled ? (
        <span
          className="text-gray-700 font-medium mt-0.5 truncate w-full"
          style={{ fontSize: `${11 * canvasScale}px` }}
        >
          {mappedColumn}
          {sampleText && (
            <span className="text-gray-400 font-normal"> — {sampleText}</span>
          )}
        </span>
      ) : (
        <span
          className="text-gray-300 italic mt-0.5"
          style={{ fontSize: `${10 * canvasScale}px` }}
        >
          Drop a column here
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// A4 certificate canvas preview
// ─────────────────────────────────────────────────────────────────────────────
// A4 at 96 dpi = 794 × 1123 px (portrait).
// We scale it down to fit the panel.
const A4_W = 794
const A4_H = 1123

function CertificateCanvas({ slots, mapping, sampleRow,canvasWidth }) {
  const scale = canvasWidth / A4_W

  return (
    <div
      className="relative bg-white border border-gray-200 shadow-md overflow-hidden"
      style={{ width: canvasWidth, height: A4_H * scale }}
    >
      {/* Background watermark text */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        aria-hidden="true"
      >
        <span
          className="text-gray-100 font-bold uppercase tracking-widest select-none"
          style={{ fontSize: 48 * scale }}
        >
          Certificate Preview
        </span>
      </div>

      {/* Fixed zones */}
      {/* Logo zone */}
      <div
        className="absolute border border-dashed border-blue-200 rounded bg-blue-50/40
                   flex items-center justify-center"
        style={{
          left: 40 * scale, top: 40 * scale,
          width: 100 * scale, height: 100 * scale,
        }}
      >
        <span className="text-blue-300 text-center leading-tight select-none"
              style={{ fontSize: 9 * scale }}>
          LOGO
        </span>
      </div>

      {/* Signature zone */}
      <div
        className="absolute border border-dashed border-orange-200 rounded bg-orange-50/40
                   flex items-center justify-center"
        style={{
          left: 40 * scale, bottom: 40 * scale,
          width: 160 * scale, height: 60 * scale,
        }}
      >
        <span className="text-orange-300 text-center leading-tight select-none"
              style={{ fontSize: 9 * scale }}>
          SIGNATURE
        </span>
      </div>

      {/* Dynamic field slots */}
      {slots.map((slot) => (
        <FieldSlot
          key={slot.name}
          slotId={slot.name}
          label={slot.label ?? slot.name}
          mappedColumn={mapping[slot.name] ?? null}
          sampleText={
            sampleRow && mapping[slot.name]
              ? sampleRow[mapping[slot.name]]
              : null
          }
          position={slot.position ?? { x: 200, y: 300 + slots.indexOf(slot) * 60, width: 300, height: 36 }}
          canvasScale={scale}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FieldMappingCanvas (main export)
// ─────────────────────────────────────────────────────────────────────────────
export default function FieldMappingCanvas({ embedded = false }) {
  const { club_id, event_id } = useParams()
  const navigate = useNavigate()
  const addToast = useToastStore((s) => s.addToast)

  // ── Data fetching ────────────────────────────────────────────────────────
  const { data: event,    isLoading: eventLoading   } = useEvent(club_id, event_id)
  const { data: colData,  isLoading: colsLoading    } = useExcelColumns(club_id, event_id)
  const { data: mapData,  isLoading: mapLoading     } = useFieldMapping(club_id, event_id)
  const confirmMutation = useConfirmMapping(club_id, event_id)

  // ── Local mapping state ──────────────────────────────────────────────────
  // mapping: { [slotName]: columnHeader }
  const [mapping, setMapping] = useState({})
  const [activeId, setActiveId] = useState(null)
  const [isConfirmed, setIsConfirmed] = useState(false)

  // Seed from saved mapping once loaded
  const [seeded, setSeeded] = useState(false)
  if (mapData?.mapping && !seeded) {
    setMapping(mapData.mapping)
    setSeeded(true)
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const columns    = colData?.columns ?? []
  const sampleRow  = colData?.sample  ?? {}

  // Slots come from the event's template field definitions
  const slots = event?.template_slots ?? []

  // Which columns are already mapped
  const mappedColumns = new Set(Object.values(mapping))

  // All slots filled?
  const allFilled = slots.length > 0 && slots.every((s) => mapping[s.name])

  // ── DnD sensors ─────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  const handleDragStart = useCallback(({ active }) => {
    setActiveId(active.id)
  }, [])

  const handleDragEnd = useCallback(
    ({ active, over }) => {
      setActiveId(null)
      if (!over) return

      const columnLabel = active.data.current?.label ?? active.id
      const slotName    = over.id

      setMapping((prev) => ({ ...prev, [slotName]: columnLabel }))
    },
    [],
  )

  const clearSlot = (slotName) => {
    setMapping((prev) => {
      const next = { ...prev }
      delete next[slotName]
      return next
    })
  }

  const handleConfirm = async () => {
    if (!allFilled) {
      addToast({ type: 'warning', message: 'All field slots must be mapped before confirming.' })
      return
    }
    await confirmMutation.mutateAsync(mapping)
    setIsConfirmed(true)
  }

  const isLoading = eventLoading || colsLoading || mapLoading

  // ── Empty states ─────────────────────────────────────────────────────────
  if (isLoading) {
    const spinner = <LoadingSpinner fullPage label="Loading field mapping…" />
    if (embedded) return spinner
    return (
      <div className="flex h-dvh flex-col">
        <Navbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 bg-background">{spinner}</main>
        </div>
      </div>
    )
  }

  if (columns.length === 0) {
    const empty = (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-3">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18" />
          </svg>
          <p className="text-lg font-semibold text-gray-600">No columns detected</p>
          <p className="text-sm text-gray-400">Upload an Excel file in the Participants tab first.</p>
          {!embedded && (
            <button className="btn-secondary" onClick={() => navigate(-1)}>
              ← Back to Event
            </button>
          )}
        </div>
      </div>
    )
    if (embedded) return empty
    return (
      <div className="flex h-dvh flex-col">
        <Navbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 bg-background flex items-center justify-center">{empty}</main>
        </div>
      </div>
    )
  }

  // ── Main canvas pane (shared) ─────────────────────────────────────────────
  const canvasPane = (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full overflow-hidden">

        {/* ── Left panel — column chips ─────────────────────────── */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-gray-200 bg-white overflow-hidden">
          {/* Header */}
          <div className="border-b border-gray-100 px-4 py-4">
            {!embedded && (
              <button
                className="mb-3 flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy transition-colors"
                onClick={() => navigate(-1)}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back to Event
              </button>
            )}
            <h1 className="text-base font-bold text-foreground">Field Mapping</h1>
            <p className="mt-0.5 text-xs text-gray-500 leading-snug">
              Drag a column chip onto a slot in the certificate preview.
            </p>
          </div>

          {/* Progress */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-500 font-medium">
                {Object.keys(mapping).length} / {slots.length} slots mapped
              </span>
              {allFilled && (
                <span className="text-green-600 font-semibold">Ready ✓</span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full bg-navy rounded-full transition-all duration-300"
                style={{
                  width: slots.length > 0
                    ? `${(Object.keys(mapping).length / slots.length) * 100}%`
                    : '0%',
                }}
              />
            </div>
          </div>

          {/* Column chips */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scrollbar-hide">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              Excel Columns ({columns.length})
            </p>
            {columns.map((col) => (
              <ColumnChip
                key={col}
                id={col}
                label={col}
                isMapped={mappedColumns.has(col)}
              />
            ))}
          </div>

          {/* Confirm button */}
          <div className="border-t border-gray-100 p-4">
            {isConfirmed ? (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
                <svg className="h-5 w-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-green-700">Mapping Confirmed</p>
                  <p className="text-xs text-green-600">Certificates can now be generated.</p>
                </div>
              </div>
            ) : (
              <button
                id="confirm-mapping-btn"
                className="btn-primary w-full"
                disabled={!allFilled || confirmMutation.isPending}
                onClick={handleConfirm}
                title={!allFilled ? 'All slots must be mapped first' : ''}
              >
                {confirmMutation.isPending ? (
                  <><LoadingSpinner size="sm" label="" /> Confirming…</>
                ) : (
                  'Confirm Mapping'
                )}
              </button>
            )}
            {!allFilled && !isConfirmed && (
              <p className="mt-2 text-center text-xs text-amber-600">
                {slots.length - Object.keys(mapping).length} slot(s) still need mapping
              </p>
            )}
          </div>
        </aside>

        {/* ── Right panel — A4 canvas ───────────────────────────── */}
        <div className="flex-1 overflow-auto bg-gray-100 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {event?.name ?? 'Certificate Preview'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Drop column chips onto the dashed zones below
              </p>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded border-2 border-dashed border-gray-300" />
                Empty slot
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded border-2 border-dashed border-green-400 bg-green-50" />
                Mapped
              </span>
            </div>
          </div>

          {/* A4 preview */}
          <div className="flex justify-center">
            <div style={{ width: 'min(560px, 100%)' }}>
              <CertificateCanvas
                slots={slots}
                mapping={mapping}
                sampleRow={sampleRow}
                canvasWidth={Math.min(560, window.innerWidth - 340)}
              />
            </div>
          </div>

          {/* Mapping summary */}
          {Object.keys(mapping).length > 0 && (
            <div className="mt-6 max-w-[560px] mx-auto">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Current Mapping
              </p>
              <div className="card divide-y divide-gray-50 overflow-hidden">
                {slots.map((slot) => (
                  <div key={slot.name} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500 w-32 truncate">
                        {slot.label ?? slot.name}
                      </span>
                      <span className="text-gray-300">→</span>
                      <span className={`text-xs font-semibold ${mapping[slot.name] ? 'text-navy' : 'text-gray-300 italic'}`}>
                        {mapping[slot.name] ?? 'not mapped'}
                      </span>
                    </div>
                    {mapping[slot.name] && (
                      <button
                        onClick={() => clearSlot(slot.name)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        title="Clear this mapping"
                      >
                        ✕ Clear
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DragOverlay */}
      <DragOverlay dropAnimation={null}>
        {activeId ? <DragChip label={activeId} /> : null}
      </DragOverlay>
    </DndContext>
  )

  if (embedded) {
    return (
      <div className="flex h-[600px] overflow-hidden bg-background border-t border-gray-200">
        {canvasPane}
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden bg-background">
          {canvasPane}
        </main>
      </div>
    </div>
  )
}

