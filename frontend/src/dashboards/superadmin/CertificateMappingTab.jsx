import { useMemo, useState, useEffect, useRef } from 'react'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useToastStore } from '../../store/uiStore'
import { Mouse, Trash2, Plus, AlertCircle, Image as ImageIcon } from 'lucide-react'
import {
  useRoleMappings,
  useCreateRoleMapping,
  useUpdateRoleMapping,
  useSeedRoleMappings,
} from './api'
import { useImageTemplates } from '../club/eventsApi'

const EMPTY_POSITION = { x_percent: 50, y_percent: 50, font_size_percent: 2.5 }

function normalizeRoleName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
}

function asNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toFormState(preset) {
  if (!preset) {
    return {
      role_name: '',
      display_label: '',
      template_filename: '',
      display_width: 1905,
      is_active: true,
      column_positions: {},
      asset_positions: null,
    }
  }
  return {
    role_name: preset.role_name || '',
    display_label: preset.display_label || '',
    template_filename: preset.template_filename || '',
    display_width: asNumber(preset.display_width, 1905),
    is_active: !!preset.is_active,
    column_positions: { ...(preset.column_positions || {}) },
    asset_positions: preset.asset_positions || null,
  }
}

export default function CertificateMappingTab() {
  const addToast = useToastStore((s) => s.addToast)
  const { data: mappings, isLoading, refetch } = useRoleMappings(true)
  const { data: templates } = useImageTemplates()

  const createMutation = useCreateRoleMapping()
  const updateMutation = useUpdateRoleMapping()

  const [selectedRole, setSelectedRole] = useState('')
  const [form, setForm] = useState(() => toFormState(null))
  
  // Visual Mapper State
  const imageRef = useRef(null)
  const [pendingFieldId, setPendingFieldId] = useState(null)
  const [fieldNameInput, setFieldNameInput] = useState('')

  const sortedMappings = useMemo(() => {
    return [...(mappings || [])].sort((a, b) =>
      String(a.display_label || a.role_name).localeCompare(String(b.display_label || b.role_name)),
    )
  }, [mappings])

  const selectedPreset = useMemo(
    () => sortedMappings.find((m) => m.role_name === selectedRole) || null,
    [sortedMappings, selectedRole],
  )

  const templateOptions = useMemo(() => {
    return [...new Set((templates || []).map((t) => t.filename).filter(Boolean))]
  }, [templates])

  useEffect(() => {
    if (!selectedRole) {
      setForm(toFormState(null))
      return
    }
    if (!selectedPreset) return // Prevent wiping state during refetch race conditions
    setForm(toFormState(selectedPreset))
    setPendingFieldId(null)
    setFieldNameInput('')
  }, [selectedRole, selectedPreset])

  const allFieldKeys = useMemo(() => Object.keys(form.column_positions || {}), [form.column_positions])

  const busy = createMutation.isPending || updateMutation.isPending

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // --- Visual Mapper Handlers ---
  const handleImageClick = (e) => {
    if (!pendingFieldId) {
       addToast({ type: 'info', message: 'Add a new field first and confirm its name to place it on the certificate.' })
       return
    }
    const rect = imageRef.current.getBoundingClientRect()
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2))
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2))

    setForm((prev) => ({
      ...prev,
      column_positions: {
        ...prev.column_positions,
        [pendingFieldId]: {
          ...(prev.column_positions?.[pendingFieldId] || EMPTY_POSITION),
          x_percent: x,
          y_percent: y,
        },
      },
    }))
    setPendingFieldId(null)
  }

  const confirmFieldName = () => {
    const name = fieldNameInput.trim()
    if (!name) {
      addToast({ type: 'warning', message: 'Please enter a field name.' })
      return
    }
    if (form.column_positions?.[name]) {
        addToast({ type: 'info', message: 'This field already exists.' })
        return
    }
    setForm((prev) => ({
      ...prev,
      column_positions: {
        ...prev.column_positions,
        [name]: { ...EMPTY_POSITION, x_percent: null, y_percent: null },
      },
    }))
    setPendingFieldId(name)
    setFieldNameInput('')
  }

  const handleRemoveField = (field) => {
    setForm((prev) => {
      const next = { ...(prev.column_positions || {}) }
      delete next[field]
      return { ...prev, column_positions: next }
    })
    if (pendingFieldId === field) {
      setPendingFieldId(null)
      setFieldNameInput('')
    }
  }

  const handleNew = () => {
    setSelectedRole('')
    setForm(toFormState(null))
  }

  const handleSave = async () => {
    const normalizedRole = normalizeRoleName(form.role_name)
    const payload = {
      role_name: normalizedRole,
      display_label: String(form.display_label || '').trim(),
      template_filename: String(form.template_filename || '').trim(),
      column_positions: form.column_positions || {},
      asset_positions: form.asset_positions || null,
      display_width: asNumber(form.display_width, 1905),
      is_active: !!form.is_active,
    }

    if (!payload.role_name) {
      addToast({ type: 'warning', message: 'Role key is required.' })
      return
    }
    if (!payload.display_label) {
      addToast({ type: 'warning', message: 'Display label is required.' })
      return
    }
    if (!payload.template_filename) {
      addToast({ type: 'warning', message: 'Template selection is required.' })
      return
    }
    
    const unmappedFields = allFieldKeys.filter(k => 
      form.column_positions[k].x_percent === null || form.column_positions[k].y_percent === null
    )
    if (unmappedFields.length > 0) {
      addToast({ type: 'warning', message: `Fields missing coordinates: ${unmappedFields.join(', ')}` })
      return
    }

    try {
      if (selectedPreset) {
        const updatePayload = { ...payload, role_name: selectedPreset.role_name }
        await updateMutation.mutateAsync({ roleName: selectedPreset.role_name, payload: updatePayload })
        await refetch()
        setSelectedRole(selectedPreset.role_name)
        addToast({ type: 'success', message: 'Mapping successfully updated' })
        return
      }

      await createMutation.mutateAsync(payload)
      await refetch()
      setSelectedRole(payload.role_name)
      addToast({ type: 'success', message: 'Mapping successfully initialized' })
    } catch {
      // Handled by UI store implicitly
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Certificate Mapping</h1>
          <p className="mt-1 text-sm text-gray-500">
            Dynamically create fields and visually map them over certificate templates.
          </p>
        </div>
        <button className="btn-secondary" onClick={handleNew}>New Mapping</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px,1fr]">
        <section className="card p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">Existing Role Mappings</p>
          {isLoading ? (
            <LoadingSpinner />
          ) : sortedMappings.length === 0 ? (
            <p className="text-sm text-gray-500">No mappings found.</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
              {sortedMappings.map((m) => {
                const active = selectedRole === m.role_name
                return (
                  <button
                    key={m.role_name}
                    onClick={() => setSelectedRole(m.role_name)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      active ? 'border-navy bg-navy/5' : 'border-gray-200 hover:border-navy/40'
                    }`}
                  >
                    <p className="text-sm font-semibold text-foreground">{m.display_label}</p>
                    <p className="text-xs text-gray-500">{m.role_name}</p>
                    <p className="mt-1 text-xs text-navy font-medium truncate">{m.template_filename}</p>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        <section className="card flex flex-col min-h-[75vh] overflow-hidden">
          <div className="p-5 border-b border-gray-100 shrink-0 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="form-label">Role Key *</label>
                <input
                  className="form-input text-sm"
                  value={form.role_name}
                  onChange={(e) => handleChange('role_name', e.target.value)}
                  placeholder="non_technical_participant"
                  disabled={!!selectedPreset}
                />
              </div>
              <div>
                <label className="form-label">Display Label *</label>
                <input
                  className="form-input text-sm"
                  value={form.display_label}
                  onChange={(e) => handleChange('display_label', e.target.value)}
                  placeholder="Non-Technical Participant"
                />
              </div>
              <div>
                <label className="form-label">Template Image *</label>
                <select
                  className="form-input text-sm"
                  value={form.template_filename}
                  onChange={(e) => {
                     setForm((prev) => ({
                       ...prev,
                       template_filename: e.target.value
                     }))
                     setPendingFieldId(null)
                  }}
                >
                  <option value="">Select template</option>
                  {templateOptions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  id="mapping-active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => handleChange('is_active', e.target.checked)}
                />
                <label htmlFor="mapping-active" className="text-sm font-medium text-gray-700">Mapping Active</label>
              </div>
              <button className="btn-primary" onClick={handleSave} disabled={busy}>
                {busy ? 'Saving…' : selectedPreset ? 'Update Mapping' : 'Create Mapping'}
              </button>
            </div>
          </div>

          {!form.template_filename ? (
             <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8">
               <ImageIcon size={48} className="mb-4 opacity-20" />
               <p>Please select a template image to preview and map fields.</p>
             </div>
          ) : (
            <div className="flex flex-1 overflow-hidden min-h-[500px]">
              {/* Visual Preview Canvas */}
              <div className="flex-1 p-6 bg-gray-50 overflow-auto flex items-center justify-center relative">
                <div 
                  className={`relative shadow-lg ring-1 ring-black/5 bg-white transition-colors duration-200 ${pendingFieldId ? 'cursor-crosshair border-2 border-indigo-400' : ''}`}
                  onClick={handleImageClick}
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                >
                  <img 
                    ref={imageRef}
                    src={`http://localhost:8000/static/certificate_templates/${form.template_filename}`}
                    alt="Certificate Template Preview" 
                    className="w-full h-auto block select-none pointer-events-none"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                  
                  {/* Render positioned fields */}
                  {allFieldKeys.map(key => {
                    const pos = form.column_positions[key];
                    if (pos.x_percent === null || pos.y_percent === null) return null;
                    return (
                      <div 
                        key={key}
                        className={`absolute flex flex-col items-center cursor-pointer transition-transform ${pendingFieldId === key ? 'scale-125 z-10' : 'hover:scale-110 z-0'}`}
                        style={{ left: `${pos.x_percent}%`, top: `${pos.y_percent}%`, transform: 'translate(-50%, -50%)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingFieldId(key);
                        }}
                      >
                        <div className={`px-2.5 py-1 backdrop-blur text-white text-xs font-semibold rounded shadow-md whitespace-nowrap border border-white/30 transition-all ${pendingFieldId === key ? 'bg-indigo-600 outline outline-2 outline-indigo-200' : 'bg-navy/90 hover:bg-navy'}`}>
                          {key}
                        </div>
                      </div>
                    )
                  })}


                </div>
              </div>

              {/* Sidebar - Fields List */}
              <div className="w-80 bg-white border-l border-gray-100 flex flex-col h-full shadow-inner">
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between shrink-0">
                  <h3 className="font-semibold text-sm text-foreground">Custom Fields</h3>
                  <div className="flex items-center gap-3">
                    {allFieldKeys.length > 0 && (
                      <button onClick={() => setForm(f => ({ ...f, column_positions: {} }))} className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors">Clear All</button>
                    )}
                    <span className="text-xs font-bold text-navy bg-navy/10 px-2 py-1 rounded">{allFieldKeys.length}</span>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {allFieldKeys.length === 0 && !pendingFieldId && (
                     <div className="text-center py-8 opacity-40">
                       <p className="text-sm font-medium text-gray-500">No custom fields created</p>
                     </div>
                  )}

                  {allFieldKeys.map((field) => {
                    const pos = form.column_positions[field];
                    const isPending = pos.x_percent === null || pos.y_percent === null;
                    return (
                      <div key={field} className={`rounded-xl border p-3 flex flex-col gap-2 transition-colors ${isPending ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-foreground break-all">{field}</p>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setPendingFieldId(field)} className="text-gray-400 hover:text-indigo-500 transition-colors" title="Reposition">
                              <Mouse size={16} />
                            </button>
                            <button onClick={() => handleRemoveField(field)} className="text-gray-400 hover:text-red-500 transition-colors" title="Remove">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        {isPending ? (
                          <div className="text-xs font-medium text-amber-700 flex items-center gap-1">
                            <AlertCircle size={12}/> Awaiting visual placement
                          </div>
                        ) : (
                          <div className="flex gap-2">
                             <div className="flex-1 bg-gray-50 rounded px-2 py-1 text-[10px] font-mono text-gray-600 border border-gray-100">X: {pos.x_percent}%</div>
                             <div className="flex-1 bg-gray-50 rounded px-2 py-1 text-[10px] font-mono text-gray-600 border border-gray-100">Y: {pos.y_percent}%</div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0">
                  {pendingFieldId === null ? (
                    <div className="space-y-2">
                      <input 
                        type="text"
                        value={fieldNameInput}
                        onChange={(e) => setFieldNameInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && confirmFieldName()}
                        placeholder="e.g. Student Name"
                        className="form-input text-sm w-full"
                      />
                      <button onClick={confirmFieldName} className="btn-secondary w-full flex items-center justify-center gap-2">
                        <Plus size={16} /> Create Field
                      </button>
                    </div>
                  ) : (
                     <button onClick={() => { setPendingFieldId(null); setFieldNameInput(''); handleRemoveField(pendingFieldId); }} className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-sm rounded-lg transition-colors">
                       Cancel Placement
                     </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
