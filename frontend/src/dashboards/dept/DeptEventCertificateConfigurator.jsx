import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

import FileUpload from '../../components/FileUpload'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useToastStore } from '../../store/uiStore'
import { BACKEND_URL } from '../../utils/axiosInstance'
import {
  useDeptEventTemplate,
  useUploadDeptEventTemplate,
  extractDeptExcelHeaders,
  useDeptEventMapping,
  useSaveDeptEventMapping,
  useGenerateDeptEventCertificates,
} from './api'

const DEFAULT_FIELD_POS = { x_percent: 50, y_percent: 50, font_size: 36 }

function toImageUrl(url) {
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('blob:')) return url
  return `${BACKEND_URL}${url}`
}

function DraggableTag({ id, label, x, y }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id })

  const style = {
    position: 'absolute',
    left: `${x}%`,
    top: `${y}%`,
    transform: `${CSS.Translate.toString(transform)} translate(-50%, -50%)`,
    cursor: 'grab',
    zIndex: 10,
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <div className="rounded border border-navy/50 bg-white/80 px-2 py-1 text-[10px] font-semibold text-navy shadow-sm">
        {label}
      </div>
    </div>
  )
}

export default function DeptEventCertificateConfigurator({ event, onClose }) {
  const addToast = useToastStore((s) => s.addToast)

  const containerRef = useRef(null)

  const { data: templateResp } = useDeptEventTemplate(event?.id)
  const { data: mappingResp } = useDeptEventMapping(event?.id)

  const uploadTemplateMutation = useUploadDeptEventTemplate(event?.id)
  const saveMappingMutation = useSaveDeptEventMapping(event?.id)
  const generateMutation = useGenerateDeptEventCertificates(event?.id)

  const [templateFile, setTemplateFile] = useState(null)
  const [excelFile, setExcelFile] = useState(null)
  const [headers, setHeaders] = useState([])
  const [selectedFields, setSelectedFields] = useState([])
  const [fieldPositions, setFieldPositions] = useState({
    _cert_number: { x_percent: 82, y_percent: 5, font_size: 24 },
    _logo: { x_percent: 12, y_percent: 12, font_size: 24 },
    _signature: { x_percent: 18, y_percent: 84, font_size: 24 },
  })

  const [extracting, setExtracting] = useState(false)

  const templateUrl = toImageUrl(templateResp?.template?.template_url)

  useEffect(() => {
    if (!mappingResp) return
    setSelectedFields(mappingResp.selected_fields || [])
    setFieldPositions((prev) => ({
      ...prev,
      ...(mappingResp.field_positions || {}),
    }))
  }, [mappingResp])

  const allDraggableIds = useMemo(
    () => [...selectedFields, '_cert_number', '_logo', '_signature'],
    [selectedFields],
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDragEnd = (evt) => {
    if (!containerRef.current) return
    const { active, delta } = evt
    const id = active?.id
    if (!id) return

    const rect = containerRef.current.getBoundingClientRect()
    const dx = (delta.x / rect.width) * 100
    const dy = (delta.y / rect.height) * 100

    setFieldPositions((prev) => {
      const p = prev[id] || { ...DEFAULT_FIELD_POS }
      return {
        ...prev,
        [id]: {
          ...p,
          x_percent: Math.max(0, Math.min(100, Number(p.x_percent || 50) + dx)),
          y_percent: Math.max(0, Math.min(100, Number(p.y_percent || 50) + dy)),
        },
      }
    })
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
      setSelectedFields((prev) => {
        const keep = prev.filter((f) => hdrs.includes(f))
        return keep
      })
      addToast({ type: 'success', message: `${hdrs.length} field(s) extracted from Excel.` })
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to extract headers.' })
    } finally {
      setExtracting(false)
    }
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
  }

  const saveMapping = async () => {
    await saveMappingMutation.mutateAsync({
      selected_fields: selectedFields,
      field_positions: fieldPositions,
    })
  }

  const generateCertificates = async () => {
    if (!excelFile) {
      addToast({ type: 'warning', message: 'Upload Excel file to generate certificates.' })
      return
    }
    await generateMutation.mutateAsync(excelFile)
  }

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">{event?.name} - Certificate Setup</h3>
          <p className="text-xs text-gray-500">Upload template, map fields, drag positions, then generate certificates.</p>
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

          <div className="flex gap-2">
            <button className="btn-primary" onClick={saveMapping} disabled={saveMappingMutation.isPending || selectedFields.length === 0}>
              {saveMappingMutation.isPending ? 'Saving...' : 'Save Mapping'}
            </button>
            <button className="btn-primary" onClick={generateCertificates} disabled={generateMutation.isPending || !excelFile}>
              {generateMutation.isPending ? 'Generating...' : 'Generate Certificates'}
            </button>
          </div>
        </div>

        <div className="min-h-[520px] rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
          {!templateUrl ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400">Upload event template to start positioning.</div>
          ) : (
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <div ref={containerRef} className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded border bg-white" style={{ aspectRatio: '2480 / 3508' }}>
                <img src={templateUrl} alt="Template preview" className="absolute inset-0 h-full w-full object-cover opacity-85" />

                {selectedFields.map((f) => {
                  const pos = fieldPositions[f] || DEFAULT_FIELD_POS
                  return <DraggableTag key={f} id={f} label={f} x={pos.x_percent} y={pos.y_percent} />
                })}

                {['_cert_number', '_logo', '_signature'].map((id) => {
                  const label = id === '_cert_number' ? 'Cert No' : id === '_logo' ? 'Logo' : 'Signature'
                  const pos = fieldPositions[id] || DEFAULT_FIELD_POS
                  return <DraggableTag key={id} id={id} label={label} x={pos.x_percent} y={pos.y_percent} />
                })}
              </div>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  )
}
