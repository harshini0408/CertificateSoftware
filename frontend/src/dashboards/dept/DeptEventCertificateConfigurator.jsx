import { useEffect, useRef, useState } from 'react'

import FileUpload from '../../components/FileUpload'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useToastStore } from '../../store/uiStore'
import { BACKEND_URL } from '../../utils/axiosInstance'
import {
  useDeptEvent,
  useDeptEventTemplate,
  useUploadDeptEventTemplate,
  extractDeptExcelHeaders,
  previewDeptExcelParticipants,
  useDeptEventMapping,
  useSaveDeptEventMapping,
  useDeptAssets,
} from './api'

const DEFAULT_FIELD_POS = { x_percent: 50, y_percent: 50, font_size: 36 }
const MANUAL_FIELD_OPTIONS = [
  { id: '_date', label: 'Date' },
]

function toImageUrl(url) {
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('blob:')) return url
  return `${BACKEND_URL}${url}`
}

function PositionedTag({ id, label, x, y, isActive, onSelect, fontSize }) {
  const style = {
    position: 'absolute',
    left: `${x}%`,
    top: `${y}%`,
    transform: 'translate(-50%, -50%)',
    cursor: 'pointer',
    zIndex: 10,
  }

  return (
    <div style={style} onClick={(e) => { e.stopPropagation(); onSelect(id) }}>
      <div
        className={`rounded px-2 py-1 font-semibold shadow-sm ${
        isActive ? 'border border-amber-500 bg-amber-50 text-amber-700' : 'border border-navy/50 bg-white/80 text-navy'
      }`}
        style={{
          fontSize: `${Math.max(10, Math.min(42, Number(fontSize || 24) * 0.45))}px`,
          lineHeight: 1.1,
        }}
      >
        {label}
      </div>
    </div>
  )
}

export default function DeptEventCertificateConfigurator({ event, onClose }) {
  const addToast = useToastStore((s) => s.addToast)

  const containerRef = useRef(null)

  const { data: eventState } = useDeptEvent(event?.id)
  const { data: templateResp } = useDeptEventTemplate(event?.id)
  const { data: mappingResp } = useDeptEventMapping(event?.id)
  const { data: deptAssets } = useDeptAssets()

  const uploadTemplateMutation = useUploadDeptEventTemplate(event?.id)
  const saveMappingMutation = useSaveDeptEventMapping(event?.id)

  const [templateFile, setTemplateFile] = useState(null)
  const [excelFile, setExcelFile] = useState(null)
  const [headers, setHeaders] = useState([])
  const [selectedFields, setSelectedFields] = useState([])
  const [fieldPositions, setFieldPositions] = useState({})
  const [enabledAssetKeys, setEnabledAssetKeys] = useState([])

  const [extracting, setExtracting] = useState(false)
  const [previewRow, setPreviewRow] = useState(null)
  const [templateAspectRatio, setTemplateAspectRatio] = useState(2480 / 3508)
  const [activePlacementKey, setActivePlacementKey] = useState(null)

  const templateUrl = toImageUrl(templateResp?.template?.template_url)

  const getPreviewValue = (fieldId) => {
    if (fieldId === '_cert_number') return 'CERT-0001'
    if (fieldId === '_date') return event?.event_date ? new Date(event.event_date).toLocaleDateString('en-IN') : 'Date'
    if (fieldId === '_logo') return 'Logo'
    if (fieldId === '_signature') return 'Signature'
    if (!previewRow) return fieldId

    const raw = previewRow[fieldId]
    const value = raw == null ? '' : String(raw).trim()
    return value || fieldId
  }

  useEffect(() => {
    if (!mappingResp) return
    setSelectedFields(mappingResp.selected_fields || [])
    const incoming = mappingResp.field_positions || {}
    setFieldPositions((prev) => ({ ...prev, ...incoming }))
    // Asset placement is now opt-in per click, so don't auto-enable saved asset keys.
    setEnabledAssetKeys([])
  }, [mappingResp])

  useEffect(() => {
    if (!eventState) return
    const savedHeaders = eventState?.excel_headers || []
    if (savedHeaders.length) {
      setHeaders(savedHeaders)
    }
    if (eventState?.preview_row && Object.keys(eventState.preview_row).length > 0) {
      setPreviewRow(eventState.preview_row)
    }
  }, [eventState])

  useEffect(() => {
    const validKeys = [...selectedFields, ...enabledAssetKeys]
    if (!validKeys.includes(activePlacementKey)) {
      setActivePlacementKey(validKeys[0] || null)
    }
  }, [selectedFields, enabledAssetKeys, activePlacementKey])

  const toggleAssetKey = (id) => {
    const isEnabled = enabledAssetKeys.includes(id)
    const isActive = activePlacementKey === id

    if (isEnabled && isActive) {
      setEnabledAssetKeys((prev) => prev.filter((k) => k !== id))
      setFieldPositions((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setActivePlacementKey(null)
      return
    }

    if (isEnabled) {
      setActivePlacementKey(id)
      return
    }

    setEnabledAssetKeys((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setFieldPositions((prev) => ({
      ...prev,
      [id]: prev[id] || (id === '_cert_number'
        ? { x_percent: 82, y_percent: 5, font_size: 24 }
        : id === '_logo'
          ? { x_percent: 12, y_percent: 12, font_size: 24 }
          : { x_percent: 18, y_percent: 84, font_size: 24 }),
    }))
    setActivePlacementKey(id)
  }

  const placeAtClick = (evt) => {
    if (!containerRef.current) return
    if (!activePlacementKey) {
      addToast({ type: 'warning', message: 'Select a field first, then click on template to place it.' })
      return
    }

    const rect = containerRef.current.getBoundingClientRect()
    const xPercent = ((evt.clientX - rect.left) / rect.width) * 100
    const yPercent = ((evt.clientY - rect.top) / rect.height) * 100

    setFieldPositions((prev) => ({
      ...prev,
      [activePlacementKey]: {
        ...(prev[activePlacementKey] || { ...DEFAULT_FIELD_POS }),
        x_percent: Math.max(0, Math.min(100, xPercent)),
        y_percent: Math.max(0, Math.min(100, yPercent)),
      },
    }))
  }

  const handleUploadTemplate = async () => {
    if (!templateFile) {
      addToast({ type: 'warning', message: 'Select template file first.' })
      return
    }
    await uploadTemplateMutation.mutateAsync(templateFile)
    setTemplateFile(null)
  }

  const handleExtractHeaders = async () => {
    if (!excelFile) {
      addToast({ type: 'warning', message: 'Upload Excel file first.' })
      return
    }
    setExtracting(true)
    try {
      const data = await extractDeptExcelHeaders(event.id, excelFile)
      const hdrs = data?.headers || []
      setHeaders(hdrs)
      const preview = await previewDeptExcelParticipants(event.id, excelFile)
      setPreviewRow(preview?.preview_row || preview?.participants?.[0]?.raw || null)
      setSelectedFields((prev) => {
        const keep = prev.filter((f) => hdrs.includes(f) || f === '_date')
        return keep
      })
      addToast({ type: 'success', message: `${hdrs.length} field(s) extracted from Excel.` })
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to extract headers.' })
    } finally {
      setExtracting(false)
    }
  }

  const updateFontSize = (fieldId, nextSize) => {
    if (!fieldId) return
    const safeSize = Math.max(8, Math.min(120, Number(nextSize) || 24))
    setFieldPositions((prev) => ({
      ...prev,
      [fieldId]: {
        ...(prev[fieldId] || { ...DEFAULT_FIELD_POS }),
        font_size: safeSize,
      },
    }))
  }

  const toggleField = (field) => {
    setSelectedFields((prev) => {
      const exists = prev.includes(field)
      if (exists) return prev.filter((f) => f !== field)
      return [...prev, field]
    })
    setFieldPositions((prev) => ({
      ...prev,
      [field]: prev[field] || { ...DEFAULT_FIELD_POS },
    }))

    setActivePlacementKey(field)
  }

  const buildMappingPayload = () => {
    const activeKeys = new Set([...selectedFields, ...enabledAssetKeys])
    const filteredPositions = Object.fromEntries(
      Object.entries(fieldPositions).filter(([key]) => activeKeys.has(key)),
    )
    return {
      selected_fields: selectedFields,
      field_positions: filteredPositions,
    }
  }

  const saveMapping = async () => {
    await saveMappingMutation.mutateAsync(buildMappingPayload())
  }

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">{event?.name} - Certificate Setup</h3>
          <p className="text-xs text-gray-500">Upload template, map fields, select a target and click on preview to place it, then continue to Certificates for preview and generation.</p>
        </div>
        <button className="btn-secondary" onClick={onClose}>Close</button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <p className="form-label">1) Upload Event Template</p>
            <FileUpload id="dept-event-template" accept=".png,.jpg,.jpeg" label="Template image" hint="PNG/JPG" maxSizeMB={10} onFile={setTemplateFile} />
            <button className="btn-secondary mt-2" onClick={handleUploadTemplate} disabled={uploadTemplateMutation.isPending || !templateFile}>
              {uploadTemplateMutation.isPending ? 'Uploading...' : 'Upload Template'}
            </button>
          </div>

          <div>
            <p className="form-label">2) Upload Excel and Extract Fields</p>
            <FileUpload id="dept-event-excel" accept=".xlsx,.xls" label="Excel file" hint=".xlsx/.xls" maxSizeMB={10} onFile={setExcelFile} />
            <button className="btn-secondary mt-2" onClick={handleExtractHeaders} disabled={extracting || !excelFile}>
              {extracting ? 'Extracting...' : 'Extract Fields'}
            </button>
          </div>

          <div>
            <p className="form-label">3) Choose Fields to Print</p>
            <div className="flex flex-wrap gap-2">
              {headers.length === 0 && <p className="text-xs text-gray-400">No fields yet. Extract headers from Excel first.</p>}
              {MANUAL_FIELD_OPTIONS.map((opt) => {
                const active = selectedFields.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleField(opt.id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border ${
                      active ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
              {headers.map((h) => {
                const active = selectedFields.includes(h)
                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => toggleField(h)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border ${
                      active ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-300'
                    }`}
                  >
                    {h}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="form-label">4) Select Field to Position, then click on template</p>
            <div className="flex flex-wrap gap-2">
              {selectedFields.map((f) => (
                <button
                  key={`place-${f}`}
                  type="button"
                  onClick={() => setActivePlacementKey(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${
                    activePlacementKey === f ? 'bg-amber-50 text-amber-700 border-amber-500' : 'bg-white text-gray-600 border-gray-300'
                  }`}
                >
                  Place: {f === '_date' ? 'Date' : f}
                </button>
              ))}
              {['_cert_number', '_logo', '_signature'].map((id) => {
                const label = id === '_cert_number' ? 'Cert No' : id === '_logo' ? 'Logo' : 'Signature'
                const enabled = enabledAssetKeys.includes(id)
                return (
                  <button
                    key={`place-${id}`}
                    type="button"
                    onClick={() => toggleAssetKey(id)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border ${
                      activePlacementKey === id
                        ? 'bg-amber-50 text-amber-700 border-amber-500'
                        : enabled
                          ? 'bg-navy/10 text-navy border-navy/30'
                          : 'bg-white text-gray-600 border-gray-300'
                    }`}
                  >
                    Place: {label}
                  </button>
                )
              })}
            </div>
            {activePlacementKey && (
              <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-xs font-medium text-gray-600 mb-2">Font Size</p>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={8}
                    max={120}
                    value={Number(fieldPositions[activePlacementKey]?.font_size || 24)}
                    onChange={(e) => updateFontSize(activePlacementKey, e.target.value)}
                    className="w-full"
                  />
                  <input
                    type="number"
                    min={8}
                    max={120}
                    value={Number(fieldPositions[activePlacementKey]?.font_size || 24)}
                    onChange={(e) => updateFontSize(activePlacementKey, e.target.value)}
                    className="form-input w-20 text-center"
                  />
                </div>
              </div>
            )}
            {previewRow && (
              <p className="mt-2 text-xs text-gray-500">
                Showing preview using the first extracted row.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button className="btn-primary" onClick={saveMapping} disabled={saveMappingMutation.isPending || selectedFields.length === 0}>
              {saveMappingMutation.isPending ? 'Saving...' : 'Save Mapping'}
            </button>
            <button
              className="btn-primary"
              onClick={async () => {
                const hasRows = (eventState?.source_rows_count || 0) > 0 || !!previewRow
                if (!hasRows) {
                  addToast({ type: 'warning', message: 'Upload Excel and extract fields first.' })
                  return
                }
                await saveMappingMutation.mutateAsync(buildMappingPayload())
                if (typeof onClose === 'function') {
                  onClose({
                    nextTab: 'certificates',
                  })
                }
              }}
              disabled={saveMappingMutation.isPending || selectedFields.length === 0}
            >
              Continue to Certificates
            </button>
          </div>
        </div>

        <div className="min-h-[520px] rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
          {!templateUrl ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">Upload event template to start positioning.</div>
          ) : (
            <div
              ref={containerRef}
              className="relative mx-auto w-full max-w-[620px] overflow-hidden rounded border bg-white cursor-crosshair"
              style={{ aspectRatio: String(templateAspectRatio) }}
              onClick={placeAtClick}
              title="Click to place selected field"
            >
              <img
                src={templateUrl}
                alt="Template preview"
                className="absolute inset-0 h-full w-full object-contain object-center"
                onLoad={(e) => {
                  const img = e.currentTarget
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    setTemplateAspectRatio(img.naturalWidth / img.naturalHeight)
                  }
                }}
              />

              {selectedFields.map((f) => {
                const pos = fieldPositions[f] || DEFAULT_FIELD_POS
                return (
                  <PositionedTag
                    key={f}
                    id={f}
                    label={getPreviewValue(f)}
                    x={pos.x_percent}
                    y={pos.y_percent}
                    fontSize={pos.font_size}
                    isActive={activePlacementKey === f}
                    onSelect={setActivePlacementKey}
                  />
                )
              })}

              {enabledAssetKeys.map((id) => {
                const label = getPreviewValue(id)
                const pos = fieldPositions[id] || DEFAULT_FIELD_POS
                return (
                  <PositionedTag
                    key={id}
                    id={id}
                    label={label}
                    x={pos.x_percent}
                    y={pos.y_percent}
                    fontSize={pos.font_size}
                    isActive={activePlacementKey === id}
                    onSelect={setActivePlacementKey}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
