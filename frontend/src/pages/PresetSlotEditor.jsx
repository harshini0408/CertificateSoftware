import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { templateApi } from '../api/templates'
import { useToastStore } from '../store/uiStore'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import LoadingSpinner from '../components/LoadingSpinner'

export default function PresetSlotEditor() {
  const { clubId, eventId, templateId } = useParams()
  const [searchParams] = useSearchParams()
  const certType = searchParams.get('certType') || 'participant'
  const navigate = useNavigate()
  const addToast = useToastStore((s) => s.addToast)

  const [editedSlots, setEditedSlots] = useState(null)
  
  // Right panel scale state
  const rightPanelRef = useRef(null)
  const [scaleFactor, setScaleFactor] = useState(1)

  // Fetch preset template specifically matching ID
  const { data: templates, isLoading } = useQuery({
    queryKey: ['templates', clubId],
    queryFn: () => templateApi.getPresets(clubId)
  })

  const template = templates?.find((t) => (t._id || t.id) === templateId)
  
  // Save mutation
  const patchMutation = useMutation({
    mutationFn: (slots) => templateApi.patchSlots(clubId, templateId, slots),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Slot sizes saved' })
      navigate(`/club/${clubId}/events/${eventId}?tab=overview`)
    },
    onError: () => {
      addToast({ type: 'error', message: 'Failed to save slot settings.' })
    }
  })

  // Initialize slots
  useEffect(() => {
    if (template && !editedSlots) {
      setEditedSlots(JSON.parse(JSON.stringify(template.field_slots || [])))
    }
  }, [template, editedSlots])

  // Resize canvas scale
  useEffect(() => {
    const calcScale = () => {
      if (rightPanelRef.current) {
        // Find maximum allowable pixel width from the flex container minus padding
        const panelWidth = rightPanelRef.current.clientWidth - 48
        // Aspect ratio is 210/297. Max scale relative to 2480 width.
        const scale = panelWidth / 2480
        setScaleFactor(scale)
      }
    }
    calcScale()
    window.addEventListener('resize', calcScale)
    return () => window.removeEventListener('resize', calcScale)
  }, [])

  const handleUpdate = (idx, field, value) => {
    const val = Number(value)
    if (isNaN(val)) return
    
    setEditedSlots((prev) => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: val }
      return copy
    })
  }

  const handleReset = () => {
    if (template) setEditedSlots(JSON.parse(JSON.stringify(template.field_slots || [])))
  }

  const handleSave = () => {
    if (editedSlots) {
      patchMutation.mutate(editedSlots)
    }
  }

  // Check if anything actually changed
  const hasChanges = () => {
    if (!template || !editedSlots) return false
    return JSON.stringify(template.field_slots) !== JSON.stringify(editedSlots)
  }

  if (isLoading) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex flex-1 items-center justify-center">
            <LoadingSpinner label="Loading template..." />
          </main>
        </div>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 p-8 text-center text-red-600">
            Template not found!
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <main className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          
          {/* ── Left Panel (Controls) ── */}
          <div className="flex w-full flex-col border-r border-gray-200 bg-white lg:w-2/5 overflow-hidden">
            {/* Header */}
            <div className="border-b border-gray-100 px-6 py-4">
              <button
                onClick={() => navigate(-1)}
                className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-navy transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h1 className="text-xl font-bold text-navy">Adjust Field Slots</h1>
              <p className="mt-1 text-sm text-gray-500">
                {template.name} ({certType.replace(/_/g, ' ')})
              </p>
            </div>

            {/* Banner */}
            <div className="bg-blue-50 px-6 py-3">
              <p className="text-sm font-semibold text-blue-800">
                This template has {editedSlots?.length || 0} dynamic field slots.
              </p>
              <p className="mt-1 text-xs text-blue-700">
                Your Excel file must have exactly {editedSlots?.length || 0} columns.
              </p>
            </div>

            {/* Controls List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {!editedSlots || editedSlots.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No dynamic slots on this template.</p>
              ) : (
                <div className="space-y-4">
                  {editedSlots.map((slot, idx) => (
                    <div key={idx} className="rounded-xl border border-gray-100 bg-gray-50 p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between border-b border-dashed border-gray-200 pb-2">
                        <span className="text-sm font-bold text-navy">{slot.label}</span>
                        <span className="text-xs text-gray-400">Locked Pos: ({slot.x}%, {slot.y}%)</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-gray-600">Width (%)</label>
                          <input 
                            type="number"
                            min={1} max={100}
                            className="form-input text-sm py-1.5 px-2"
                            value={slot.width}
                            onChange={(e) => handleUpdate(idx, 'width', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-gray-600">Height (%)</label>
                          <input 
                            type="number"
                            min={1} max={50}
                            className="form-input text-sm py-1.5 px-2"
                            value={slot.height}
                            onChange={(e) => handleUpdate(idx, 'height', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-gray-600">Font (px)</label>
                          <input 
                            type="number"
                            min={12} max={250}
                            className="form-input text-sm py-1.5 px-2"
                            value={slot.font_size}
                            onChange={(e) => handleUpdate(idx, 'font_size', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <p className="text-center text-xs italic text-gray-400 mt-2">
                    * Position is set during the field mapping step
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <button 
                className="btn-secondary flex-1"
                onClick={handleReset}
                disabled={!hasChanges() || patchMutation.isPending}
              >
                Reset to Default
              </button>
              <button 
                className="btn-primary flex-1"
                onClick={handleSave}
                disabled={!hasChanges() || patchMutation.isPending}
              >
                {patchMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* ── Right Panel (Preview) ── */}
          <div ref={rightPanelRef} className="flex flex-1 flex-col items-center justify-start bg-gray-100 p-6 overflow-hidden">
            <div className="flex h-full w-full max-h-[calc(100vh-8rem)] items-center justify-center">
              
              {/* Scaled Preview Area */}
              <div 
                className="relative bg-white shadow-card border border-gray-200"
                style={{ 
                  aspectRatio: '210/297',
                  width: `${2480 * scaleFactor}px`,
                }}
              >
                {editedSlots && editedSlots.map((slot, i) => (
                  <div
                    key={i}
                    className="absolute flex items-center justify-center overflow-hidden border-[2px] border-dashed border-indigo-500 bg-indigo-500/5 transition-all duration-75"
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      width: `${slot.width}%`,
                      height: `${slot.height}%`
                    }}
                  >
                    <span 
                      className="px-2 text-center font-bold text-indigo-700 tracking-wide select-none"
                      style={{ fontSize: `${slot.font_size * scaleFactor}px` }}
                    >
                      {slot.label}
                    </span>
                  </div>
                ))}
              </div>

            </div>
            <p className="mt-4 text-sm tracking-wide text-gray-500 font-medium">
              <span className="mr-2 inline-block h-3 w-3 rounded-full bg-indigo-400"></span>
              Dashed boxes = dynamic fields. Position is locked on presets.
            </p>
          </div>

        </main>
      </div>
    </div>
  )
}
