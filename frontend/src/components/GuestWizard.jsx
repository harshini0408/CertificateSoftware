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
import { useToastStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import axiosInstance, { BACKEND_URL } from '../utils/axiosInstance'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const isValidId = (v) => v && v !== 'null' && v !== 'undefined'

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
  { n: 4, label: 'Generate' },
  { n: 5, label: 'Send & Download' },
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

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Upload PNG template
// ─────────────────────────────────────────────────────────────────────────────
function Step1({ clubId, eventId, initialTemplateUrl, initialBlobUrl, onComplete }) {
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
        `/clubs/${clubId}/events/${eventId}/guest/template`,
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
          hint="PNG, JPG, JPEG · Max 20 MB"
          maxSizeMB={20}
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
function Step2({ clubId, eventId, initialState, onComplete, onBack }) {
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
        `/clubs/${clubId}/events/${eventId}/guest/excel`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      setHeaders(data.headers)
      setRowCount(data.row_count)
      setSelectedCols(new Set())
      setEmailCol('')
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
    if (!emailCol) { addToast({ type: 'warning', message: 'Designate an email column.' }); return }
    setSaving(true)
    try {
      await axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/guest/config`,
        { selected_columns: Array.from(selectedCols), email_column: emailCol },
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
      subtitle="Upload your participant Excel file. Select which columns to print, and designate the email column for delivery."
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
                Email column <span className="text-red-500">*</span>
                <span className="ml-1.5 text-xs text-gray-400 font-normal">(used to send certificates)</span>
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
            disabled={saving || selectedCols.size === 0 || !emailCol}
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
function Step3({ clubId, eventId, templateUrl, templateBlobUrl, selectedColumns, initialPositions, onComplete, onBack }) {
  const addToast  = useToastStore((s) => s.addToast)
  const canvasRef = useRef(null)
  const imgRef    = useRef(null)

  const [positions, setPositions] = useState(() => {
    const init = {}
    selectedColumns.forEach((col) => {
      init[col] = initialPositions?.[col] ?? { x_percent: 50, y_percent: 50, font_size_percent: 3.2 }
    })
    return init
  })
  const [activeCol, setActiveCol] = useState(selectedColumns[0] || null)
  const [saving, setSaving]       = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

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

  const updateProp = (col, prop, val) => {
    setPositions((prev) => ({ ...prev, [col]: { ...prev[col], [prop]: +val } }))
  }

  const savePositions = async () => {
    setSaving(true)
    try {
      const columnPositions = {}
      selectedColumns.forEach((col) => {
        columnPositions[col] = {
          x_percent:         positions[col].x_percent,
          y_percent:         positions[col].y_percent,
          font_size_percent: positions[col].font_size_percent,
        }
      })
      const rect = canvasRef.current?.getBoundingClientRect()
      await axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/field-positions`,
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
      subtitle="Click anywhere on the certificate canvas to place the active field's text. Fine-tune positions with the numeric controls."
    >
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-2 font-medium">
            Active field: <span className="font-bold text-indigo-700">{activeCol || '—'}</span>
            {activeCol && <span className="text-gray-400"> — click canvas to place</span>}
          </p>
          <div
            ref={canvasRef}
            className="relative w-full rounded-xl overflow-hidden border border-gray-200 cursor-crosshair bg-gray-100"
            style={{ aspectRatio: '16/11' }}
            onClick={handleCanvasClick}
          >
            {imgSrc ? (
              <img
                ref={imgRef}
                src={imgSrc}
                alt="Certificate template"
                className="absolute inset-0 w-full h-full object-fill select-none"
                draggable={false}
                onLoad={() => setImgLoaded(true)}
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

            {/* Always show dots, even before image loads (using imgSrc presence) */}
            {imgSrc && selectedColumns.map((col) => {
              const pos = positions[col]
              if (!pos) return null
              const color = colColor(col)
              return (
                <div
                  key={col}
                  className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ left: `${pos.x_percent}%`, top: `${pos.y_percent}%` }}
                >
                  <div
                    className={`relative flex items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform ${activeCol === col ? 'scale-125' : 'scale-100'}`}
                    style={{ width: 22, height: 22, background: color }}
                  >
                    <span className="text-white text-[9px] font-bold leading-none">
                      {selectedColumns.indexOf(col) + 1}
                    </span>
                  </div>
                  <div
                    className="mt-0.5 px-1.5 py-0.5 rounded text-white text-[10px] font-semibold shadow whitespace-nowrap"
                    style={{ background: color, opacity: 0.92 }}
                  >
                    {col}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Controls panel */}
        <div className="w-full lg:w-72 space-y-3 flex-shrink-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Field Controls</p>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {selectedColumns.map((col) => {
              const pos    = positions[col] || { x_percent: 50, y_percent: 50, font_size_percent: 3.2 }
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
                      { label: 'Size', key: 'font_size_percent', min: 1, max: 8,   step: 0.1 },
                    ].map(({ label, key, min, max, step }) => (
                      <div key={key}>
                        <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                        <input
                          type="number"
                          min={min} max={max} step={step}
                          className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs text-center focus:border-indigo-400 focus:outline-none"
                          value={pos[key]?.toFixed?.(1) ?? pos[key]}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateProp(col, key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
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
// STEP 4 — Generate certificates
// ─────────────────────────────────────────────────────────────────────────────
function Step4({ clubId, eventId, rowCount, onComplete, onBack }) {
  const addToast = useToastStore((s) => s.addToast)
  const [generating, setGenerating] = useState(false)
  const [result, setResult]         = useState(null)

  const generate = async () => {
    setGenerating(true)
    setResult(null)
    try {
      const { data } = await axiosInstance.post(`/clubs/${clubId}/events/${eventId}/guest/generate`)
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
function Step5({ clubId, eventId, generatedCount, emailsSent: initialEmailsSent, onBack }) {
  const addToast   = useToastStore((s) => s.addToast)
  const [sending, setSending]         = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [emailResult, setEmailResult] = useState(null)
  const [emailsSent, setEmailsSent]   = useState(initialEmailsSent)

  const sendEmails = async () => {
    setSending(true)
    try {
      const { data } = await axiosInstance.post(`/clubs/${clubId}/events/${eventId}/guest/send-emails`)
      setEmailResult(data)
      if (data.sent > 0) { setEmailsSent(true); addToast({ type: 'success', message: `${data.sent} email(s) sent!` }) }
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Email send failed.' })
    } finally {
      setSending(false)
    }
  }

  const downloadZip = async () => {
    setDownloading(true)
    try {
      const resp = await axiosInstance.get(`/clubs/${clubId}/events/${eventId}/guest/zip`, { responseType: 'blob' })
      const url  = URL.createObjectURL(resp.data)
      const a    = document.createElement('a')
      a.href = url; a.download = `certificates_${eventId}.zip`; a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Download failed.' })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <StepCard
      title="Send & Download"
      subtitle={`${generatedCount} certificate(s) are ready. Send them via email or download as a ZIP file.`}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-2xl p-5 text-center border border-indigo-100">
            <div className="text-4xl font-black text-indigo-700">{generatedCount}</div>
            <p className="text-xs font-semibold text-indigo-500 mt-1">Certificates Generated</p>
          </div>
          <div className={`rounded-2xl p-5 text-center border ${emailsSent ? 'bg-gradient-to-br from-green-50 to-green-100 border-green-100' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-100'}`}>
            <div className={`text-4xl font-black ${emailsSent ? 'text-green-600' : 'text-gray-400'}`}>
              {emailsSent ? '✓' : '—'}
            </div>
            <p className={`text-xs font-semibold mt-1 ${emailsSent ? 'text-green-500' : 'text-gray-400'}`}>
              {emailsSent ? 'Emails Sent' : 'Emails Pending'}
            </p>
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
                <p className="text-xs text-gray-500">Email each certificate to its recipient</p>
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
              onClick={sendEmails}
              disabled={sending}
            >
              {sending ? <><LoadingSpinner size="sm" label="" /> Sending…</> : emailsSent ? '↺ Resend Emails' : '✉ Send Emails'}
            </button>
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
export default function GuestWizard({ clubId: propClubId, eventId: propEventId }) {
  const auth = useAuthStore()

  // Resolve IDs: URL params take priority; fall back to auth store JWT values.
  // Guards against the string "null"/"undefined" that occurs when auth-store
  // values are used to build the URL before being populated.
  const clubId  = isValidId(propClubId)  ? propClubId  : auth.club_id
  const eventId = isValidId(propEventId) ? propEventId : auth.event_id

  const [step, setStep]         = useState(1)
  const [loading, setLoading]   = useState(true)
  const [status, setStatus]     = useState(null)

  // Per-step state carried between wizard steps
  const [templateUrl,    setTemplateUrl]    = useState(null)  // server path /storage/guest_templates/…
  const [templateBlob,   setTemplateBlob]   = useState(null)  // blob: URL for instant canvas display
  const [excelState,     setExcelState]     = useState(null)  // { headers, rowCount, selectedColumns, emailColumn }
  const [fieldPositions, setFieldPositions] = useState(null)  // { positions }
  const [generatedCount, setGeneratedCount] = useState(0)

  // Load persisted progress from backend on mount
  useEffect(() => {
    if (!clubId || !eventId) { setLoading(false); return }
    ;(async () => {
      try {
        const { data } = await axiosInstance.get(`/clubs/${clubId}/events/${eventId}/guest/status`)
        setStatus(data)
        if (data.template_url) setTemplateUrl(data.template_url)
        if (data.step2_complete) {
          setExcelState({
            headers:         data.all_excel_headers,
            rowCount:        data.excel_row_count,
            selectedColumns: data.selected_columns,
            emailColumn:     data.email_column,
          })
        }
        if (data.step3_complete && data.field_positions) {
          setFieldPositions({ positions: data.field_positions.column_positions })
        }
        if (data.step4_complete) setGeneratedCount(data.generated_count)

        // Resume at the furthest completed step
        if      (data.step4_complete)  setStep(5)
        else if (data.step3_complete)  setStep(4)
        else if (data.step2_complete)  setStep(3)
        else if (data.step1_complete)  setStep(2)
        else                           setStep(1)
      } catch {
        setStep(1)  // first visit — start fresh
      } finally {
        setLoading(false)
      }
    })()
  }, [clubId, eventId])

  // ── Guard: IDs still not resolved ─────────────────────────────────────────
  if (!clubId || !eventId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="text-gray-600 text-sm max-w-xs">
          Could not determine your event ID. Please log out and log in again.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <LoadingSpinner label="Loading your workspace…" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <StepIndicator current={step} />

      {step === 1 && (
        <Step1
          clubId={clubId}
          eventId={eventId}
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
          clubId={clubId}
          eventId={eventId}
          initialState={excelState}
          onBack={() => setStep(1)}
          onComplete={(data) => { setExcelState(data); setStep(3) }}
        />
      )}

      {step === 3 && (
        <Step3
          clubId={clubId}
          eventId={eventId}
          templateUrl={templateUrl}
          templateBlobUrl={templateBlob}
          selectedColumns={excelState?.selectedColumns || []}
          initialPositions={fieldPositions?.positions || {}}
          onBack={() => setStep(2)}
          onComplete={(data) => { setFieldPositions(data); setStep(4) }}
        />
      )}

      {step === 4 && (
        <Step4
          clubId={clubId}
          eventId={eventId}
          rowCount={excelState?.rowCount || 0}
          onBack={() => setStep(3)}
          onComplete={({ generated }) => { setGeneratedCount(generated); setStep(5) }}
        />
      )}

      {step === 5 && (
        <Step5
          clubId={clubId}
          eventId={eventId}
          generatedCount={generatedCount}
          emailsSent={status?.step5_emails_sent || false}
          onBack={() => setStep(4)}
        />
      )}
    </div>
  )
}
