/**
 * FacultyWizard.jsx — Dedicated Certificate Generation Wizard for Faculty.
 *
 * All endpoints call /faculty/* (completely decoupled from /guest/*):
 * Step 1 — Upload PNG template      (POST /faculty/template)
 * Step 2 — Upload Excel + columns   (POST /faculty/excel, POST /faculty/config)
 * Step 3 — Position fields canvas   (POST /faculty/field-positions)
 * Step 4 — Review sample preview    (POST /faculty/sample-preview)
 * Step 5 — Generate certificates    (POST /faculty/generate) + View Certificates List with Eye Icon
 * Step 6 — Send emails + ZIP        (POST /faculty/send-emails, GET /faculty/zip)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import FileUpload from '../../components/FileUpload'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import { useToastStore } from '../../store/uiStore'
import axiosInstance, { BACKEND_URL } from '../../utils/axiosInstance'

function resolveImgSrc(url) {
  if (!url) return null
  if (url.startsWith('blob:') || url.startsWith('http')) return url
  return `${BACKEND_URL}${url}`
}

function formatDateTime(value) {
  if (!value) return '—'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

const EyeIcon = ({ className = 'w-4 h-4' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const DownloadIcon = ({ className = 'w-4 h-4' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const MailIcon = ({ className = 'w-4 h-4' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L1 7" />
  </svg>
)

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
        const done = current > s.n
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
                ${done ? 'bg-indigo-100 text-indigo-700' : ''}
                ${!active && !done ? 'bg-gray-100 text-gray-400' : ''}
              `}
            >
              <span
                className={`
                  flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold
                  ${active ? 'bg-white text-indigo-600' : ''}
                  ${done ? 'bg-indigo-500 text-white' : ''}
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
// Certificate Preview Modal
// ─────────────────────────────────────────────────────────────────────────────
function CertificateViewModal({ cert, onClose }) {
  if (!cert) return null
  const previewSrc = resolveImgSrc(cert.preview_url)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gray-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                {cert.cert_number}
              </span>
              <h3 className="text-base font-bold text-gray-900">{cert.recipient_name}</h3>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {cert.recipient_email || 'No email specified'} {cert.registration_number ? `· Reg: ${cert.registration_number}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {previewSrc && (
              <a
                href={previewSrc}
                download={`${cert.cert_number || 'certificate'}.png`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition"
              >
                <DownloadIcon className="w-3.5 h-3.5" /> Download
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              title="Close modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Certificate Display Canvas */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100/70 flex items-center justify-center">
          {previewSrc ? (
            <img
              src={previewSrc}
              alt={`Certificate ${cert.cert_number}`}
              className="max-h-[70vh] w-auto max-w-full rounded-xl shadow-lg border border-gray-200 bg-white object-contain"
            />
          ) : (
            <div className="text-center py-16 text-gray-400">Certificate preview not found</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — Upload Certificate Template
// ─────────────────────────────────────────────────────────────────────────────
function Step1({ initialTemplateUrl, onComplete }) {
  const addToast = useToastStore((s) => s.addToast)
  const [file, setFile] = useState(null)
  const [blobUrl, setBlobUrl] = useState(null)
  const [uploading, setUploading] = useState(false)

  const handleFileChange = (f) => {
    if (!f) return
    setFile(f)
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    setBlobUrl(URL.createObjectURL(f))
  }

  const upload = async () => {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await axiosInstance.post('/faculty/template', formData)
      addToast({ type: 'success', message: 'Certificate template uploaded successfully.' })
      onComplete({ templateUrl: data.preview_url, blobUrl })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Template upload failed.'
      addToast({ type: 'error', message: msg })
    } finally {
      setUploading(false)
    }
  }

  const displayUrl = blobUrl || resolveImgSrc(initialTemplateUrl)

  return (
    <StepCard
      title="Upload Certificate Template"
      subtitle="Upload a high-quality certificate background image (PNG or JPG). Landscape orientation is recommended."
    >
      <div className="space-y-6">
        <FileUpload
          id="faculty-template-upload"
          accept="image/png,image/jpeg,image/webp"
          maxSizeMB={15}
          label="Drop your certificate template here, or browse"
          hint="PNG or JPG up to 15 MB. Orientation will be preserved."
          onFileChange={handleFileChange}
        />

        {displayUrl && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Template Preview</p>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-2 max-w-2xl">
              <img
                src={displayUrl}
                alt="Template preview"
                className="w-full rounded-lg object-contain max-h-80"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            id="faculty-step1-next"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            onClick={file ? upload : () => onComplete({ templateUrl: initialTemplateUrl, blobUrl: null })}
            disabled={uploading || (!file && !initialTemplateUrl)}
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" label="" /> Uploading…
              </span>
            ) : 'Next: Upload Excel →'}
          </button>
        </div>
      </div>
    </StepCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — Upload Excel + Select Columns
// ─────────────────────────────────────────────────────────────────────────────
function Step2({ initialState, onBack, onComplete }) {
  const addToast = useToastStore((s) => s.addToast)
  const [headers, setHeaders] = useState(initialState?.headers || [])
  const [rowCount, setRowCount] = useState(initialState?.rowCount || 0)
  const [selectedCols, setSelectedCols] = useState(initialState?.selectedColumns || [])
  const [emailCol, setEmailCol] = useState(initialState?.emailColumn || '')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleFile = async (f) => {
    if (!f) return
    setParsing(true)
    try {
      const fd = new FormData()
      fd.append('file', f)
      const { data } = await axiosInstance.post('/faculty/excel', fd)
      setHeaders(data.headers || [])
      setRowCount(data.row_count || 0)
      setSelectedCols(data.headers || [])
      setEmailCol(data.email_column || '')
      addToast({ type: 'success', message: `Parsed ${data.row_count} participants from Excel.` })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to parse Excel file.'
      addToast({ type: 'error', message: msg })
    } finally {
      setParsing(false)
    }
  }

  const toggleCol = (col) => {
    setSelectedCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    )
  }

  const saveConfig = async () => {
    if (selectedCols.length === 0) {
      addToast({ type: 'warning', message: 'Select at least one column to print.' })
      return
    }
    setSaving(true)
    try {
      await axiosInstance.post('/faculty/config', {
        selected_columns: selectedCols,
        email_column: emailCol || null,
      })
      onComplete({ headers, rowCount, selectedColumns: selectedCols, emailColumn: emailCol })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to save configuration.'
      addToast({ type: 'error', message: msg })
    } finally {
      setSaving(false)
    }
  }

  return (
    <StepCard
      title="Upload Participant Excel"
      subtitle="Upload an XLSX file containing your participants' details. Select which columns will be placed on the certificate."
    >
      <div className="space-y-6">
        <FileUpload
          id="faculty-excel-upload"
          accept=".xlsx,.xls"
          maxSizeMB={20}
          label="Drop your participants Excel file (.xlsx) here"
          hint="XLSX format up to 20 MB."
          onFileChange={handleFile}
        />

        {parsing && (
          <div className="flex items-center gap-2 text-indigo-600 text-sm font-medium">
            <LoadingSpinner size="sm" label="" /> Reading spreadsheet columns…
          </div>
        )}

        {headers.length > 0 && (
          <div className="space-y-6 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  Select Columns to Print on Certificate
                </p>
                <p className="text-xs text-gray-400">
                  Found {rowCount} data rows · {selectedCols.length} of {headers.length} selected
                </p>
              </div>
              <button
                type="button"
                className="text-xs text-indigo-600 hover:underline font-semibold"
                onClick={() => setSelectedCols(selectedCols.length === headers.length ? [] : [...headers])}
              >
                {selectedCols.length === headers.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {headers.map((col) => {
                const checked = selectedCols.includes(col)
                return (
                  <label
                    key={col}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium cursor-pointer transition-all ${
                      checked
                        ? 'border-indigo-500 bg-indigo-50/60 text-indigo-900 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={checked}
                      onChange={() => toggleCol(col)}
                    />
                    <span className="truncate" title={col}>{col}</span>
                  </label>
                )
              })}
            </div>

            <div className="pt-2">
              <label htmlFor="faculty-email-col" className="block text-sm font-semibold text-gray-800 mb-1">
                Participant Email Column (Optional)
              </label>
              <select
                id="faculty-email-col"
                className="form-input w-full max-w-sm rounded-xl border-gray-200 text-sm"
                value={emailCol}
                onChange={(e) => setEmailCol(e.target.value)}
              >
                <option value="">— No email column (skip emailing) —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Required only if you want to email certificates directly to participants.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <button
            className="px-5 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={onBack}
          >
            ← Back
          </button>
          <button
            id="faculty-step2-next"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            onClick={saveConfig}
            disabled={saving || selectedCols.length === 0}
          >
            {saving ? 'Saving…' : 'Save & Position Fields →'}
          </button>
        </div>
      </div>
    </StepCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — Position Fields
// ─────────────────────────────────────────────────────────────────────────────
const TAG_COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706',
  '#dc2626', '#7c3aed', '#db2777', '#2563eb',
]

function PositionTag({ label, x, y, color, fontSize, isActive, onSelect }) {
  const displaySize = Math.max(10, Math.min(36, Number(fontSize || 24) * 0.45))
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer select-none"
      style={{ left: `${x}%`, top: `${y}%`, zIndex: 10 }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.()
      }}
    >
      <div
        className={`rounded-md px-2 py-1 shadow-md border border-white/40 text-white font-semibold whitespace-nowrap transition-transform ${
          isActive ? 'scale-110 ring-2 ring-white/90' : 'scale-100'
        }`}
        style={{ background: color, fontSize: `${displaySize}px`, lineHeight: 1.1 }}
      >
        {label}
      </div>
    </div>
  )
}

function Step3({ templateUrl, templateBlobUrl, selectedColumns, initialPositions, onBack, onComplete }) {
  const addToast = useToastStore((s) => s.addToast)
  const canvasRef = useRef(null)
  const [positions, setPositions] = useState(() => {
    const init = {}
    selectedColumns.forEach((col, idx) => {
      init[col] = initialPositions[col] || {
        x_percent: 50,
        y_percent: 40 + idx * 8,
        font_size: 24,
      }
    })
    return init
  })
  const [activeCol, setActiveCol] = useState(selectedColumns[0] || null)
  const [saving, setSaving] = useState(false)

  const colColor = (col) => {
    const idx = selectedColumns.indexOf(col)
    return TAG_COLORS[idx % TAG_COLORS.length]
  }

  const handleCanvasClick = useCallback(
    (e) => {
      if (!activeCol || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))

      setPositions((prev) => ({
        ...prev,
        [activeCol]: {
          ...(prev[activeCol] || { font_size: 24 }),
          x_percent: Math.round(x * 100) / 100,
          y_percent: Math.round(y * 100) / 100,
        },
      }))
    },
    [activeCol]
  )

  const updateProp = (col, prop, val) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    setPositions((prev) => ({
      ...prev,
      [col]: {
        ...(prev[col] || { x_percent: 50, y_percent: 50, font_size: 24 }),
        [prop]: num,
      },
    }))
  }

  const savePositions = async () => {
    setSaving(true)
    try {
      const payload = {
        column_positions: positions,
        display_width: 580.0,
        confirmed: true,
      }
      await axiosInstance.post('/faculty/field-positions', payload)
      onComplete({ positions })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to save field positions.'
      addToast({ type: 'error', message: msg })
    } finally {
      setSaving(false)
    }
  }

  const bgSrc = templateBlobUrl || resolveImgSrc(templateUrl)

  return (
    <StepCard
      title="Position Certificate Fields"
      subtitle="Click anywhere on the certificate canvas to place the active field. Fine-tune coordinates and font size on the right."
    >
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Certificate Canvas */}
        <div className="flex-1 w-full min-w-0">
          <p className="text-xs text-gray-500 mb-2">
            Active field: <strong className="text-indigo-600">{activeCol}</strong> — click canvas to position
          </p>
          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="relative w-full rounded-2xl overflow-hidden border border-gray-200 shadow-sm cursor-crosshair bg-gray-100 select-none"
          >
            {bgSrc ? (
              <img
                src={bgSrc}
                alt="Certificate template"
                className="w-full h-auto block object-contain"
                draggable={false}
              />
            ) : (
              <div className="h-72 flex items-center justify-center text-gray-400">Template not loaded</div>
            )}

            {selectedColumns.map((col) => {
              const pos = positions[col]
              if (!pos) return null
              return (
                <PositionTag
                  key={col}
                  label={col}
                  x={pos.x_percent}
                  y={pos.y_percent}
                  fontSize={pos.font_size}
                  color={colColor(col)}
                  isActive={activeCol === col}
                  onSelect={() => setActiveCol(col)}
                />
              )
            })}
          </div>
        </div>

        {/* Controls Panel */}
        <div className="w-full lg:w-72 space-y-3 shrink-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Field Controls</p>
          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {selectedColumns.map((col) => {
              const pos = positions[col] || { x_percent: 50, y_percent: 50, font_size: 24 }
              const color = colColor(col)
              const isActive = activeCol === col
              return (
                <div
                  key={col}
                  onClick={() => setActiveCol(col)}
                  className={`rounded-xl border-2 p-3 cursor-pointer transition-all text-sm ${
                    isActive ? 'shadow-md ring-1 ring-indigo-500' : 'border-gray-100 hover:border-gray-300'
                  }`}
                  style={isActive ? { borderColor: color, background: color + '0d' } : {}}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                    <span className="font-semibold text-gray-800 truncate" title={col}>{col}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5">X %</p>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        className="w-full rounded border border-gray-200 px-1 py-1 text-xs text-center"
                        value={pos.x_percent ?? 50}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateProp(col, 'x_percent', e.target.value)}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5">Y %</p>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        className="w-full rounded border border-gray-200 px-1 py-1 text-xs text-center"
                        value={pos.y_percent ?? 50}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateProp(col, 'y_percent', e.target.value)}
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 mb-0.5">Font px</p>
                      <input
                        type="number"
                        min={8}
                        max={120}
                        step={1}
                        className="w-full rounded border border-gray-200 px-1 py-1 text-xs text-center"
                        value={pos.font_size ?? 24}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateProp(col, 'font_size', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
        <button
          className="px-5 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          onClick={onBack}
        >
          ← Back
        </button>
        <button
          id="faculty-step3-next"
          className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
          onClick={savePositions}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Positions & Review Sample →'}
        </button>
      </div>
    </StepCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 4 — Review Sample (Exact uploaded orientation preserved)
// ─────────────────────────────────────────────────────────────────────────────
function Step4Sample({ onBack, onComplete }) {
  const addToast = useToastStore((s) => s.addToast)
  const [loading, setLoading] = useState(false)
  const [sample, setSample] = useState(null)

  const fetchSample = async () => {
    setLoading(true)
    setSample(null)
    try {
      const { data } = await axiosInstance.post('/faculty/sample-preview')
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
      subtitle="This preview renders using the first row of your Excel data. The orientation stays identical to the uploaded template."
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Sample Certificate</p>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-2">
              {loading ? (
                <div className="flex h-64 items-center justify-center">
                  <LoadingSpinner label="Generating sample certificate..." />
                </div>
              ) : sampleSrc ? (
                <img
                  key={sample?._previewTs || 'sample'}
                  src={sampleSrc}
                  alt="Sample certificate preview"
                  className="w-full rounded-lg object-contain max-h-[380px]"
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-sm text-gray-400">No sample preview available</div>
              )}
            </div>
            <button
              className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
              onClick={fetchSample}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : '🔄 Refresh Sample'}
            </button>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">First Row Sample Data</p>
            <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
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
            className="px-5 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
            onClick={onBack}
          >
            ← Back to Field Positioning
          </button>
          <button
            id="faculty-step4-next"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            onClick={onComplete}
            disabled={!sampleSrc || loading}
          >
            Looks Good, Continue to Generate →
          </button>
        </div>
      </div>
    </StepCard>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — Generate Certificates + Generated List with Eye View Option
// ─────────────────────────────────────────────────────────────────────────────
function Step5({
  rowCount,
  emailColumn,
  allocatePoints,
  pointsPerCert,
  onAllocatePointsChange,
  onPointsChange,
  generatedCertificates,
  onCertificatesUpdated,
  onComplete,
  onBack,
}) {
  const addToast = useToastStore((s) => s.addToast)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [creditRules, setCreditRules] = useState([])
  const [selectedRuleId, setSelectedRuleId] = useState('')
  const [viewingCert, setViewingCert] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    let mounted = true
    axiosInstance.get('/faculty/credit-rules').then((res) => {
      if (mounted && Array.isArray(res.data)) {
        setCreditRules(res.data)
        if (pointsPerCert > 0) {
          const match = res.data.find((r) => r.points === pointsPerCert)
          if (match) setSelectedRuleId(match.id)
        }
      }
    }).catch(() => {})
    return () => { mounted = false }
  }, [pointsPerCert])

  const generate = async () => {
    setGenerating(true)
    setResult(null)
    try {
      const payload = {
        allocate_points: !!allocatePoints,
        points_per_cert: allocatePoints ? Number(pointsPerCert || 0) : 0,
      }
      const { data } = await axiosInstance.post('/faculty/generate', payload)
      setResult(data)
      if (data.certificates && onCertificatesUpdated) {
        onCertificatesUpdated(data.certificates)
      }
      if (data.generated > 0) {
        addToast({ type: 'success', message: `${data.generated} certificate(s) generated successfully!` })
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Generation failed.'
      addToast({ type: 'error', message: msg })
      setResult({ generated: 0, errors: [msg] })
    } finally {
      setGenerating(false)
    }
  }

  const certsList = result?.certificates || generatedCertificates || []

  const filteredCerts = certsList.filter((c) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      (c.recipient_name && c.recipient_name.toLowerCase().includes(term)) ||
      (c.cert_number && c.cert_number.toLowerCase().includes(term)) ||
      (c.recipient_email && c.recipient_email.toLowerCase().includes(term)) ||
      (c.registration_number && c.registration_number.toLowerCase().includes(term))
    )
  })

  return (
    <>
      <StepCard
        title="Generate Certificates"
        subtitle={`Generate certificates for all ${rowCount} participant(s). You can view all generated certificates right here.`}
      >
        <div className="space-y-6">
          {/* Optional Credit Points Box */}
          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Include Student Credit Points (Optional)</p>
                <p className="text-xs text-gray-500">Assign institutional credit points to participants when certificates are emailed.</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={!!allocatePoints}
                  onChange={(e) => {
                    const checked = e.target.checked
                    onAllocatePointsChange(checked)
                    if (!checked) {
                      onPointsChange(0)
                      setSelectedRuleId('')
                    } else if (creditRules.length > 0 && !selectedRuleId) {
                      setSelectedRuleId(creditRules[0].id)
                      onPointsChange(creditRules[0].points)
                    }
                  }}
                  disabled={!emailColumn}
                />
                Include credit points
              </label>
            </div>

            {allocatePoints && emailColumn && (
              <div className="mt-4 p-3.5 bg-indigo-50/80 rounded-xl border border-indigo-100 space-y-2">
                <label className="block text-xs font-semibold text-indigo-900" htmlFor="faculty-credit-rule-select">
                  Choose preset activity rule:
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <select
                    id="faculty-credit-rule-select"
                    className="form-input flex-1 bg-white border-indigo-200 text-sm"
                    value={selectedRuleId}
                    onChange={(e) => {
                      const id = e.target.value
                      setSelectedRuleId(id)
                      const rule = creditRules.find((r) => r.id === id)
                      if (rule) onPointsChange(rule.points)
                    }}
                  >
                    <option value="">— Select Activity Preset —</option>
                    {creditRules.map((rule) => (
                      <option key={rule.id} value={rule.id}>
                        {rule.cert_type} ({rule.points} {rule.points === 1 ? 'Point' : 'Points'})
                      </option>
                    ))}
                  </select>
                  {pointsPerCert > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shrink-0">
                      <span>+{pointsPerCert} Points</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action Card / Status */}
          <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            {generating ? (
              <div className="flex flex-col items-center gap-3">
                <LoadingSpinner size="lg" label="Generating certificates with Pillow…" />
                <p className="text-xs text-gray-400">Rendering high-resolution PNGs...</p>
              </div>
            ) : certsList.length > 0 ? (
              <div className="text-center space-y-2">
                <div className="text-5xl font-black text-emerald-600">
                  {certsList.length}
                </div>
                <p className="text-sm font-semibold text-gray-700">
                  Certificate(s) generated successfully
                </p>
                {result?.errors?.length > 0 && (
                  <p className="text-xs text-amber-600">{result.errors.length} error(s) occurred</p>
                )}
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto text-2xl font-bold">
                  ⚡
                </div>
                <p className="text-sm text-gray-700">
                  Ready to generate <strong>{rowCount}</strong> certificate(s)
                </p>
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              REQUIREMENT 1: List of all generated certificates with Eye View Option
              ───────────────────────────────────────────────────────────── */}
          {certsList.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Generated Certificates</h3>
                  <p className="text-xs text-gray-500">
                    Click the <strong className="text-indigo-600">eye icon</strong> on any row to preview the certificate.
                  </p>
                </div>
                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Search by name, cert no..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="form-input w-full text-xs rounded-xl border-gray-200"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Cert Number</th>
                      <th className="px-4 py-3">Recipient Name</th>
                      <th className="px-4 py-3">Email / Reg No</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">View / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCerts.map((c, idx) => (
                      <tr key={c.cert_number || idx} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-700">
                          {c.cert_number}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {c.recipient_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          <div>{c.recipient_email || '—'}</div>
                          {c.registration_number && (
                            <div className="text-[11px] text-gray-400 font-mono">Reg: {c.registration_number}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            c.status === 'emailed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {c.status || 'generated'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingCert(c)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition shadow-xs cursor-pointer"
                              title="View certificate"
                            >
                              <EyeIcon className="w-4 h-4" /> View
                            </button>
                            {c.preview_url && (
                              <a
                                href={resolveImgSrc(c.preview_url)}
                                download={`${c.cert_number}.png`}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                                title="Download PNG"
                              >
                                <DownloadIcon className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredCerts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-xs">
                          {searchTerm ? 'No certificates matching your search.' : 'No certificates available.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              className="px-5 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={onBack}
            >
              ← Back
            </button>
            <div className="flex items-center gap-3">
              <button
                id="faculty-generate-btn"
                className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                onClick={generate}
                disabled={generating}
              >
                {generating ? 'Generating…' : certsList.length > 0 ? '⚡ Re-generate Certificates' : '⚡ Generate Certificates'}
              </button>
              {certsList.length > 0 && (
                <button
                  id="faculty-step5-next"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
                  onClick={() => onComplete({ generated: certsList.length })}
                >
                  Continue to Send & Download →
                </button>
              )}
            </div>
          </div>
        </div>
      </StepCard>

      {/* Certificate Viewer Modal */}
      {viewingCert && (
        <CertificateViewModal
          cert={viewingCert}
          onClose={() => setViewingCert(null)}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 6 — Send & Download (with Certificate List and Eye View)
// ─────────────────────────────────────────────────────────────────────────────
function Step6({
  generatedCount,
  emailColumn,
  emailStatuses,
  emailCounts,
  generatedCertificates,
  onEmailStatusUpdate,
  onBack,
}) {
  const addToast = useToastStore((s) => s.addToast)
  const [sending, setSending] = useState(false)
  const [downloadingZip, setDownloadingZip] = useState(false)
  const [viewingCert, setViewingCert] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const sendEmails = async (rowIndexes) => {
    setSending(true)
    try {
      const payload = rowIndexes?.length ? { row_indexes: rowIndexes } : undefined
      const { data } = await axiosInstance.post('/faculty/send-emails', payload)
      onEmailStatusUpdate?.(data)
      addToast({
        type: data.failed === 0 ? 'success' : 'warning',
        message: data.message || `Sent ${data.sent} email(s).`,
      })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to dispatch emails.'
      addToast({ type: 'error', message: msg })
    } finally {
      setSending(false)
    }
  }

  const downloadZip = async () => {
    setDownloadingZip(true)
    try {
      const res = await axiosInstance.get('/faculty/zip', { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'faculty_certificates.zip'
      a.click()
      URL.revokeObjectURL(url)
      addToast({ type: 'success', message: 'ZIP download started.' })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'ZIP download failed.'
      addToast({ type: 'error', message: msg })
    } finally {
      setDownloadingZip(false)
    }
  }

  const certsList = generatedCertificates || []

  const filteredCerts = certsList.filter((c) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return (
      (c.recipient_name && c.recipient_name.toLowerCase().includes(term)) ||
      (c.cert_number && c.cert_number.toLowerCase().includes(term)) ||
      (c.recipient_email && c.recipient_email.toLowerCase().includes(term))
    )
  })

  return (
    <>
      <StepCard
        title="Send & Download Certificates"
        subtitle="Download all generated certificates as a single ZIP archive, or dispatch them directly to student emails."
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Download ZIP Card */}
            <div className="p-5 rounded-2xl border border-gray-200 bg-white flex flex-col justify-between space-y-4 shadow-xs">
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  <DownloadIcon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-gray-900">Download All Certificates</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Download all {generatedCount} certificate PNG files packaged in a single ZIP file.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadZip}
                disabled={downloadingZip}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
              >
                {downloadingZip ? 'Preparing ZIP…' : '📦 Download ZIP Package'}
              </button>
            </div>

            {/* Email Dispatch Card */}
            <div className="p-5 rounded-2xl border border-gray-200 bg-white flex flex-col justify-between space-y-4 shadow-xs">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <MailIcon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-gray-900">Email Certificates</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {emailColumn
                    ? `Dispatches certificates directly to recipient emails in column '${emailColumn}'.`
                    : 'No email column detected in the uploaded Excel.'}
                </p>
              </div>
              {emailColumn ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => sendEmails()}
                    disabled={sending}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    {sending ? 'Sending…' : '✉️ Send All Emails'}
                  </button>
                  {emailCounts?.failed > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const failedIdxs = (emailStatuses || [])
                          .filter((e) => e.status === 'failed')
                          .map((e) => e.row_index)
                        sendEmails(failedIdxs)
                      }}
                      disabled={sending}
                      className="px-3 py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 disabled:opacity-50 transition cursor-pointer"
                      title="Retry failed emails"
                    >
                      Retry Failed ({emailCounts.failed})
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  Email sending is disabled because no email column was selected.
                </div>
              )}
            </div>
          </div>

          {/* Certificates Table with View Eye Icon */}
          {certsList.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Certificate Status & Verification</h3>
                  <p className="text-xs text-gray-500">
                    Preview each certificate or check email delivery status.
                  </p>
                </div>
                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Search certificates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="form-input w-full text-xs rounded-xl border-gray-200"
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Cert Number</th>
                      <th className="px-4 py-3">Recipient Name</th>
                      <th className="px-4 py-3">Email Address</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">View / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCerts.map((c, idx) => {
                      const emailEntry = (emailStatuses || [])[c.index ?? idx]
                      const currentStatus = emailEntry?.status || c.status || 'generated'
                      return (
                        <tr key={c.cert_number || idx} className="hover:bg-indigo-50/20 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-700">
                            {c.cert_number}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {c.recipient_name || '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {c.recipient_email || '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              currentStatus === 'emailed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : currentStatus === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {currentStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingCert(c)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition shadow-xs cursor-pointer"
                                title="View certificate"
                              >
                                <EyeIcon className="w-4 h-4" /> View
                              </button>
                              {c.preview_url && (
                                <a
                                  href={resolveImgSrc(c.preview_url)}
                                  download={`${c.cert_number}.png`}
                                  className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                                  title="Download PNG"
                                >
                                  <DownloadIcon className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {emailColumn && currentStatus !== 'emailed' && (
                                <button
                                  type="button"
                                  onClick={() => sendEmails([c.index ?? idx])}
                                  disabled={sending}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition"
                                  title="Send individual email"
                                >
                                  Email
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-start pt-4 border-t border-gray-100">
            <button
              className="px-5 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={onBack}
            >
              ← Back to Generation
            </button>
          </div>
        </div>
      </StepCard>

      {/* Certificate Viewer Modal */}
      {viewingCert && (
        <CertificateViewModal
          cert={viewingCert}
          onClose={() => setViewingCert(null)}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root FacultyWizard Component
// ─────────────────────────────────────────────────────────────────────────────
export default function FacultyWizard({ eventName }) {
  const [step, setStep] = useState(1)
  const [templateUrl, setTemplateUrl] = useState(null)
  const [templateBlob, setTemplateBlob] = useState(null)
  const [excelState, setExcelState] = useState(null)
  const [fieldPositions, setFieldPositions] = useState(null)
  const [generatedCount, setGeneratedCount] = useState(0)
  const [generatedCertificates, setGeneratedCertificates] = useState([])
  const [allocatePoints, setAllocatePoints] = useState(false)
  const [pointsPerCert, setPointsPerCert] = useState(0)
  const [emailStatuses, setEmailStatuses] = useState([])
  const [emailCounts, setEmailCounts] = useState(null)
  const [isRestoring, setIsRestoring] = useState(true)

  const deriveCounts = (statuses) => {
    const s = statuses || []
    return {
      sent: s.filter((e) => e.status === 'emailed').length,
      failed: s.filter((e) => e.status === 'failed').length,
      pending: s.filter((e) => e.status !== 'emailed' && e.status !== 'failed').length,
      total: s.length,
    }
  }

  useEffect(() => {
    let mounted = true
    const restoreProgress = async () => {
      try {
        const { data } = await axiosInstance.get('/faculty/status')
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
        if (data.step4_complete) {
          setGeneratedCount(data.generated_count || 0)
        }
        if (Array.isArray(data.certificates)) {
          setGeneratedCertificates(data.certificates)
        }
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
        <LoadingSpinner label="Restoring faculty session progress..." />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <StepIndicator current={step} />

      {step === 1 && (
        <Step1
          initialTemplateUrl={templateUrl}
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
          onComplete={(data) => {
            setExcelState(data)
            setStep(3)
          }}
        />
      )}

      {step === 3 && (
        <Step3
          templateUrl={templateUrl}
          templateBlobUrl={templateBlob}
          selectedColumns={excelState?.selectedColumns || []}
          initialPositions={fieldPositions?.positions || {}}
          onBack={() => setStep(2)}
          onComplete={(data) => {
            setFieldPositions(data)
            setStep(4)
          }}
        />
      )}

      {step === 4 && (
        <Step4Sample
          onBack={() => setStep(3)}
          onComplete={() => setStep(5)}
        />
      )}

      {step === 5 && (
        <Step5
          rowCount={excelState?.rowCount || 0}
          emailColumn={excelState?.emailColumn}
          allocatePoints={allocatePoints}
          pointsPerCert={pointsPerCert}
          onAllocatePointsChange={setAllocatePoints}
          onPointsChange={setPointsPerCert}
          generatedCertificates={generatedCertificates}
          onCertificatesUpdated={setGeneratedCertificates}
          onComplete={({ generated }) => {
            setGeneratedCount(generated)
            setStep(6)
          }}
          onBack={() => setStep(4)}
        />
      )}

      {step === 6 && (
        <Step6
          generatedCount={generatedCount}
          emailColumn={excelState?.emailColumn}
          emailStatuses={emailStatuses}
          emailCounts={emailCounts}
          generatedCertificates={generatedCertificates}
          onEmailStatusUpdate={handleEmailStatusUpdate}
          onBack={() => setStep(5)}
        />
      )}
    </div>
  )
}
