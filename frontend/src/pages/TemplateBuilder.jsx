import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import LoadingSpinner from '../components/LoadingSpinner'
import { useCreateTemplate } from '../api/templates'

// ── Constants ─────────────────────────────────────────────────────────────────

const FONT_FAMILIES = [
  { label: 'Playfair Display', value: 'Playfair Display, serif' },
  { label: 'Montserrat',       value: 'Montserrat, sans-serif' },
  { label: 'EB Garamond',      value: 'EB Garamond, serif' },
  { label: 'Raleway',          value: 'Raleway, sans-serif' },
  { label: 'Dancing Script',   value: 'Dancing Script, cursive' },
]

const CERT_TYPES = [
  'participant', 'coordinator', 'winner_1st', 'winner_2nd',
  'winner_3rd', 'mentor', 'judge', 'volunteer',
]

const BG_TYPES = [
  { value: 'solid',     label: 'Solid Color' },
  { value: 'gradient',  label: 'Gradient' },
  { value: 'decorated', label: 'Decorated Border' },
  { value: 'minimalist',label: 'Minimalist White' },
]

// A4 at 96dpi
const A4_W = 794
const A4_H = 1123

// ── Small reusable helpers ─────────────────────────────────────────────────────

function SectionHeading({ children }) {
  return (
    <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">
      {children}
    </h3>
  )
}

function ColorInput({ label, value, onChange, id }) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="text-sm text-gray-600 w-24 shrink-0">{label}</label>
      <div className="flex items-center gap-2 flex-1">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded border border-gray-200 p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="form-input font-mono text-xs py-1"
          placeholder="#FFFFFF"
          maxLength={7}
        />
      </div>
    </div>
  )
}

// ── A4 live preview ───────────────────────────────────────────────────────────

function A4Preview({ name, certType, background, typography, elements, previewWidth }) {
  const scale = previewWidth / A4_W

  // Build background style
  let bgStyle = {}
  if (background.type === 'minimalist') {
    bgStyle = { backgroundColor: '#FFFFFF' }
  } else if (background.type === 'gradient' && background.colors?.length >= 2) {
    bgStyle = { background: `linear-gradient(135deg, ${background.colors[0]}, ${background.colors[1]})` }
  } else {
    bgStyle = { backgroundColor: background.colors?.[0] ?? '#FFFFFF' }
  }

  // Decorated border overlay
  const showBorder = background.type === 'decorated'

  return (
    <div
      className="relative overflow-hidden shadow-lg"
      style={{ width: previewWidth, height: A4_H * scale, ...bgStyle }}
    >
      {/* Decorated border */}
      {showBorder && (
        <>
          <div className="absolute inset-0 border-[12px] border-double"
               style={{ borderColor: background.colors?.[0] ?? '#1E3A5F', margin: 16 * scale }} />
          <div className="absolute inset-0 border"
               style={{ borderColor: background.colors?.[0] ?? '#1E3A5F', margin: 24 * scale }} />
        </>
      )}

      {/* Fixed zones */}
      {/* Logo */}
      <div className="absolute border-2 border-dashed border-blue-300/60 rounded flex items-center justify-center"
           style={{ left: 40 * scale, top: 40 * scale, width: 90 * scale, height: 90 * scale }}>
        <span className="text-blue-300 select-none" style={{ fontSize: 9 * scale }}>LOGO</span>
      </div>

      {/* QR */}
      <div className="absolute border-2 border-dashed border-purple-300/60 rounded flex items-center justify-center"
           style={{ right: 40 * scale, bottom: 40 * scale, width: 72 * scale, height: 72 * scale }}>
        <span className="text-purple-300 select-none" style={{ fontSize: 9 * scale }}>QR</span>
      </div>

      {/* Signature */}
      <div className="absolute border-2 border-dashed border-orange-300/60 rounded flex items-center justify-center"
           style={{ left: 40 * scale, bottom: 40 * scale, width: 150 * scale, height: 50 * scale }}>
        <span className="text-orange-300 select-none" style={{ fontSize: 9 * scale }}>SIGNATURE</span>
      </div>

      {/* Elements */}
      {elements.map((el, i) => {
        const pos = el.position ?? {
          x: A4_W / 2 - 150,
          y: 200 + i * 60,
          width: 300,
          height: 40,
        }

        if (el.kind === 'divider') {
          return (
            <div
              key={el.id}
              className="absolute"
              style={{
                left: pos.x * scale,
                top: pos.y * scale,
                width: pos.width * scale,
                height: 2 * scale,
                backgroundColor: typography.font_color ?? '#1E3A5F',
                opacity: 0.3,
              }}
            />
          )
        }

        const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' }

        return (
          <div
            key={el.id}
            className="absolute flex items-center"
            style={{
              left: pos.x * scale,
              top: pos.y * scale,
              width: pos.width * scale,
              minHeight: pos.height * scale,
              justifyContent: alignMap[el.alignment ?? 'center'],
            }}
          >
            <span
              style={{
                fontFamily: typography.font_family,
                color: typography.font_color ?? '#1E3A5F',
                fontSize: (el.font_size ?? 16) * scale,
                fontWeight: el.font_weight === 'bold' ? 700 : el.font_weight === 'semibold' ? 600 : 400,
                textAlign: el.alignment ?? 'center',
              }}
            >
              {el.kind === 'static'
                ? (el.text || 'Static Text')
                : `[${el.label || 'Field'}]`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Element row in the left panel ─────────────────────────────────────────────

function ElementRow({ el, onChange, onDelete }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
      {/* Kind indicator */}
      <div className="flex items-center justify-between">
        <span className={`
          text-xs font-semibold uppercase tracking-wide rounded px-1.5 py-0.5
          ${el.kind === 'static'  ? 'bg-blue-100 text-blue-700'   :
            el.kind === 'dynamic' ? 'bg-green-100 text-green-700' :
                                    'bg-gray-200 text-gray-600'}
        `}>
          {el.kind}
        </span>
        <button
          onClick={() => onDelete(el.id)}
          className="text-red-400 hover:text-red-600 transition-colors"
          aria-label="Remove element"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {el.kind === 'divider' ? (
        <p className="text-xs text-gray-400 italic">Horizontal divider line</p>
      ) : (
        <>
          {/* Text / label input */}
          <input
            type="text"
            className="form-input text-sm py-1"
            placeholder={el.kind === 'static' ? 'Enter text…' : 'Field slot name (e.g. student_name)'}
            value={el.kind === 'static' ? (el.text ?? '') : (el.label ?? '')}
            onChange={(e) =>
              onChange(el.id, el.kind === 'static' ? { text: e.target.value } : { label: e.target.value })
            }
          />

          {/* Font size + weight + alignment */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-gray-400 mb-0.5 block">Size</label>
              <input
                type="number"
                min={8} max={72}
                className="form-input text-xs py-1"
                value={el.font_size ?? 16}
                onChange={(e) => onChange(el.id, { font_size: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 mb-0.5 block">Weight</label>
              <select
                className="form-input text-xs py-1"
                value={el.font_weight ?? 'normal'}
                onChange={(e) => onChange(el.id, { font_weight: e.target.value })}
              >
                <option value="normal">Normal</option>
                <option value="semibold">Semibold</option>
                <option value="bold">Bold</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 mb-0.5 block">Align</label>
              <select
                className="form-input text-xs py-1"
                value={el.alignment ?? 'center'}
                onChange={(e) => onChange(el.id, { alignment: e.target.value })}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── TemplateBuilder ───────────────────────────────────────────────────────────

let _elId = 0
const newElId = () => `el-${++_elId}`

export default function TemplateBuilder() {
  const { club_id } = useParams()
  const navigate    = useNavigate()
  const createTemplate = useCreateTemplate(club_id)

  // ── Form state ──────────────────────────────────────────────────────────
  const [name,      setName]      = useState('')
  const [certType,  setCertType]  = useState('participant')
  const [bgType,    setBgType]    = useState('solid')
  const [bgColor1,  setBgColor1]  = useState('#FFFFFF')
  const [bgColor2,  setBgColor2]  = useState('#EEF2FF')
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0].value)
  const [fontColor,  setFontColor]  = useState('#1E3A5F')
  const [elements,   setElements]   = useState([])

  // Preview panel ref for width calculation
  const previewPanelRef = useRef(null)
  const [previewWidth, setPreviewWidth] = useState(400)

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPreviewWidth(Math.floor(entry.contentRect.width) - 48)
      }
    })
    if (previewPanelRef.current) observer.observe(previewPanelRef.current)
    return () => observer.disconnect()
  }, [])

  // ── Element helpers ─────────────────────────────────────────────────────
  const addElement = (kind) => {
    const defaults = {
      static:  { kind: 'static',  text: '',   font_size: 18, font_weight: 'normal',   alignment: 'center' },
      dynamic: { kind: 'dynamic', label: '',  font_size: 22, font_weight: 'semibold', alignment: 'center' },
      divider: { kind: 'divider',             font_size: 2,  font_weight: 'normal',   alignment: 'center' },
    }
    setElements((prev) => [...prev, { id: newElId(), ...defaults[kind] }])
  }

  const updateElement = useCallback((id, patch) => {
    setElements((prev) => prev.map((el) => el.id === id ? { ...el, ...patch } : el))
  }, [])

  const deleteElement = useCallback((id) => {
    setElements((prev) => prev.filter((el) => el.id !== id))
  }, [])

  // ── Background config ───────────────────────────────────────────────────
  const background = {
    type: bgType,
    colors: bgType === 'gradient' ? [bgColor1, bgColor2] : [bgColor1],
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) return

    const payload = {
      name: name.trim(),
      cert_type: certType,
      background,
      typography: { font_family: fontFamily, font_color: fontColor },
      elements: elements.map(({ id, ...rest }) => rest),   // strip temp id
    }

    await createTemplate.mutateAsync(payload)
    navigate(`/club/${club_id}?tab=templates`)
  }

  const isBusy = createTemplate.isPending
  const canSave = name.trim().length > 0

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex flex-1 overflow-hidden bg-background">
          {/* ── Left controls panel ──────────────────────────────────── */}
          <aside className="flex w-80 shrink-0 flex-col border-r border-gray-200 bg-white overflow-hidden">
            {/* Header */}
            <div className="border-b border-gray-100 px-4 py-4 shrink-0">
              <button
                className="mb-2 flex items-center gap-1.5 text-sm text-gray-400 hover:text-navy transition-colors"
                onClick={() => navigate(-1)}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h1 className="text-base font-bold text-foreground">Template Builder</h1>
              <p className="mt-0.5 text-xs text-gray-500">
                Customize your certificate design. Preview updates live.
              </p>
            </div>

            {/* Scrollable controls */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-hide">

              {/* ── Template name + type ───────────────────────────────── */}
              <div className="space-y-3">
                <SectionHeading>Template Info</SectionHeading>
                <div>
                  <label className="form-label text-xs" htmlFor="tpl-name">Name *</label>
                  <input
                    id="tpl-name"
                    type="text"
                    className="form-input py-1.5"
                    placeholder="e.g. Classic Gold Participant"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label text-xs" htmlFor="tpl-cert-type">Certificate Type</label>
                  <select
                    id="tpl-cert-type"
                    className="form-input py-1.5"
                    value={certType}
                    onChange={(e) => setCertType(e.target.value)}
                  >
                    {CERT_TYPES.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Background ────────────────────────────────────────── */}
              <div className="space-y-3">
                <SectionHeading>Background</SectionHeading>
                <div className="grid grid-cols-2 gap-1.5">
                  {BG_TYPES.map((bt) => (
                    <button
                      key={bt.value}
                      onClick={() => setBgType(bt.value)}
                      className={`
                        rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors text-center
                        ${bgType === bt.value
                          ? 'border-navy bg-navy text-white'
                          : 'border-gray-200 text-gray-600 hover:border-navy/40'}
                      `}
                    >
                      {bt.label}
                    </button>
                  ))}
                </div>
                {bgType !== 'minimalist' && (
                  <div className="space-y-2 mt-2">
                    <ColorInput
                      id="bg-color-1"
                      label={bgType === 'gradient' ? 'Color 1' : 'Color'}
                      value={bgColor1}
                      onChange={setBgColor1}
                    />
                    {bgType === 'gradient' && (
                      <ColorInput
                        id="bg-color-2"
                        label="Color 2"
                        value={bgColor2}
                        onChange={setBgColor2}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* ── Typography ────────────────────────────────────────── */}
              <div className="space-y-3">
                <SectionHeading>Typography</SectionHeading>
                <div>
                  <label className="form-label text-xs" htmlFor="font-family">Font Family</label>
                  <select
                    id="font-family"
                    className="form-input py-1.5"
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <ColorInput
                  id="font-color"
                  label="Font Color"
                  value={fontColor}
                  onChange={setFontColor}
                />
              </div>

              {/* ── Elements ──────────────────────────────────────────── */}
              <div className="space-y-3">
                <SectionHeading>Elements</SectionHeading>
                <div className="flex gap-2 flex-wrap">
                  <button
                    id="add-static-text"
                    className="btn-secondary text-xs py-1.5"
                    onClick={() => addElement('static')}
                  >
                    + Static Text
                  </button>
                  <button
                    id="add-dynamic-field"
                    className="btn-secondary text-xs py-1.5"
                    onClick={() => addElement('dynamic')}
                  >
                    + Dynamic Field
                  </button>
                  <button
                    id="add-divider"
                    className="btn-ghost text-xs py-1.5"
                    onClick={() => addElement('divider')}
                  >
                    + Divider
                  </button>
                </div>

                {elements.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-2">
                    No elements yet. Add text or dynamic field slots above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {elements.map((el) => (
                      <ElementRow
                        key={el.id}
                        el={el}
                        onChange={updateElement}
                        onDelete={deleteElement}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Fixed zones note ──────────────────────────────────── */}
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1">Fixed Zones</p>
                <p className="text-xs text-blue-600 leading-relaxed">
                  Logo, Signature, and QR code zones are always present on the certificate.
                  Their positions are shown on the preview.
                </p>
              </div>
            </div>

            {/* Save button */}
            <div className="border-t border-gray-100 p-4 shrink-0">
              <button
                id="save-template-btn"
                className="btn-primary w-full"
                disabled={!canSave || isBusy}
                onClick={handleSave}
              >
                {isBusy ? (
                  <><LoadingSpinner size="sm" label="" /> Saving…</>
                ) : (
                  'Save Template'
                )}
              </button>
              {!canSave && (
                <p className="mt-1.5 text-center text-xs text-gray-400">
                  Enter a template name to save.
                </p>
              )}
            </div>
          </aside>

          {/* ── Right live preview panel ──────────────────────────────── */}
          <div
            ref={previewPanelRef}
            className="flex-1 overflow-auto bg-gray-100 p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {name || 'Untitled Template'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Live preview · A4 portrait
                </p>
              </div>
              <span className="text-xs text-gray-400">
                Scale {Math.round((previewWidth / A4_W) * 100)}%
              </span>
            </div>

            <div className="flex justify-center">
              <A4Preview
                name={name}
                certType={certType}
                background={background}
                typography={{ font_family: fontFamily, font_color: fontColor }}
                elements={elements}
                previewWidth={Math.max(200, previewWidth)}
              />
            </div>

            {/* Element index below preview */}
            {elements.length > 0 && (
              <div className="mt-6 max-w-lg mx-auto">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  Elements ({elements.length})
                </p>
                <div className="card divide-y divide-gray-50 overflow-hidden">
                  {elements.map((el, i) => (
                    <div key={el.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-xs text-gray-400 w-5 text-center">{i + 1}</span>
                      <span className={`
                        text-xs font-semibold uppercase rounded px-1.5 py-0.5 shrink-0
                        ${el.kind === 'static'  ? 'bg-blue-100 text-blue-700' :
                          el.kind === 'dynamic' ? 'bg-green-100 text-green-700' :
                                                  'bg-gray-200 text-gray-600'}
                      `}>
                        {el.kind}
                      </span>
                      <span className="text-xs text-foreground truncate flex-1">
                        {el.kind === 'static'  ? (el.text  || '—') :
                         el.kind === 'dynamic' ? `[${el.label || 'unnamed'}]` :
                         'Divider'}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{el.font_size}px</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
