/**
 * GuestWizard.jsx — 5-step certificate wizard for Guest users.
 *
 * Step 1 — Upload PNG template      (POST /guest/template)
 * Step 2 — Upload Excel + columns   (POST /guest/excel, POST /guest/config)
 * Step 3 — Position fields canvas   (POST /field-positions  [cert_type=guest])
 * Step 4 — Generate certificates    (POST /guest/generate)
 * Step 5 — Send emails + ZIP        (POST /guest/send-emails, GET /guest/zip)
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import FileUpload from './FileUpload'
import LoadingSpinner from './LoadingSpinner'
import DataTable from './DataTable'
import StatusBadge from './StatusBadge'
import { useToastStore } from '../store/uiStore'
import axiosInstance, { BACKEND_URL } from '../utils/axiosInstance'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function resolveImgSrc(url) {
  if (!url) return null
  if (url.startsWith('blob:') || url.startsWith('http')) return url
  return `${BACKEND_URL}${url}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Step pill indicator
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: 'Certificate Template' },
  { n: 2, label: 'Excel & Columns' },
  { n: 3, label: 'Position Fields' },
  { n: 4, label: 'Review Sample' },
  { n: 5, label: 'Generate' },
  { n: 6, label: 'Send & Download' },
]

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-0 w-full mb-8 overflow-x-auto pb-2">
      {STEPS.map((s, i) => {
        const done   = current > s.n
        const active = current === s.n
        return (
          <div key={s.n} className="flex items-center min-w-0">
            {i > 0 && (
              <div className={`h-0.5 w-8 sm:w-12 flex-shrink-0 ${done ? 'bg-indigo-500' : 'bg-gray-200'}`} />
            )}
            <div
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold
                whitespace-nowrap flex-shrink-0 transition-all
                ${active ? 'bg-indigo-600 text-white shadow-md' : ''}
                ${done   ? 'bg-indigo-100 text-indigo-700' : ''}
                ${!active && !done ? 'bg-gray-100 text-gray-400' : ''}
              `}
            >
              <span
                className={`
                  flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold
                  ${active ? 'bg-white text-indigo-600' : ''}
                  ${done   ? 'bg-indigo-500 text-white' : ''}
                  ${!active && !done ? 'bg-gray-300 text-gray-500' : ''}
                `}
              >
                {done ? '✓' : s.n}
              </span>
              {s.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StepCard({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mb-6">{subtitle}</p>}
      {children}
    </div>
  )
}

function formatDateTime(value) {
  if (!value) return '—'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function PositionTag({ label, x, y, color, fontSize, isActive, onSelect }) {
  const displaySize = Math.max(10, Math.min(42, Number(fontSize || 24) * 0.45))
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
      style={{ left: `${x}%`, top: `${y}%`, zIndex: 10 }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
    >
      <div
        className={`rounded-md px-2 py-1 shadow-md border border-white/30 text-white font-semibold whitespace-nowrap transition-transform ${isActive ? 'scale-110 ring-2 ring-white/80' : 'scale-100'}`}
        style={{ background: color, fontSize: `${displaySize}px`, lineHeight: 1.1 }}
      >
        {label}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Upload PNG template
// ─────────────────────────────────────────────────────────────────────────────
function Step1({ initialTemplateUrl, initialBlobUrl, onComplete }) {
  const addToast = useToastStore((s) => s.addToast)
  const [file, setFile]           = useState(null)
  // Prefer blob URL (instant, no network) over server URL for local preview
  const [preview, setPreview]     = useState(initialBlobUrl || initialTemplateUrl || null)
  const [uploading, setUploading] = useState(false)

  const handleFile = (f) => {
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const upload = async () => {
    if (!file) { addToast({ type: 'warning', message: 'Please select an image file first.' }); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await axiosInstance.post(
        `/guest/template`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      addToast({ type: 'success', message: 'Template uploaded successfully.' })
      // Pass BOTH: server URL (for persistence on reload) + current blob URL (for instant canvas display)
      onComplete({ templateUrl: data.preview_url, blobUrl: preview })
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Upload failed.' })
    } finally {
      setUploading(false)
    }
  }

  const previewSrc = resolveImgSrc(preview)

  return (
    <StepCard
      title="Upload Certificate Template"
      subtitle="Upload your certificate design as a PNG or JPG image. This will be the background for all generated certificates."
    >
      <div className="space-y-6">
        {previewSrc && (
          <div className="relative">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Preview</p>
            <img
              src={previewSrc}
              alt="Certificate template preview"
              className="w-full max-h-72 object-contain rounded-xl border border-gray-200 bg-gray-50"
            />
            <span className="absolute top-8 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
              Template Preview
            </span>
          </div>
        )}

        <FileUpload
          id="guest-template-upload"
          accept="image/*"
          label={previewSrc ? 'Drag to replace template' : 'Drag your certificate image here'}
          hint="PNG, JPG, JPEG · Max 1 MB"
          maxSizeMB={1}
          onFile={handleFile}
        />

        <div className="flex justify-end">
          <button
            id="guest-step1-next"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            onClick={upload}
            disabled={uploading || !file}
          >
            {uploading ? <><LoadingSpinner size="sm" label="" /> Uploading…</> : 'Upload & Continue →'}
          </button>
        </div>
      </div>
    </StepCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Upload Excel + select columns
// ─────────────────────────────────────────────────────────────────────────────
function Step2({ initialState, onComplete, onBack }) {
  const addToast = useToastStore((s) => s.addToast)

  const [file, setFile]                 = useState(null)
  const [headers, setHeaders]           = useState(initialState?.headers || [])
  const [rowCount, setRowCount]         = useState(initialState?.rowCount || 0)
  const [selectedCols, setSelectedCols] = useState(new Set(initialState?.selectedColumns || []))
  const [emailCol, setEmailCol]         = useState(initialState?.emailColumn || '')
  const [uploading, setUploading]       = useState(false)
  const [saving, setSaving]             = useState(false)

  const uploadExcel = async () => {
    if (!file) { addToast({ type: 'warning', message: 'Select an Excel file.' }); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await axiosInstance.post(
        `/guest/excel`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      setHeaders(data.headers)
      setRowCount(data.row_count)
      setSelectedCols(new Set())
      setEmailCol(data.email_column || '')
      addToast({ type: 'success', message: `Loaded ${data.row_count} rows, ${data.headers.length} columns.` })
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Parse failed.' })
    } finally {
      setUploading(false)
    }
  }

  const toggleCol = (h) => {
    setSelectedCols((prev) => {
      const next = new Set(prev)
      next.has(h) ? next.delete(h) : next.add(h)
      return next
    })
  }

  const saveConfig = async () => {
    if (selectedCols.size === 0) { addToast({ type: 'warning', message: 'Select at least one column.' }); return }
    setSaving(true)
    try {
      await axiosInstance.post(
        `/guest/config`,
        { selected_columns: Array.from(selectedCols), email_column: emailCol || null },
      )
      addToast({ type: 'success', message: 'Column configuration saved.' })
      onComplete({ selectedColumns: Array.from(selectedCols), emailColumn: emailCol, headers, rowCount })
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Save failed.' })
    } finally {
      setSaving(false)
    }
  }

  const allSelected = headers.length > 0 && selectedCols.size === headers.length
  const toggleAll   = () => allSelected ? setSelectedCols(new Set()) : setSelectedCols(new Set(headers))

  return (
    <StepCard
      title="Upload Excel & Select Columns"
      subtitle="Upload your participant Excel file and select only the columns you want on certificates. Email column is optional and only needed for sending emails."
    >
      <div className="space-y-6">
        <div>
          <FileUpload
            id="guest-excel-upload"
            accept=".xlsx,.xls"
            label="Drop your Excel file here"
            hint=".xlsx or .xls · Max 20 MB"
            maxSizeMB={20}
            onFile={setFile}
          />
          <div className="mt-3 flex justify-end">
            <button
              id="guest-parse-excel-btn"
              className="px-5 py-2 rounded-xl bg-gray-800 text-white text-sm font-semibold hover:bg-gray-900 disabled:opacity-50 transition-colors"
              onClick={uploadExcel}
              disabled={uploading || !file}
            >
              {uploading ? <><LoadingSpinner size="sm" label="" /> Parsing…</> : '📊 Parse Excel'}
            </button>
          </div>
        </div>

        {headers.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">
                Select columns to print
                <span className="ml-2 text-xs text-indigo-600 font-normal">
                  ({selectedCols.size} of {headers.length} selected · {rowCount} rows)
                </span>
              </p>
              <button className="text-xs text-indigo-600 hover:underline" onClick={toggleAll}>
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
              {headers.map((h) => (
                <label
                  key={h}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                    selectedCols.has(h)
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-800 font-medium'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-indigo-600"
                    checked={selectedCols.has(h)}
                    onChange={() => toggleCol(h)}
                  />
                  <span className="truncate" title={h}>{h}</span>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Email column
                <span className="ml-1.5 text-xs text-gray-400 font-normal">(auto-detected from Excel; you can change it if needed)</span>
              </label>
              <select
                id="guest-email-col-select"
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                value={emailCol}
                onChange={(e) => setEmailCol(e.target.value)}
              >
                <option value="">— Select email column —</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button
            className="px-5 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            onClick={onBack}
          >
            ← Back
          </button>
          <button
            id="guest-step2-next"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
            onClick={saveConfig}
            disabled={saving || selectedCols.size === 0}
          >
            {saving ? <><LoadingSpinner size="sm" label="" /> Saving…</> : 'Save & Continue →'}
          </button>
        </div>
      </div>
    </StepCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Position fields on the canvas
// ─────────────────────────────────────────────────────────────────────────────
function Step3({ templateUrl, templateBlobUrl, selectedColumns, initialPositions, onComplete, onBack }) {
  const addToast  = useToastStore((s) => s.addToast)
  const canvasRef = useRef(null)
  const imgRef    = useRef(null)

  const normalizeFontSize = (pos) => {
    if (pos && pos.font_size != null) return Number(pos.font_size)
    if (pos && pos.font_size_percent != null) {
      return Math.max(8, Math.min(120, Math.round(Number(pos.font_size_percent || 3.2) * 24)))
    }
    return 24
  }

  const [positions, setPositions] = useState(() => {
    const init = {}
    selectedColumns.forEach((col) => {
      const incoming = initialPositions?.[col] || {}
      init[col] = {
        x_percent: Number(incoming.x_percent ?? 50),
        y_percent: Number(incoming.y_percent ?? 50),
        font_size: normalizeFontSize(incoming),
      }
    })
    return init
  })
  const [activeCol, setActiveCol] = useState(selectedColumns[0] || null)
  const [saving, setSaving]       = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [templateAspect, setTemplateAspect] = useState(16 / 11)

  // Prefer blob URL (instant) > server URL > nothing
  const imgSrc = resolveImgSrc(templateBlobUrl || templateUrl)

  const handleCanvasClick = useCallback((e) => {
    if (!activeCol || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const xPct = ((e.clientX - rect.left) / rect.width)  * 100
    const yPct = ((e.clientY - rect.top)  / rect.height) * 100
    setPositions((prev) => ({
      ...prev,
      [activeCol]: { ...prev[activeCol], x_percent: +xPct.toFixed(2), y_percent: +yPct.toFixed(2) },
    }))
  }, [activeCol])

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

  const updateProp = (col, prop, val) => {
    const parsed = parseFloat(val)
    if (Number.isNaN(parsed)) return
    const limits = {
      x_percent: [0, 100],
      y_percent: [0, 100],
      font_size: [8, 120],
    }
    const [min, max] = limits[prop] || [0, 9999]
    const nextVal = Number(clamp(parsed, min, max).toFixed(2))
    setPositions((prev) => ({ ...prev, [col]: { ...prev[col], [prop]: nextVal } }))
  }

  const savePositions = async () => {
    setSaving(true)
    try {
      const columnPositions = {}
      selectedColumns.forEach((col) => {
        columnPositions[col] = {
          x_percent:         positions[col].x_percent,
          y_percent:         positions[col].y_percent,
          font_size:         positions[col].font_size,
        }
      })
      const rect = canvasRef.current?.getBoundingClientRect()
      await axiosInstance.post(
        `/guest/field-positions`,
        {
          cert_type:         'guest',
          template_filename: '__guest__',
          column_positions:  columnPositions,
          display_width:     rect?.width ?? 580,
          confirmed:         true,
        },
      )
      addToast({ type: 'success', message: 'Field positions saved.' })
      onComplete({ positions })
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Save failed.' })
    } finally {
      setSaving(false)
    }
  }

  const COL_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#3b82f6','#84cc16']
  const colColor = (col) => COL_COLORS[selectedColumns.indexOf(col) % COL_COLORS.length]

  return (
    <StepCard
      title="Position Certificate Fields"
      subtitle="Click anywhere on the certificate canvas to place the active field's text. Fine-tune positions with the numeric controls. Font size is in pixels, like the department dashboard."
    >
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-2 font-medium">
            Active field: <span className="font-bold text-indigo-700">{activeCol || '—'}</span>
            {activeCol && <span className="text-gray-400"> — click the template to move it</span>}
          </p>
          <div
            ref={canvasRef}
            className="relative w-full rounded-xl overflow-hidden border border-gray-200 cursor-crosshair bg-gray-100"
            style={{ aspectRatio: String(templateAspect) }}
            onClick={handleCanvasClick}
          >
            {imgSrc ? (
              <img
                ref={imgRef}
                src={imgSrc}
                alt="Certificate template"
                className="absolute inset-0 w-full h-full object-contain select-none"
                draggable={false}
                onLoad={(e) => {
                  setImgLoaded(true)
                  const img = e.currentTarget
                  if (img?.naturalWidth && img?.naturalHeight) {
                    setTemplateAspect(img.naturalWidth / img.naturalHeight)
                  }
                }}
                onError={(e) => { e.target.style.display = 'none' }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
                <svg className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">No template loaded — complete Step 1 first</p>
              </div>
            )}

            {/* Show positioned tags over the template */}
            {imgSrc && selectedColumns.map((col) => {
              const pos = positions[col]
              if (!pos) return null
              const color = colColor(col)
              return (
                <PositionTag
                  key={col}
                  label={col}
                  x={pos.x_percent}
                  y={pos.y_percent}
                  color={color}
                  fontSize={pos.font_size}
                  isActive={activeCol === col}
                  onSelect={() => setActiveCol(col)}
                />
              )
            })}
          </div>
        </div>

        {/* Controls panel */}
        <div className="w-full lg:w-64 space-y-3 flex-shrink-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Field Controls</p>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {selectedColumns.map((col) => {
              const pos    = positions[col] || { x_percent: 50, y_percent: 50, font_size: 24 }
              const color  = colColor(col)
              const isActive = activeCol === col
              return (
                <div
                  key={col}
                  onClick={() => setActiveCol(col)}
                  className={`rounded-xl border-2 p-3 cursor-pointer transition-all text-sm ${isActive ? 'shadow-md' : 'border-gray-100 hover:border-gray-300'}`}
                  style={isActive ? { borderColor: color, background: color + '10' } : {}}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="font-semibold text-gray-800 truncate" title={col}>{col}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'X %',  key: 'x_percent',         min: 0, max: 100, step: 0.5 },
                      { label: 'Y %',  key: 'y_percent',         min: 0, max: 100, step: 0.5 },
                      { label: 'Font', key: 'font_size',         min: 8, max: 120, step: 1 },
                    ].map(({ label, key, min, max, step }) => (
                      <div key={key}>
                        <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                        <input
                          type="number"
                          min={min} max={max} step={step}
                          className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs text-center focus:border-indigo-400 focus:outline-none"
                          value={pos[key] ?? ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateProp(col, key, e.target.value)}
                        />
                        {key === 'font_size' && (
                          <input
                            type="range"
                            min={8}
                            max={120}
                            step={1}
                            value={pos.font_size ?? 24}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateProp(col, 'font_size', e.target.value)}
                            className="mt-1 w-full accent-indigo-600"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-gray-400">This uses pixel font sizing to match the department dashboard preview.</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
        <button
          className="px-5 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          onClick={onBack}
        >
          ← Back
        </button>
        <button
          id="guest-step3-next"
          className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          onClick={savePositions}
          disabled={saving}
        >
          {saving ? <><LoadingSpinner size="sm" label="" /> Saving…</> : 'Save Positions & Continue →'}
        </button>
      </div>
    </StepCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Review first-row sample certificate
// ─────────────────────────────────────────────────────────────────────────────
function Step4Sample({ onBack, onComplete }) {
  const addToast = useToastStore((s) => s.addToast)
  const [loading, setLoading] = useState(false)
  const [sample, setSample] = useState(null)

  const fetchSample = async () => {
    setLoading(true)
    setSample(null)
    try {
      const { data } = await axiosInstance.post('/guest/sample-preview')
      setSample({ ...data, _previewTs: Date.now() })
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to generate sample preview.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSample()
  }, [])

  const sampleSrcBase = resolveImgSrc(sample?.sample_url)
  const sampleSrc = sampleSrcBase
    ? `${sampleSrcBase}${sampleSrcBase.includes('?') ? '&' : '?'}t=${sample?._previewTs || Date.now()}`
    : null

  return (
    <StepCard
      title="Review Sample Certificate"
      subtitle="This preview uses the first row of your Excel file. If alignment/font size looks good, continue. Otherwise, go back and adjust field positions."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Sample Certificate</p>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-2">
              {loading ? (
                <div className="flex h-64 items-center justify-center"><LoadingSpinner label="Generating sample..." /></div>
              ) : sampleSrc ? (
                <img key={sample?._previewTs || 'sample'} src={sampleSrc} alt="Sample certificate preview" className="w-full rounded-lg object-contain" />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-gray-400">No sample available</div>
              )}
            </div>
            <button
              className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              onClick={fetchSample}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh Sample'}
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">First Row Data</p>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Field</th>
                    <th className="px-3 py-2 text-left font-semibold">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(sample?.first_row || {}).map(([k, v]) => (
                    <tr key={k} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-700">{k}</td>
                      <td className="px-3 py-2 text-gray-600">{String(v || '—')}</td>
                    </tr>
                  ))}
                  {Object.keys(sample?.first_row || {}).length === 0 && (
                    <tr>
                      <td className="px-3 py-8 text-center text-gray-400" colSpan={2}>No row data available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <button
            className="px-5 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            onClick={onBack}
          >
            ← Back to Field Positioning
          </button>
          <button
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
            onClick={onComplete}
            disabled={!sampleSrc || loading}
          >
            Looks Good, Continue →
          </button>
        </div>
      </div>
    </StepCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Generate certificates
// ─────────────────────────────────────────────────────────────────────────────
function Step4({ rowCount, emailColumn, allocatePoints, pointsPerCert, onAllocatePointsChange, onPointsChange, onComplete, onBack }) {
  const addToast = useToastStore((s) => s.addToast)
  const [generating, setGenerating] = useState(false)
  const [result, setResult]         = useState(null)

  const generate = async () => {
    setGenerating(true)
    setResult(null)
    try {
      const payload = {
        allocate_points: !!allocatePoints,
        points_per_cert: allocatePoints ? Number(pointsPerCert || 0) : 0,
      }
      const { data } = await axiosInstance.post(`/guest/generate`, payload)
      setResult(data)
      if (data.generated > 0) addToast({ type: 'success', message: `${data.generated} certificate(s) generated!` })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Generation failed.'
      addToast({ type: 'error', message: msg })
      setResult({ generated: 0, errors: [msg] })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <StepCard
      title="Generate Certificates"
      subtitle={`Click the button below to generate certificates for all ${rowCount} participant(s).`}
    >
      <div className="space-y-6">
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Credit Allocation</p>
              <p className="text-xs text-gray-500">Optionally assign credit points for each generated certificate. The student email is taken from the uploaded sheet.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={!!allocatePoints}
                onChange={(e) => onAllocatePointsChange(e.target.checked)}
                disabled={!emailColumn}
              />
              Allocate points
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-sm font-medium text-gray-700" htmlFor="guest-points-per-cert">
              Points per certificate
            </label>
            <input
              id="guest-points-per-cert"
              type="number"
              min={0}
              step={1}
              value={pointsPerCert}
              onChange={(e) => onPointsChange(e.target.value)}
              disabled={!allocatePoints || !emailColumn}
              className="form-input w-full sm:w-40"
            />
            <span className="text-xs text-gray-400">Applies to all rows with a valid student email.</span>
          </div>
          {!emailColumn && (
            <p className="mt-2 text-xs text-amber-600">No email column was detected in the uploaded Excel file.</p>
          )}
        </div>

        <div className="flex flex-col items-center justify-center py-10 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          {generating ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center animate-pulse">
                <svg className="w-8 h-8 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-700">Generating certificates…</p>
              <p className="text-xs text-gray-400">This may take a moment for large batches.</p>
            </div>
          ) : result ? (
            <div className="text-center space-y-3">
              <div className={`text-5xl font-black ${result.generated > 0 ? 'text-green-500' : 'text-red-400'}`}>
                {result.generated}
              </div>
              <p className="text-sm text-gray-600">
                certificate(s) generated
                {result.errors?.length > 0 && <span className="text-amber-600"> · {result.errors.length} error(s)</span>}
              </p>
              {result.errors?.length > 0 && (
                <div className="max-h-32 overflow-y-auto text-left bg-red-50 rounded-lg p-3 mt-2">
                  {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <p className="text-sm text-gray-600">Ready to generate <strong>{rowCount}</strong> certificate(s)</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            className="px-5 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            onClick={onBack}
          >
            ← Back
          </button>
          <div className="flex gap-3">
            {result?.generated > 0 && (
              <button
                id="guest-step4-next"
                className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                onClick={() => onComplete({ generated: result.generated })}
              >
                Continue to Send & Download →
              </button>
            )}
            <button
              id="guest-generate-btn"
              className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
              onClick={generate}
              disabled={generating}
            >
              {generating ? <><LoadingSpinner size="sm" label="" /> Generating…</> : '⚡ Generate Certificates'}
            </button>
          </div>
        </div>
      </div>
    </StepCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — Send emails + ZIP download
// ─────────────────────────────────────────────────────────────────────────────
function Step5({
  generatedCount,
  emailColumn,
  emailStatuses,
  emailCounts,
  onEmailStatusUpdate,
  onBack,
}) {
  const addToast   = useToastStore((s) => s.addToast)
  const [sending, setSending]         = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [emailResult, setEmailResult] = useState(null)

  const sendEmails = async (rowIndexes) => {
    setSending(true)
    try {
      const payload = rowIndexes?.length ? { row_indexes: rowIndexes } : undefined
      const { data } = await axiosInstance.post(`/guest/send-emails`, payload)
      setEmailResult(data)
      if (data.sent > 0) {
        addToast({ type: 'success', message: `${data.sent} email(s) sent!` })
      } else if (data.failed > 0) {
        addToast({ type: 'warning', message: 'Some emails failed. Please retry the failed rows.' })
      }
      if (data.email_statuses) {
        onEmailStatusUpdate(data)
      }
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Email send failed.' })
    } finally {
      setSending(false)
    }
  }

  const downloadZip = async () => {
    setDownloading(true)
    try {
      const resp = await axiosInstance.get(`/guest/zip`, { responseType: 'blob' })
      const url  = URL.createObjectURL(resp.data)
      const a    = document.createElement('a')
      a.href = url; a.download = `certificates.zip`; a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Download failed.' })
    } finally {
      setDownloading(false)
    }
  }

  const rows = (emailStatuses || []).map((entry, idx) => ({
    row_index: entry?.row_index ?? idx,
    recipient_name: entry?.recipient_name || '—',
    recipient_email: entry?.recipient_email || '—',
    status: entry?.status || 'pending',
    sent_at: entry?.sent_at,
    error: entry?.error,
  }))

  const emailStats = emailCounts || { sent: 0, failed: 0, pending: 0, total: 0 }
  const hasEmailStatusRows = (emailStatuses || []).length > 0
  const pendingCount = emailStats.pending || (!hasEmailStatusRows && generatedCount > 0 ? generatedCount : 0)
  const effectiveEmailStats = {
    ...emailStats,
    pending: pendingCount,
    total: emailStats.total || generatedCount,
  }

  return (
    <StepCard
      title="Send & Download"
      subtitle={`${generatedCount} certificate(s) are ready. Send them via email or download as a ZIP file.`}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl p-5 text-center border border-indigo-100">
            <div className="text-4xl font-black text-indigo-700">{generatedCount}</div>
            <p className="text-xs font-semibold text-indigo-500 mt-1">Certificates Generated</p>
          </div>
          <div className="rounded-2xl p-5 border bg-white border-gray-100">
            <div className="text-xs font-semibold text-gray-500">Email Delivery</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold text-green-600">{effectiveEmailStats.sent}</div>
                <div className="text-[11px] text-gray-400">Sent</div>
              </div>
              <div>
                <div className="text-lg font-bold text-amber-600">{effectiveEmailStats.pending}</div>
                <div className="text-[11px] text-gray-400">Pending</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-500">{effectiveEmailStats.failed}</div>
                <div className="text-[11px] text-gray-400">Failed</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Send emails card */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Send via Email</p>
                <p className="text-xs text-gray-500">Email each certificate to the recipient address read from the Excel upload</p>
              </div>
            </div>
            {emailResult && (
              <div className={`mb-3 rounded-xl p-3 text-xs ${emailResult.failed > 0 ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-800'}`}>
                ✅ {emailResult.sent} sent · ❌ {emailResult.failed} failed
                {emailResult.errors?.length > 0 && (
                  <div className="mt-1 max-h-20 overflow-y-auto space-y-0.5">
                    {emailResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                  </div>
                )}
              </div>
            )}
            <button
              id="guest-send-emails-btn"
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              onClick={() => sendEmails()}
              disabled={sending || !emailColumn || pendingCount === 0}
            >
              {sending ? (
                <><LoadingSpinner size="sm" label="" /> Sending…</>
              ) : (
                `✉ Send to Uploaded Emails (${pendingCount})`
              )}
            </button>
            {!emailColumn && (
              <p className="mt-2 text-xs text-amber-600">No email column detected in the uploaded Excel file.</p>
            )}
          </div>

          {/* Download ZIP card */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Download as ZIP</p>
                <p className="text-xs text-gray-500">Get all {generatedCount} certificates in one file</p>
              </div>
            </div>
            <button
              id="guest-download-zip-btn"
              className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              onClick={downloadZip}
              disabled={downloading}
            >
              {downloading ? <><LoadingSpinner size="sm" label="" /> Downloading…</> : '⬇ Download ZIP'}
            </button>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Email Delivery Status</p>
            <span className="text-xs text-gray-500">
              {emailStats.total} recipient{emailStats.total !== 1 ? 's' : ''}
            </span>
          </div>

          <DataTable
            columns={[
              { key: 'recipient_name', header: 'Name', searchKey: true },
              { key: 'recipient_email', header: 'Email', searchKey: true },
              {
                key: 'status',
                header: 'Status',
                render: (v) => <StatusBadge status={v || 'pending'} size="sm" />,
              },
              { key: 'sent_at', header: 'Sent At', render: (v) => formatDateTime(v) },
              {
                key: 'error',
                header: 'Error',
                render: (v) => (v ? <span className="text-xs text-red-600" title={v}>{v}</span> : '—'),
              },
              {
                key: '_actions',
                header: 'Action',
                align: 'center',
                render: (_, row) => {
                  if (!emailColumn) return '—'
                  if (row.status === 'emailed') return '—'
                  return (
                    <button
                      className="rounded bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                      onClick={() => sendEmails([row.row_index])}
                      disabled={sending}
                    >
                      {row.status === 'failed' ? 'Retry' : 'Send'}
                    </button>
                  )
                },
              },
            ]}
            data={rows}
            isLoading={false}
            emptyMessage="No recipients loaded yet."
            searchable
            searchPlaceholder="Search recipients..."
            rowKey="row_index"
          />
        </div>

        <div className="flex justify-start pt-2">
          <button
            className="px-5 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            onClick={onBack}
          >
            ← Back
          </button>
        </div>
      </div>
    </StepCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main GuestWizard
// ─────────────────────────────────────────────────────────────────────────────
export default function GuestWizard({ eventName }) {
  const [step, setStep]         = useState(1)
  const [isRestoring, setIsRestoring] = useState(true)

  // Per-step state carried between wizard steps
  const [templateUrl,    setTemplateUrl]    = useState(null)  // server path /storage/guest_templates/…
  const [templateBlob,   setTemplateBlob]   = useState(null)  // blob: URL for instant canvas display
  const [excelState,     setExcelState]     = useState(null)  // { headers, rowCount, selectedColumns, emailColumn }
  const [fieldPositions, setFieldPositions] = useState(null)  // { positions }
  const [generatedCount, setGeneratedCount] = useState(0)
  const [emailStatuses, setEmailStatuses] = useState([])
  const [emailCounts, setEmailCounts] = useState({ sent: 0, failed: 0, pending: 0, total: 0 })
  const [allocatePoints, setAllocatePoints] = useState(false)
  const [pointsPerCert, setPointsPerCert] = useState(0)

  const deriveCounts = (statuses = []) => {
    let sent = 0
    let failed = 0
    let pending = 0
    statuses.forEach((entry) => {
      const status = (entry?.status || 'pending').toLowerCase()
      if (status === 'emailed') sent += 1
      else if (status === 'failed') failed += 1
      else pending += 1
    })
    return { sent, failed, pending, total: statuses.length }
  }

  useEffect(() => {
    let mounted = true

    const restoreProgress = async () => {
      try {
        const { data } = await axiosInstance.get('/guest/status')
        if (!mounted || !data) return

        if (data.template_url) setTemplateUrl(data.template_url)
        if (data.step2_complete) {
          setExcelState({
            headers: data.all_excel_headers,
            rowCount: data.excel_row_count,
            selectedColumns: data.selected_columns,
            emailColumn: data.email_column,
          })
        }
        if (data.step3_complete && data.field_positions?.column_positions) {
          setFieldPositions({ positions: data.field_positions.column_positions })
        }
        if (data.step4_complete) setGeneratedCount(data.generated_count || 0)
        if (typeof data.guest_allocate_points === 'boolean') {
          setAllocatePoints(data.guest_allocate_points)
        }
        if (typeof data.guest_points_per_cert === 'number') {
          setPointsPerCert(data.guest_points_per_cert)
        }
        const statusRows = data.email_statuses || []
        setEmailStatuses(statusRows)
        if (typeof data.email_sent_count === 'number') {
          setEmailCounts({
            sent: data.email_sent_count,
            failed: data.email_failed_count || 0,
            pending: data.email_pending_count || 0,
            total: data.email_total_count || statusRows.length,
          })
        } else {
          setEmailCounts(deriveCounts(statusRows))
        }

        if (data.step4_complete) {
          setStep(6)
        } else if (data.step3_complete) {
          setStep(4)
        } else if (data.step2_complete) {
          setStep(3)
        } else if (data.step1_complete) {
          setStep(2)
        } else {
          setStep(1)
        }
      } catch {
        if (mounted) setStep(1)
      } finally {
        if (mounted) setIsRestoring(false)
      }
    }

    restoreProgress()
    return () => {
      mounted = false
    }
  }, [])

  const handleEmailStatusUpdate = (data) => {
    const statusRows = data?.email_statuses || []
    setEmailStatuses(statusRows)
    if (typeof data?.email_sent_count === 'number') {
      setEmailCounts({
        sent: data.email_sent_count,
        failed: data.email_failed_count || 0,
        pending: data.email_pending_count || 0,
        total: data.email_total_count || statusRows.length,
      })
    } else {
      setEmailCounts(deriveCounts(statusRows))
    }
  }

  if (isRestoring) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner label="Restoring progress..." />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <StepIndicator current={step} />

      {step === 1 && (
        <Step1
          initialTemplateUrl={templateUrl}
          initialBlobUrl={templateBlob}
          onComplete={({ templateUrl: url, blobUrl }) => {
            setTemplateUrl(url)
            if (blobUrl) setTemplateBlob(blobUrl)
            setStep(2)
          }}
        />
      )}

      {step === 2 && (
        <Step2
          initialState={excelState}
          onBack={() => setStep(1)}
          onComplete={(data) => { setExcelState(data); setStep(3) }}
        />
      )}

      {step === 3 && (
        <Step3
          templateUrl={templateUrl}
          templateBlobUrl={templateBlob}
          selectedColumns={excelState?.selectedColumns || []}
          initialPositions={fieldPositions?.positions || {}}
          onBack={() => setStep(2)}
          onComplete={(data) => { setFieldPositions(data); setStep(4) }}
        />
      )}

      {step === 4 && (
        <Step4Sample
          onBack={() => setStep(3)}
          onComplete={() => setStep(5)}
        />
      )}

      {step === 5 && (
        <Step4
          rowCount={excelState?.rowCount || 0}
          emailColumn={excelState?.emailColumn}
          allocatePoints={allocatePoints}
          pointsPerCert={pointsPerCert}
          onAllocatePointsChange={setAllocatePoints}
          onPointsChange={(value) => setPointsPerCert(value)}
          onBack={() => setStep(4)}
          onComplete={({ generated }) => {
            setGeneratedCount(generated)
            const pending = Math.max(0, Number(generated) || 0)
            setEmailStatuses([])
            setEmailCounts({ sent: 0, failed: 0, pending, total: pending })
            setStep(6)
          }}
        />
      )}

      {step === 6 && (
        <Step5
          generatedCount={generatedCount}
          emailColumn={excelState?.emailColumn}
          emailStatuses={emailStatuses}
          emailCounts={emailCounts}
          onEmailStatusUpdate={handleEmailStatusUpdate}
          onBack={() => setStep(5)}
        />
      )}
    </div>
  )
}
