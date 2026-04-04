/**
 * TemplateSelector — PNG image template gallery + per-cert-type click-to-place.
 *
 * FLOW per cert_type:
 *  Step 1 – Gallery   : pick a predefined PNG template
 *  Step 2 – Fields    : click on the image to place each Excel column
 *  Step 3 – Assets    : click to place logo & signature (if the event has them)
 *  Confirm            : POST /clubs/.../events/.../field-positions
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import {
  useImageTemplates,
  useAllFieldPositions,
  useSaveFieldPositions,
  useEvent,
} from '../api/events'
import { useParticipants } from '../api/participants'
import LoadingSpinner from '../components/LoadingSpinner'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { BACKEND_URL } from '../utils/axiosInstance'

// ── Helpers ───────────────────────────────────────────────────────────────────
const MARKER_COLORS = [
  '#6366f1','#f59e0b','#10b981','#ef4444',
  '#3b82f6','#8b5cf6','#ec4899','#14b8a6',
]
function certLabel(ct) {
  return ct.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
}
function imgSrc(url) {
  if (!url || url.trim() === '') return null
  if (url.startsWith('http') || url.startsWith('blob:')) return url
  return BACKEND_URL + url
}

// ═════════════════════════════════════════════════════════════════════════════
// Step 1 — Gallery
// ═════════════════════════════════════════════════════════════════════════════
function TemplateCard({ template, selected, onSelect }) {
  const isSel = selected?.id === template.id
  return (
    <button id={`tmpl-card-${template.id}`} onClick={() => onSelect(template)}
      className={`group relative flex flex-col rounded-xl border-2 overflow-hidden text-left transition-all duration-200 shadow-sm
        ${isSel ? 'border-indigo-500 ring-2 ring-indigo-300 shadow-lg' : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'}`}>
      <div className="w-full bg-gray-50 overflow-hidden" style={{ aspectRatio:'210/297' }}>
        {template.preview_url && (
          <img src={imgSrc(template.preview_url)} alt={template.display_name}
            className="w-full h-full object-cover"
            onError={e=>{ e.target.style.display='none' }} />
        )}
        {!template.preview_url && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
            <svg className="h-12 w-12 text-indigo-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="px-3 py-2.5 bg-white border-t border-gray-100 shrink-0">
        <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-indigo-600">{template.display_name}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">{template.filename}</p>
      </div>
      {isSel && (
        <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 shadow-md">
          <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  )
}

function GalleryStep({ certType, existingFilename, onChosen }) {
  const { data: templates, isLoading, error, refetch } = useImageTemplates()
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (templates && existingFilename) {
      const m = templates.find(t => t.filename === existingFilename)
      if (m) setSelected(m)
    }
  }, [templates, existingFilename])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-gray-100 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500 mb-0.5">Step 1 of 3</p>
        <h3 className="text-base font-bold text-gray-900">Pick a template for <span className="text-indigo-600">{certLabel(certType)}</span></h3>
        <p className="text-xs text-gray-400 mt-0.5">Choose a pre-built certificate design — you'll place fields on it next.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? <LoadingSpinner fullPage label="Loading templates…" />
          : error ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <p className="text-sm text-red-500">Failed to load templates.</p>
              <button className="btn-secondary text-xs" onClick={() => refetch()}>Retry</button>
            </div>
          ) : !templates?.length ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <svg className="h-12 w-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-600">No templates available yet.</p>
                <p className="mt-1 text-xs text-gray-400">Add PNG files to <code className="bg-gray-100 px-1 rounded">backend/app/static/certificate_templates/</code> and restart the server.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {templates.map(t => <TemplateCard key={t.id} template={t} selected={selected} onSelect={setSelected} />)}
            </div>
          )}
      </div>
      <div className="flex justify-end px-6 py-4 border-t border-gray-100 shrink-0">
        <button className="btn-primary" disabled={!selected} onClick={() => onChosen(selected)}>
          Next: Place Fields →
        </button>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Step 2 — Place text fields
// ═════════════════════════════════════════════════════════════════════════════
function MarkerPin({ col, pos, color, isActive, onClick }) {
  return (
    <div onClick={() => onClick(col)} title={col}
      style={{ position:'absolute', left:`${pos.x_percent}%`, top:`${pos.y_percent}%`, transform:'translate(-50%,-50%)', cursor:'pointer', zIndex:10 }}>
      <div className="flex items-center justify-center rounded-full text-white text-[9px] font-bold shadow-lg transition-transform"
        style={{ background:color, width:isActive?28:22, height:isActive?28:22, border:isActive?'2.5px solid white':'2px solid white', boxShadow:isActive?`0 0 0 2px ${color}`:undefined }}>●</div>
      <div className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-semibold text-white shadow pointer-events-none"
        style={{ background:color, opacity:isActive?1:0.82 }}>{col}</div>
    </div>
  )
}

function PlaceFieldsStep({ certType, template, columns, existingPositions, onBack, onNext }) {
  const imgRef = useRef(null)
  const [positions, setPositions] = useState(existingPositions ?? {})
  const [activeField, setActiveField] = useState(null)
  const [imgW, setImgW] = useState(0)
  const colorMap = Object.fromEntries(columns.map((c,i) => [c, MARKER_COLORS[i % MARKER_COLORS.length]]))

  useEffect(() => {
    const upd = () => { if (imgRef.current) setImgW(imgRef.current.getBoundingClientRect().width) }
    upd(); window.addEventListener('resize', upd); return () => window.removeEventListener('resize', upd)
  }, [])

  const handleClick = useCallback(e => {
    if (!activeField) return
    const rect = e.currentTarget.getBoundingClientRect()
    const xp = ((e.clientX - rect.left) / rect.width) * 100
    const yp = ((e.clientY - rect.top) / rect.height) * 100
    setPositions(prev => ({ ...prev, [activeField]: { x_percent: xp, y_percent: yp } }))
    const next = columns.find(c => c !== activeField && !positions[c])
    setActiveField(next ?? null)
  }, [activeField, columns, positions])

  const allPlaced = columns.length > 0 && columns.every(c => positions[c])
  const placed = columns.filter(c => positions[c]).length

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Change Template
          </button>
          <span className="text-gray-300">›</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Step 2 of 3</p>
            <p className="text-sm font-bold text-gray-900">Place columns on <span className="text-indigo-600">{certLabel(certType)}</span></p>
          </div>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-3 py-1">{template.display_name}</span>
      </div>
      <div className="px-6 py-2 border-b border-gray-100 shrink-0 flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-500 transition-all duration-300"
            style={{ width: columns.length > 0 ? `${(placed/columns.length)*100}%` : '0%' }} />
        </div>
        <span className="text-xs text-gray-500 shrink-0">{placed}/{columns.length} placed</span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-52 shrink-0 border-r border-gray-100 flex flex-col gap-3 px-3 py-4 overflow-y-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Excel Columns</p>
          {columns.length === 0 ? <p className="text-xs text-gray-400 italic">No columns detected.</p> : (
            <div className="flex flex-col gap-1">
              {columns.map(col => {
                const isPlaced = !!positions[col], isActive = activeField === col
                const color = colorMap[col] ?? '#6b7280'
                return (
                  <button key={col} onClick={() => setActiveField(p => p === col ? null : col)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all w-full
                      ${isActive ? 'border-indigo-400 bg-indigo-50 font-semibold text-indigo-700' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}>
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: isPlaced ? color : '#d1d5db' }} />
                    <span className="truncate flex-1">{col}</span>
                    {isPlaced && <svg className="h-3 w-3 shrink-0" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                  </button>
                )
              })}
            </div>
          )}
          {activeField && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs text-indigo-700 mt-1">
              <p className="font-semibold mb-0.5">Placing:</p>
              <p className="truncate" style={{ color: colorMap[activeField] }}>{activeField}</p>
              <p className="text-indigo-400 mt-1">Click on the certificate →</p>
            </div>
          )}
        </aside>
        <div className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-4">
          <div className="relative inline-block shadow-2xl rounded-sm"
            style={{ cursor: activeField ? 'crosshair' : 'default' }} onClick={handleClick}>
            {imgSrc(template.preview_url) ? (
              <img
                ref={imgRef}
                src={imgSrc(template.preview_url)}
                alt={template.display_name}
                onLoad={() => { if (imgRef.current) setImgW(imgRef.current.getBoundingClientRect().width) }}
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                className="block max-w-full"
                style={{ userSelect:'none', maxHeight:'70vh' }}
                draggable={false}
              />
            ) : null}
            <div
              className="flex flex-col items-center justify-center bg-gray-100 rounded text-gray-400 gap-2"
              style={{ display: imgSrc(template.preview_url) ? 'none' : 'flex', width: 400, height: 566 }}
            >
              <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium">Template image not found</p>
              <p className="text-xs text-gray-400 text-center px-4">
                Make sure PNG files exist in<br/>
                <code className="bg-gray-200 px-1 rounded text-gray-600">backend/app/static/certificate_templates/</code>
              </p>
            </div>
            {Object.entries(positions).map(([col, pos]) => (
              <MarkerPin key={col} col={col} pos={pos} color={colorMap[col] ?? '#6b7280'}
                isActive={activeField === col} onClick={c => setActiveField(p => p === c ? null : c)} />
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
        <p className="text-xs text-gray-400">{allPlaced ? '✅ All columns placed.' : 'Select a column, then click on the certificate.'}</p>
        <button className="btn-primary" disabled={!allPlaced || columns.length === 0}
          onClick={() => onNext(positions, imgW)}>
          Next: Place Logo & Signature →
        </button>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Step 3 — Place logo & signature
// ═════════════════════════════════════════════════════════════════════════════
const ASSET_KEYS = ['logo', 'signature']
const ASSET_COLORS = { logo: '#6366f1', signature: '#f59e0b' }
const ASSET_LABELS = { logo: 'Club Logo', signature: 'Signature' }

function PlaceAssetsStep({ certType, template, eventAssets, existingAssetPositions, clubId, eventId,
  columnPositions, displayWidth, onBack, onDone }) {
  const saveMutation = useSaveFieldPositions(clubId, eventId)
  const [positions, setPositions] = useState(existingAssetPositions ?? {})
  const [active, setActive] = useState(null)

  // Determine which assets are available
  const availableAssets = ASSET_KEYS.filter(k =>
    k === 'logo' ? !!eventAssets?.logo_url : !!eventAssets?.signature_url
  )

  const handleClick = useCallback(e => {
    if (!active) return
    const rect = e.currentTarget.getBoundingClientRect()
    const xp = ((e.clientX - rect.left) / rect.width) * 100
    const yp = ((e.clientY - rect.top) / rect.height) * 100
    setPositions(prev => ({ ...prev, [active]: { x_percent: xp, y_percent: yp, width_percent: 15 } }))
    const next = availableAssets.find(k => k !== active && !positions[k])
    setActive(next ?? null)
  }, [active, availableAssets, positions])

  const allPlaced = availableAssets.length === 0 || availableAssets.every(k => positions[k])

  const handleConfirm = async () => {
    await saveMutation.mutateAsync({
      cert_type: certType,
      template_filename: template.filename,
      column_positions: columnPositions,
      asset_positions: Object.keys(positions).length > 0 ? positions : undefined,
      display_width: displayWidth || 580,
      confirmed: true,
    })
    onDone()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back to Fields
          </button>
          <span className="text-gray-300">›</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Step 3 of 3</p>
            <p className="text-sm font-bold text-gray-900">Place Logo & Signature on <span className="text-indigo-600">{certLabel(certType)}</span></p>
          </div>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-3 py-1">{template.display_name}</span>
      </div>

      {availableAssets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12 text-center">
          <svg className="h-12 w-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-gray-600">No logo or signature uploaded yet.</p>
            <p className="mt-1 text-xs text-gray-400">Go to the Overview tab and upload a club logo / signature first. You can skip this step and come back later.</p>
          </div>
          <button className="btn-secondary" onClick={handleConfirm} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Skip & Save →'}
          </button>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <aside className="w-52 shrink-0 border-r border-gray-100 flex flex-col gap-3 px-3 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Assets</p>
            {availableAssets.map(key => {
              const isPlaced = !!positions[key], isActive = active === key
              const color = ASSET_COLORS[key]
              const previewUrl = key === 'logo' ? eventAssets.logo_url : eventAssets.signature_url
              return (
                <button key={key} onClick={() => setActive(p => p === key ? null : key)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-all w-full
                    ${isActive ? 'border-indigo-400 bg-indigo-50 font-semibold text-indigo-700' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}>
                  {previewUrl && <img src={imgSrc(previewUrl)} alt={key} className="h-6 w-6 object-contain rounded shrink-0" />}
                  <span className="flex-1">{ASSET_LABELS[key]}</span>
                  {isPlaced && <svg className="h-3 w-3 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </button>
              )
            })}
            {active && (
              <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs text-indigo-700 mt-1">
                <p className="font-semibold">Placing: {ASSET_LABELS[active]}</p>
                <p className="text-indigo-400 mt-1">Click on the certificate →</p>
              </div>
            )}
          </aside>
          <div className="flex-1 overflow-auto bg-gray-100 flex items-start justify-center p-4">
            <div className="relative inline-block shadow-2xl rounded-sm"
              style={{ cursor: active ? 'crosshair' : 'default' }} onClick={handleClick}>
              {imgSrc(template.preview_url) ? (
                <img
                  src={imgSrc(template.preview_url)}
                  alt={template.display_name}
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                  className="block max-w-full"
                  style={{ userSelect:'none', maxHeight:'70vh' }}
                  draggable={false}
                />
              ) : null}
              <div
                className="flex flex-col items-center justify-center bg-gray-100 rounded text-gray-400 gap-2"
                style={{ display: imgSrc(template.preview_url) ? 'none' : 'flex', width: 400, height: 566 }}
              >
                <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-medium">Template image not found</p>
              </div>
              {Object.entries(positions).map(([key, pos]) => (
                <div key={key} onClick={() => setActive(p => p === key ? null : key)}
                  style={{ position:'absolute', left:`${pos.x_percent}%`, top:`${pos.y_percent}%`, transform:'translate(-50%,-50%)', cursor:'pointer', zIndex:10 }}>
                  <div className="flex items-center justify-center rounded border-2 text-white text-[9px] font-bold shadow-lg"
                    style={{ background: ASSET_COLORS[key], borderColor:'white', padding:'2px 6px', fontSize:'9px' }}>
                    {ASSET_LABELS[key]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {availableAssets.length > 0 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
          <p className="text-xs text-gray-400">{allPlaced ? '✅ All assets placed.' : 'Click an asset, then click on the certificate to place it.'}</p>
          <button id={`confirm-positions-${certType}`} className="btn-primary"
            disabled={saveMutation.isPending}
            onClick={handleConfirm}>
            {saveMutation.isPending ? 'Saving…' : 'Confirm & Save ✓'}
          </button>
        </div>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Cert type tab switcher
// ═════════════════════════════════════════════════════════════════════════════
function CertTypeSwitcher({ certTypes, activeCertType, savedPositions, onSwitch }) {
  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-gray-100 bg-gray-50 overflow-x-auto shrink-0">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0 mr-1">Certificate Types:</span>
      {certTypes.map(ct => {
        const saved = savedPositions?.find(fp => fp.cert_type === ct)
        const isActive = activeCertType === ct
        return (
          <button key={ct} onClick={() => onSwitch(ct)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all shrink-0
              ${isActive ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
            <span className={`h-2 w-2 rounded-full ${saved?.confirmed ? 'bg-green-400' : isActive ? 'bg-white/70' : 'bg-gray-300'}`} />
            {certLabel(ct)}
            {saved?.confirmed && !isActive && (
              <svg className="h-3 w-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Main export
// ═════════════════════════════════════════════════════════════════════════════
export default function TemplateSelector({ isModal=false, onClose, clubId: propClubId, eventId: propEventId }) {
  const params   = useParams()
  const navigate = useNavigate()
  const clubId  = propClubId  ?? params.club_id
  const eventId = propEventId ?? params.event_id

  const { data: event } = useEvent(clubId, eventId)
  const { data: participants, isLoading: participantsLoading } = useParticipants(clubId, eventId)
  const { data: allSavedPositions } = useAllFieldPositions(clubId, eventId)

  // Derive cert types and columns from participants
  const certTypes = (() => {
    if (!participants?.length) return []
    return Array.from(new Set(participants.map(p => p.cert_type).filter(Boolean)))
  })()
  const columns = (() => {
    if (!participants?.length) return []
    const keys = new Set()
    const SKIP = new Set(['_id', 'id', 'event_id', 'club_id', 'cert_type', 'email',
      'registration_number', 'name', 'created_at', 'is_verified', 'source',
      'registered_at', 'custom_data', 'fields', 'certificate_issued'])

    participants.forEach(p => {
      // Primary: use the fields map (Excel-imported participants)
      if (p.fields && typeof p.fields === 'object') {
        Object.keys(p.fields).forEach(k => { if (!k.startsWith('_')) keys.add(k) })
      }
    })

    // Fallback: derive map-able columns from top-level keys for manually added records.
    if (keys.size === 0) {
      participants.forEach(p => {
        Object.keys(p || {}).forEach(k => {
          if (!k.startsWith('_') && !SKIP.has(k)) keys.add(k)
        })
      })
    }

    return Array.from(keys)
  })()

  const [activeCertType, setActiveCertType] = useState(null)
  useEffect(() => { if (certTypes.length && !activeCertType) setActiveCertType(certTypes[0]) }, [certTypes, activeCertType])

  // Per-cert-type step: 'gallery' | 'fields' | 'assets'
  const [stepByCert, setStepByCert]           = useState({})
  const [templateByCert, setTemplateByCert]   = useState({})
  const [fieldPosByCert, setFieldPosByCert]   = useState({})
  const [displayWByCert, setDisplayWByCert]   = useState({})

  const getStep = ct => stepByCert[ct] ?? 'gallery'

  const handleTemplateChosen = (ct, template) => {
    setTemplateByCert(prev => ({ ...prev, [ct]: template }))
    setStepByCert(prev => ({ ...prev, [ct]: 'fields' }))
  }
  const handleFieldsNext = (ct, positions, displayW) => {
    setFieldPosByCert(prev => ({ ...prev, [ct]: positions }))
    setDisplayWByCert(prev => ({ ...prev, [ct]: displayW }))
    setStepByCert(prev => ({ ...prev, [ct]: 'assets' }))
  }
  const handleDone = ct => {
    const nextUnconfigured = certTypes.find(
      c => c !== ct && !(allSavedPositions ?? []).find(fp => fp.cert_type === c && fp.confirmed)
    )
    if (nextUnconfigured) setActiveCertType(nextUnconfigured)
    else if (isModal) onClose?.()
    else navigate(-1)
  }

  const allConfigured = certTypes.length > 0 && certTypes.every(
    ct => (allSavedPositions ?? []).find(fp => fp.cert_type === ct && fp.confirmed)
  )

  const renderContent = () => {
    if (participantsLoading) return <LoadingSpinner fullPage label="Loading participant data…" />

    if (!participants?.length) {
      return (
        <div className="flex flex-col h-full items-center justify-center gap-4 p-12 text-center">
          <svg className="h-14 w-14 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-gray-600">No participants uploaded yet.</p>
            <p className="mt-1 text-xs text-gray-400">Upload your Excel file in the Participants tab first, then come back here.</p>
          </div>
          <button className="btn-secondary text-sm" onClick={() => isModal ? onClose?.() : navigate(-1)}>Go Back</button>
        </div>
      )
    }

    if (!certTypes.length) return null
    const ct = activeCertType ?? certTypes[0]
    const savedFP = (allSavedPositions ?? []).find(fp => fp.cert_type === ct)
    const step = getStep(ct)
    const chosenTemplate = templateByCert[ct]

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Assign Certificate Templates</h2>
            <p className="text-xs text-gray-400 mt-0.5">Configure template + field positions for each role found in your Excel.</p>
          </div>
          <div className="flex items-center gap-3">
            {allConfigured && <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-3 py-1">✅ All configured</span>}
            {!isModal && <button onClick={() => navigate(-1)} className="btn-ghost text-sm flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>Back
            </button>}
            {isModal && <button onClick={onClose} className="rounded p-1.5 text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>}
          </div>
        </div>
        <CertTypeSwitcher certTypes={certTypes} activeCertType={ct} savedPositions={allSavedPositions} onSwitch={setActiveCertType} />
        <div className="flex-1 overflow-hidden flex flex-col">
          {step === 'gallery' && (
            <GalleryStep key={`gallery-${ct}`} certType={ct}
              existingFilename={savedFP?.template_filename ?? null}
              onChosen={tmpl => handleTemplateChosen(ct, tmpl)} />
          )}
          {step === 'fields' && (
            <PlaceFieldsStep key={`fields-${ct}`} certType={ct} template={chosenTemplate}
              columns={columns} existingPositions={savedFP?.column_positions ?? {}}
              onBack={() => setStepByCert(prev => ({ ...prev, [ct]: 'gallery' }))}
              onNext={(pos, w) => handleFieldsNext(ct, pos, w)} />
          )}
          {step === 'assets' && (
            <PlaceAssetsStep key={`assets-${ct}`} certType={ct} template={chosenTemplate}
              eventAssets={event?.assets}
              existingAssetPositions={savedFP?.asset_positions ?? {}}
              clubId={clubId} eventId={eventId}
              columnPositions={fieldPosByCert[ct] ?? savedFP?.column_positions ?? {}}
              displayWidth={displayWByCert[ct] ?? savedFP?.display_width ?? 580}
              onBack={() => setStepByCert(prev => ({ ...prev, [ct]: 'fields' }))}
              onDone={() => handleDone(ct)} />
          )}
        </div>
      </div>
    )
  }

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 flex flex-col w-full max-w-6xl rounded-2xl bg-white shadow-2xl overflow-hidden" style={{ height:'90vh' }}>
          {renderContent()}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden bg-background">
          <div className="h-full flex flex-col">{renderContent()}</div>
        </main>
      </div>
    </div>
  )
}
