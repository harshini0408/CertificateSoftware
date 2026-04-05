import { useState, useEffect, useRef, useCallback } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDraggable,
  closestCenter,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import LoadingSpinner from '../components/LoadingSpinner'
import { useDeptAssetStatus, useConfigureFieldPositions, useGetFieldPositions } from '../api/dept'
import { useToastStore } from '../store/uiStore'

// ── Constants ────────────────────────────────────────────────────────────────
const CANVAS_W = 2480 // Standard A4 at 300dpi (approximately, for scaling)
const CANVAS_H = 3508

const DEFAULT_SLOTS = [
  { id: 'name', label: 'Student Name', type: 'text', defaultX: 50, defaultY: 46, fontSize: 56 },
  { id: 'class_name', label: 'Class / Department', type: 'text', defaultX: 50, defaultY: 56, fontSize: 44 },
  { id: 'contribution', label: 'Contribution', type: 'text', defaultX: 50, defaultY: 64, fontSize: 44 },
  { id: 'logo', label: 'College Logo', type: 'asset', defaultX: 12, defaultY: 12, width: 16, height: 16 },
  { id: 'signature_primary', label: 'Primary Signature', type: 'asset', defaultX: 18, defaultY: 84, width: 20, height: 10 },
  { id: 'signature_secondary', label: 'Secondary Signature', type: 'asset', defaultX: 78, defaultY: 84, width: 20, height: 10 },
]

// ── Components ───────────────────────────────────────────────────────────────

function DraggableSlot({ id, label, x, y, type, scale, isActive, fontSize }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    position: 'absolute',
    left: `${x}%`,
    top: `${y}%`,
    transformOrigin: 'top left',
    zIndex: isActive ? 50 : 10,
    cursor: 'grab',
  }

  // Visual centering
  const translateStyle = {
    transform: 'translate(-50%, -50%)',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="group"
    >
      <div 
        style={translateStyle}
        className={`
          flex flex-col items-center justify-center rounded border-2 p-2 
          transition-all duration-150 backdrop-blur-[1px]
          ${isActive 
            ? 'border-navy bg-navy/20 scale-105 shadow-lg' 
            : 'border-navy/40 bg-white/60 hover:border-navy hover:bg-white/80 shadow-sm'
          }
        `}
      >
        <span className="text-[10px] font-bold uppercase tracking-tighter text-navy mb-1 select-none">
          {label}
        </span>
        {type === 'text' ? (
          <div 
            className="bg-gray-100/50 px-3 py-1 rounded text-center whitespace-nowrap overflow-hidden border border-gray-200"
            style={{ 
               minWidth: '120px',
               fontSize: `${(fontSize || 24) * scale * 0.5}px` // scaled preview
            }}
          >
            {label} Text
          </div>
        ) : (
          <div 
            className="flex items-center justify-center bg-gray-200/50 rounded border border-dashed border-gray-400"
            style={{ width: '80px', height: '40px' }}
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}

function DropZone({ slots, onMove, containerRef, canvasScale }) {
  const handleDragEnd = (event) => {
    const { active, delta } = event
    if (!containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    
    // Calculate percentage change
    const deltaXPercent = (delta.x / rect.width) * 100
    const deltaYPercent = (delta.y / rect.height) * 100

    onMove(active.id, deltaXPercent, deltaYPercent)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter} 
      onDragEnd={handleDragEnd}
    >
      <div 
        ref={containerRef}
        className="relative bg-white shadow-2xl mx-auto overflow-hidden border border-gray-200"
        style={{
          width: '100%',
          aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
          maxWidth: '600px',
        }}
      >
        {/* Grid Background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
        />

        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-navy/5 pointer-events-none" />
        
        {/* Slots */}
        {slots.map((slot) => (
          <DraggableSlot
            key={slot.id}
            id={slot.id}
            label={slot.label}
            x={slot.x}
            y={slot.y}
            type={slot.type}
            scale={canvasScale}
            fontSize={slot.fontSize}
          />
        ))}

        {/* Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05]">
          <span className="text-6xl font-black rotate-45 select-none text-navy">PREVIEW</span>
        </div>
      </div>
    </DndContext>
  )
}

// ── Main Page Component ──────────────────────────────────────────────────────

export default function DeptFieldConfigurator({ onComplete }) {
  const addToast = useToastStore((s) => s.addToast)
  const containerRef = useRef(null)
  
  const { data: assetStatus, isLoading: statusLoading } = useDeptAssetStatus()
  const { data: savedPositions, isLoading: posLoading } = useGetFieldPositions()
  const configMutation = useConfigureFieldPositions()

  const [slots, setSlots] = useState([])
  const [canvasScale, setCanvasScale] = useState(1)

  // Initialize slots
  useEffect(() => {
    if (!posLoading && savedPositions) {
      const merged = DEFAULT_SLOTS.map(def => {
        const saved = savedPositions.field_positions?.[def.id]
        return {
          ...def,
          x: saved ? saved.x_percent : def.defaultX,
          y: saved ? saved.y_percent : def.defaultY,
          fontSize: saved ? saved.font_size : (def.fontSize || 24)
        }
      })
      setSlots(merged)
    }
  }, [savedPositions, posLoading])

  // Recalculate scale for font previews
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        setCanvasScale(containerRef.current.offsetWidth / CANVAS_W)
      }
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  const handleMove = (id, dx, dy) => {
    setSlots(prev => prev.map(s => {
      if (s.id === id) {
        return {
          ...s,
          x: Math.min(100, Math.max(0, s.x + dx)),
          y: Math.min(100, Math.max(0, s.y + dy))
        }
      }
      return s
    }))
  }

  const handleFontSizeChange = (id, newSize) => {
    setSlots(prev => prev.map(s => s.id === id ? { ...s, fontSize: parseInt(newSize) || 12 } : s))
  }

  const handleSave = async () => {
    const payload = {}
    slots.forEach(s => {
      payload[s.id] = {
        x_percent: s.x,
        y_percent: s.y,
        font_size: s.fontSize || 24
      }
    })

    try {
      await configMutation.mutateAsync(payload)
      onComplete?.()
    } catch (err) {
      // Toast handled by mutation
    }
  }

  if (statusLoading || posLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <LoadingSpinner label="Loading configuration…" />
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[600px]">
      {/* Sidebar Controls */}
      <div className="w-full lg:w-80 shrink-0 space-y-6">
        <div className="card p-5">
          <h2 className="text-lg font-bold text-navy">Position Editor</h2>
          <p className="text-xs text-gray-500 mt-1">
            Drag the boxes on the preview to position them on your department certificate.
          </p>
        </div>

        <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2 scrollbar-hide">
          {slots.map(slot => (
            <div key={slot.id} className="card p-3 text-xs bg-white/50 hover:bg-white transition-colors">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-navy uppercase tracking-wider">{slot.label}</span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {Math.round(slot.x)}%, {Math.round(slot.y)}%
                </span>
              </div>
              {slot.type === 'text' && (
                <div className="flex items-center gap-2 mt-2">
                  <label className="text-[10px] text-gray-400 uppercase font-bold">Font Size</label>
                  <input 
                    type="range" 
                    min="12" 
                    max="120" 
                    value={slot.fontSize} 
                    onChange={(e) => handleFontSizeChange(slot.id, e.target.value)}
                    className="flex-1 accent-navy h-1 appearance-none bg-gray-200 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono w-6 text-right">{slot.fontSize}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-4">
          <button 
            className="btn-primary flex-1"
            onClick={handleSave}
            disabled={configMutation.isPending}
          >
            {configMutation.isPending ? 'Saving...' : 'Save Configuration'}
          </button>
          <button 
            className="btn-secondary"
            onClick={() => onComplete?.()}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 p-8 flex items-center justify-center overflow-hidden">
        <DropZone 
          slots={slots} 
          onMove={handleMove} 
          containerRef={containerRef} 
          canvasScale={canvasScale} 
        />
      </div>
    </div>
  )
}
