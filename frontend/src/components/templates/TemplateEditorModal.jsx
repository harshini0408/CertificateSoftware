import { useState, useEffect, useRef } from 'react'
import {
  useForkTemplate,
  useTemplateHtml,
  useUpdateTemplateHtml,
  useTemplate
} from '../../api/templates'
import { extractTokens, validateTokens } from '../../utils/templateTokens'
import LoadingSpinner from '../LoadingSpinner'
import ConfirmModal from '../ConfirmModal'
import { useToastStore } from '../../store/uiStore'

export default function TemplateEditorModal({ templateId, onClose }) {
  const addToast = useToastStore(s => s.addToast)
  
  // APIs
  const { data: baseTemplate } = useTemplate(templateId)
  const forkMutation = useForkTemplate()
  const updateMutation = useUpdateTemplateHtml()
  
  // We first ensure we are editing a fork, then load its HTML
  const [forkId, setForkId] = useState(null)
  
  // Fork on mount if needed
  useEffect(() => {
    if (templateId) {
      forkMutation.mutate(templateId, {
        onSuccess: (forkedDoc) => {
          setForkId(forkedDoc.id)
        }
      })
    }
  }, [templateId]) // eslint-disable-line

  const { data: htmlData, isLoading: isLoadingHtml, refetch: refetchHtml } = useTemplateHtml(forkId)

  // Local Editor State
  const [htmlContent, setHtmlContent] = useState('')
  const [debouncedHtml, setDebouncedHtml] = useState('')
  const [fieldSlots, setFieldSlots] = useState([])
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirmClose, setShowConfirmClose] = useState(false)
  const [showConfirmReset, setShowConfirmReset] = useState(false)
  
  // Field Editor State
  const [editingFieldId, setEditingFieldId] = useState(null)
  const [editingLabel, setEditingLabel] = useState('')

  // Sync data to local state once loaded
  useEffect(() => {
    if (htmlData && !isDirty) {
      setHtmlContent(htmlData.html_content)
      setDebouncedHtml(htmlData.html_content)
      setFieldSlots(htmlData.field_slots || [])
    }
  }, [htmlData]) // eslint-disable-line

  // Debounce HTML changes for the iframe
  const timerRef = useRef()
  const handleHtmlChange = (e) => {
    const val = e.target.value
    setHtmlContent(val)
    if (!isDirty) setIsDirty(true)
    
    // Auto-sync field slots based on newly discovered tokens
    const currentTokens = extractTokens(val)
    setFieldSlots(prev => {
      const nextSlots = [...prev]
      // Add missing tokens as new slots default at 0,0
      currentTokens.forEach(t => {
        if (!nextSlots.find(s => s.slot_id === t)) {
          nextSlots.push({
            slot_id: t, label: t,
            x: 0, y: 0, width: 200, height: 40, font_size: 24, font_weight: 'normal', text_align: 'center'
          })
        }
      })
      // Keep existing slots even if token removed, to remember physical positioning in case they type it back
      return nextSlots
    })

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDebouncedHtml(val)
    }, 600)
  }

  // Field inline editor handlers
  const startEditingLabel = (slot) => {
    setEditingFieldId(slot.slot_id)
    setEditingLabel(slot.label)
  }

  const saveEditingLabel = () => {
    setFieldSlots(prev => prev.map(s => 
      s.slot_id === editingFieldId ? { ...s, label: editingLabel } : s
    ))
    setEditingFieldId(null)
    setIsDirty(true)
  }

  // Actions
  const handleClose = () => {
    if (isDirty) {
      setShowConfirmClose(true)
    } else {
      onClose()
    }
  }

  const handleSave = () => {
    // Validate missing minimum tokens (at least 'name')
    const missing = validateTokens(htmlContent, ['name'])
    if (missing.length > 0) {
      if (!window.confirm(`Warning: Your HTML is missing required token(s): {{${missing.join('}}, {{')}}}. It's strongly recommended to have them. Save anyway?`)) {
        return
      }
    }

    // Filter field_slots to only those actually present in the HTML 
    // to keep the output clean
    const currentTokens = extractTokens(htmlContent)
    const activeSlots = fieldSlots.filter(s => currentTokens.includes(s.slot_id))

    updateMutation.mutate(
      { html_content: htmlContent, field_slots: activeSlots },
      {
        onSuccess: () => {
          setIsDirty(false)
        }
      }
    )
  }

  const handleReset = () => {
    // We already have a confirm modal wrapping this
    if (baseTemplate?.source_preset_id || baseTemplate?.forked_from) {
      const sourceId = baseTemplate.forked_from || baseTemplate.source_preset_id
      // Fetch the original preset's HTML manually using our api instance to reset
      // Actually, standard useTemplateHtml needs to be a hook, so we fetch via standard axios here for the one-off reset
      import('../../utils/axiosInstance').then(({ default: axios }) => {
        axios.get(`/templates/${sourceId}/html`)
          .then(res => {
            const data = res.data
            setHtmlContent(data.html_content)
            setDebouncedHtml(data.html_content)
            setFieldSlots(data.field_slots || [])
            setIsDirty(true) // They reset to it, but haven't saved it to the fork yet
            addToast({ type: 'success', message: 'Reset to preset. Click Save to commit changes.'})
          })
          .catch(err => {
            addToast({ type: 'error', message: 'Failed to load source preset.'})
          })
      })
    } else {
      // It IS a preset, this shouldn't happen, but just refetch
      refetchHtml()
    }
    setShowConfirmReset(false)
  }

  const currentTokens = extractTokens(htmlContent)
  const isSetupLoading = !forkId || isLoadingHtml || forkMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/40 backdrop-blur-sm">
      {/* Modals */}
      {showConfirmClose && (
        <ConfirmModal
          title="Unsaved Changes"
          message="You have unsaved changes. Are you sure you want to close? Your edits will be lost."
          confirmText="Close & Discard"
          confirmStyle="danger"
          onConfirm={() => { setShowConfirmClose(false); onClose() }}
          onCancel={() => setShowConfirmClose(false)}
        />
      )}
      {showConfirmReset && (
        <ConfirmModal
          title="Reset to Preset"
          message="This will overwrite all your custom HTML and fields with the original preset values. Are you sure?"
          confirmText="Yes, Reset"
          confirmStyle="danger"
          onConfirm={handleReset}
          onCancel={() => setShowConfirmReset(false)}
        />
      )}

      {/* Main modal surface */}
      <div className="flex flex-col h-full w-full bg-white shadow-2xl overflow-hidden border-t-2 border-indigo-500">
        
        {/* Top Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b px-6 py-4 bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Customize Template: {baseTemplate?.name || 'Loading...'}
            </h2>
            <p className="text-sm text-gray-500">
              Edit the raw HTML and field labels for your club's certificate.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        {isSetupLoading ? (
          <div className="flex-grow flex items-center justify-center bg-gray-100/50">
            <LoadingSpinner label="Setting up custom template editor..." />
          </div>
        ) : (
          <div className="flex-grow flex flex-col lg:flex-row min-h-0">
            
            {/* Left: Code Editor */}
            <div className="flex-1 flex flex-col border-r border-gray-200 min-h-0 relative bg-gray-50/50">
              <div className="px-4 py-2 border-b bg-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Raw HTML</span>
                {isDirty && <span className="text-xs font-medium text-amber-500 bg-amber-50 px-2 py-0.5 rounded">Unsaved Changes</span>}
              </div>
              <textarea
                className="flex-grow w-full p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
                style={{ tabSize: 2 }}
                spellCheck={false}
                value={htmlContent}
                onChange={handleHtmlChange}
                placeholder="<html>...</html>"
              />
              <div className="px-4 py-3 border-t bg-gray-50 space-y-1">
                <div className="text-xs text-gray-600">
                  <strong className="text-indigo-600">Dynamic Fields:</strong> Wrap internal database keys in double braces like <code className="bg-indigo-50 text-indigo-700 px-1 rounded">{`{{name}}`}</code>.
                </div>
                <div className="text-[10px] text-gray-400">
                  Do not add script or event tags. They will be removed upon save.
                </div>
              </div>
            </div>

            {/* Right: Live Preview */}
            <div className="flex-1 flex flex-col min-h-0 bg-gray-100 relative">
              <div className="px-4 py-2 border-b bg-white flex items-center shadow-sm z-10">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Live Preview</span>
              </div>
              <div className="flex-grow p-4 overflow-auto flex items-center justify-center relative">
                {/* Visual placeholder of A4 document behind iframe to give depth */}
                <div 
                  className="bg-white shadow-[0_10px_30px_rgba(0,0,0,0.1)] relative"
                  style={{ 
                    // Maintain A4 aspect ratio in preview container
                    aspectRatio: '210/297', 
                    height: '100%',
                    maxHeight: '800px', 
                    width: 'auto' 
                  }}
                >
                  <iframe
                    title="Template Preview"
                    sandbox="allow-same-origin"
                    className="absolute inset-0 w-full h-full border-0 pointer-events-none"
                    srcDoc={debouncedHtml}
                  />
                  {/* Overlay detected tokens faintly for debugging/visibility */}
                  <div className="absolute inset-0 pointer-events-none opacity-40">
                    {fieldSlots.filter(s => currentTokens.includes(s.slot_id)).map(slot => (
                      <div
                        key={slot.slot_id}
                        className="absolute border border-dashed border-indigo-400 bg-indigo-50/20 text-indigo-700 font-bold text-[8px] flex items-center justify-center overflow-hidden"
                        style={{
                          left: `${(slot.x / 2480) * 100}%`,
                          top: `${(slot.y / 3508) * 100}%`,
                          width: `${(slot.width / 2480) * 100}%`,
                          height: `${(slot.height / 3508) * 100}%`
                        }}
                      >
                        {`{{${slot.slot_id}}}`}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Bottom Bar: Field Slots & Actions */}
        <div className="border-t bg-white px-6 py-4 flex flex-col lg:flex-row gap-4 justify-between items-center z-10 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
          <div className="flex-grow flex flex-col justify-center min-w-0">
            <span className="text-xs font-bold uppercase text-gray-400 mb-1.5">Detected Tokens (Edit Display Names)</span>
            <div className="flex flex-wrap gap-2">
              {currentTokens.length === 0 ? (
                <span className="text-sm text-gray-500 italic">No {'{{tokens}}'} found in HTML.</span>
              ) : (
                currentTokens.map(token => {
                  const slot = fieldSlots.find(s => s.slot_id === token)
                  const displayLabel = slot?.label || token
                  const isEditing = editingFieldId === token

                  if (isEditing) {
                    return (
                      <div key={token} className="flex items-center gap-1 bg-indigo-50 border border-indigo-300 rounded-full px-1 flex-shrink-0">
                        <span className="text-xs text-indigo-400 pl-2 font-mono">{`{{${token}}}`}</span>
                        <input
                          autoFocus
                          className="text-xs bg-white border border-indigo-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500 w-24"
                          value={editingLabel}
                          onChange={e => setEditingLabel(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveEditingLabel()}
                          onBlur={saveEditingLabel}
                        />
                      </div>
                    )
                  }

                  return (
                    <button
                      key={token}
                      onClick={() => startEditingLabel(slot || { slot_id: token, label: token })}
                      className="group flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-full pl-3 pr-2 py-1 text-xs transition-colors flex-shrink-0"
                    >
                      <span className="font-mono text-gray-500">{`{{${token}}}`}</span>
                      <span className="text-gray-900 font-medium whitespace-nowrap">{displayLabel}</span>
                      <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {baseTemplate?.forked_from || baseTemplate?.source_preset_id ? (
              <button
                onClick={() => setShowConfirmReset(true)}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors border border-transparent"
              >
                Reset to Built-in
              </button>
            ) : null}
            
            <button
              onClick={handleSave}
              disabled={!isDirty || updateMutation.isPending}
              className="btn-primary inline-flex items-center gap-2"
            >
              {updateMutation.isPending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Custom Changes
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
