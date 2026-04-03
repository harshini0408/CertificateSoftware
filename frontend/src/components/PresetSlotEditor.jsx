import { useState, useEffect } from 'react'
import { useUpdatePresetSlots } from '../api/templates'
import LoadingSpinner from './LoadingSpinner'

export default function PresetSlotEditor({ isOpen, onClose, clubId, eventId, certType, template }) {
  const updateSlots = useUpdatePresetSlots(clubId, eventId)
  const [slots, setSlots] = useState([])

  useEffect(() => {
    if (template?.field_slots) {
      setSlots(template.field_slots.map(s => ({
        slot_id: s.name,
        width: s.width || 200,
        height: s.height || 50,
        font_size: s.font_size || 24,
      })))
    }
  }, [template])

  const handleChange = (index, field, value) => {
    const updated = [...slots]
    updated[index][field] = Number(value) || 0
    setSlots(updated)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    updateSlots.mutate({
      cert_type: certType,
      slot_updates: slots
    }, {
      onSuccess: () => {
        onClose()
      }
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-navy">Edit Preset Field Scopes</h3>
            <p className="text-xs text-gray-500 mt-0.5">Adjust dimensions for <b>{certType.replace(/_/g, ' ')}</b> ({template.name})</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {slots.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-4">No fields to edit.</div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {slots.map((slot, i) => (
                <div key={slot.slot_id} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-sm font-semibold mb-3 text-foreground">{slot.slot_id}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Width (px)</label>
                      <input type="number" value={slot.width} onChange={(e) => handleChange(i, 'width', e.target.value)} className="form-input py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Height (px)</label>
                      <input type="number" value={slot.height} onChange={(e) => handleChange(i, 'height', e.target.value)} className="form-input py-1 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Font Size (px)</label>
                      <input type="number" value={slot.font_size} onChange={(e) => handleChange(i, 'font_size', e.target.value)} className="form-input py-1 text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={updateSlots.isPending} className="btn-primary">
              {updateSlots.isPending ? <><LoadingSpinner size="sm" label=""/> Saving...</> : 'Save Dimensions'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
