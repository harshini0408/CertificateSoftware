import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import StatusBadge from '../components/StatusBadge'
import FileUpload from '../components/FileUpload'
import LoadingSpinner from '../components/LoadingSpinner'
import DataTable from '../components/DataTable'
import { useEvent } from '../api/events'
import { useToastStore } from '../store/uiStore'
import axiosInstance from '../utils/axiosInstance'
import { eventKeys } from '../api/events'
import CertificateIssue from './CertificateIssue'

// ─── Tab ids ──────────────────────────────────────────────────────────────────
const TABS = ['overview', 'participants', 'certificates']

const CERT_TYPES = [
  'participant',
  'coordinator',
  'winner_1st',
  'winner_2nd',
  'winner_3rd',
  'mentor',
  'judge',
  'volunteer',
]

const EXPIRY_OPTIONS = [
  { label: '1 hour',      value: '1h' },
  { label: '2 hours',     value: '2h' },
  { label: '4 hours',     value: '4h' },
  { label: 'End of day',  value: 'eod' },
  { label: 'Custom',      value: 'custom' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ event, clubId, eventId }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  // ── Asset upload state ─────────────────────────────────────────────────
  const [logoFile, setLogoFile]         = useState(null)
  const [logoPreview, setLogoPreview]   = useState(event?.assets?.logo_url ?? null)
  const [sigFile, setSigFile]           = useState(null)
  const [sigPreview, setSigPreview]     = useState(event?.assets?.signature_url ?? null)
  const [uploadingAssets, setUploadingAssets] = useState(false)

  // ── Asset handlers ─────────────────────────────────────────────────────
  const handleLogoChange = (file) => {
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const handleSigChange = (file) => {
    setSigFile(file)
    setSigPreview(URL.createObjectURL(file))
  }

  const uploadAssets = async () => {
    if (!logoFile && !sigFile) {
      addToast({ type: 'warning', message: 'Select at least one asset to upload.' })
      return
    }
    setUploadingAssets(true)
    try {
      const formData = new FormData()
      if (logoFile) formData.append('logo', logoFile)
      if (sigFile)  formData.append('signature', sigFile)

      await axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/assets`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      qc.invalidateQueries({ queryKey: eventKeys.detail(clubId, eventId) })
      addToast({ type: 'success', message: 'Assets uploaded successfully.' })
      setLogoFile(null)
      setSigFile(null)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Asset upload failed.'
      addToast({ type: 'error', message: msg })
    } finally {
      setUploadingAssets(false)
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* ── Event details card ─────────────────────────────────────────── */}
      <section className="card p-6">
        <h2 className="section-title mb-4">Event Details</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            ['Name',        event?.name],
            ['Date',        event?.event_date
                              ? new Date(event.event_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
                              : '—'],
            ['Status',      <StatusBadge key="s" status={event?.status ?? 'draft'} />],
            ['Description', event?.description || '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                {label}
              </dt>
              <dd className="text-sm text-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Assets section ─────────────────────────────────────────────── */}
      <section className="card p-6">
        <h2 className="section-title mb-1">Assets</h2>
        <p className="mb-5 text-sm text-gray-500">
          Upload the club logo and organiser signature for this event.
          The signature will have its background automatically removed.
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Logo */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Club Logo</p>
            {logoPreview && (
              <img
                src={logoPreview}
                alt="Logo preview"
                className="h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50 p-2"
              />
            )}
            <FileUpload
              id="logo-upload"
              accept="image/*"
              label="Drop logo here"
              hint="PNG / JPG / SVG, max 5 MB"
              maxSizeMB={5}
              onFile={handleLogoChange}
            />
          </div>

          {/* Signature */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Organiser Signature</p>
            {sigPreview && (
              <img
                src={sigPreview}
                alt="Signature preview"
                className="h-24 w-auto rounded border border-gray-200 object-contain bg-gray-50 p-2"
              />
            )}
            <FileUpload
              id="sig-upload"
              accept="image/*"
              label="Drop signature here"
              hint="PNG / JPG, max 5 MB — background will be removed"
              maxSizeMB={5}
              onFile={handleSigChange}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            id="upload-assets-btn"
            className="btn-primary"
            onClick={uploadAssets}
            disabled={uploadingAssets || (!logoFile && !sigFile)}
          >
            {uploadingAssets ? (
              <><LoadingSpinner size="sm" label="" /> Uploading…</>
            ) : (
              'Upload Assets'
            )}
          </button>
        </div>
      </section>

      {/* ── Certificate Templates section ──────────────────────────────── */}
      <section className="card p-6">
        <h2 className="section-title mb-1">Certificate Templates</h2>
        <p className="mb-5 text-sm text-gray-500">
          Select a pre-built template for each certificate type and click on it to place your Excel columns.
        </p>
        <button
          id="configure-templates-btn"
          className="btn-primary"
          onClick={() => navigate(`/club/${clubId}/events/${eventId}/templates/select`)}
        >
          🖼 Configure Templates & Field Positions
        </button>
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel Upload Sub-tab
// ─────────────────────────────────────────────────────────────────────────────
function ExcelUploadTab({ clubId, eventId, onMappingNeeded }) {
  const addToast = useToastStore((s) => s.addToast)
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const downloadTemplate = async () => {
    setDownloading(true)
    try {
      const resp = await axiosInstance.get(
        `/clubs/${clubId}/events/${eventId}/excel-template`,
        { responseType: 'blob' },
      )
      const url = URL.createObjectURL(resp.data)
      const a   = document.createElement('a')
      a.href    = url
      a.download = `participants_template_${eventId}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      addToast({ type: 'error', message: 'Failed to download template.' })
    } finally {
      setDownloading(false)
    }
  }

  const uploadExcel = async () => {
    if (!file) {
      addToast({ type: 'warning', message: 'Please select an Excel file first.' })
      return
    }
    setUploading(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/participants/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      setResult(data)
      addToast({
        type: 'success',
        message: `${data.created ?? 0} participant(s) imported successfully.`,
      })
      if ((data.created ?? 0) > 0) {
        onMappingNeeded()
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Upload failed.'
      addToast({ type: 'error', message: msg })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      {/* Step 1 — download template */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-sm font-bold text-navy">
            1
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              Download the Excel template
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Fill in the downloaded file with participant data and re-upload below.
            </p>
            <button
              id="download-excel-template"
              className="btn-secondary mt-3 text-sm"
              onClick={downloadTemplate}
              disabled={downloading}
            >
              {downloading ? (
                <><LoadingSpinner size="sm" label="" /> Downloading…</>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Template
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Step 2 — upload filled file */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-sm font-bold text-navy">
            2
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">Upload filled file</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Accepts .xlsx or .xls files up to 10 MB.
              </p>
            </div>
            <FileUpload
              id="participant-excel-upload"
              accept=".xlsx,.xls"
              label="Drop Excel file here"
              hint=".xlsx or .xls · max 10 MB"
              maxSizeMB={10}
              onFile={setFile}
            />
            <div className="flex justify-end">
              <button
                id="upload-excel-btn"
                className="btn-primary"
                onClick={uploadExcel}
                disabled={uploading || !file}
              >
                {uploading ? (
                  <><LoadingSpinner size="sm" label="" /> Uploading…</>
                ) : (
                  'Upload & Import'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Result panel */}
      {result && (
        <div className={`card p-5 border-l-4 ${
          (result.errors?.length ?? 0) > 0 ? 'border-amber-400' : 'border-green-500'
        }`}>
          <p className="text-sm font-semibold text-foreground mb-2">Upload Result</p>
          <p className="text-sm text-gray-600">
            ✅ <strong>{result.created ?? 0}</strong> participant(s) imported
            {(result.skipped ?? 0) > 0 && (
              <span> · ⚠️ <strong>{result.skipped}</strong> skipped (duplicate)</span>
            )}
          </p>
          {result.errors?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">
                Rows with errors ({result.errors.length}):
              </p>
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                    Row {e.row ?? i + 2}: {e.message ?? e}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(result.created ?? 0) > 0 && (
            <button
              className="btn-primary mt-4 text-sm"
              onClick={onMappingNeeded}
            >
              Proceed to Field Mapping →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual Entry Sub-tab
// ─────────────────────────────────────────────────────────────────────────────
function ManualEntryTab({ clubId, eventId, event, onMappingNeeded }) {
  const addToast = useToastStore((s) => s.addToast)

  // Derive field slots from the assigned template (if any)
  const templateSlots = event?.template_slots ?? []

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      email: '',
      registration_number: '',
      cert_type: 'participant',
    },
  })

  const onSubmit = async (values) => {
    try {
      await axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/participants`,
        values,
      )
      addToast({ type: 'success', message: 'Participant added.' })
      reset()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to add participant.'
      addToast({ type: 'error', message: msg })
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-4">
        {/* Email */}
        <div>
          <label className="form-label" htmlFor="manual-email">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="manual-email"
            type="email"
            className={`form-input ${errors.email ? 'form-input-error' : ''}`}
            placeholder="participant@example.com"
            {...register('email', {
              required: 'Email is required.',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email.' },
            })}
          />
          {errors.email && <p className="form-error">{errors.email.message}</p>}
        </div>

        {/* Registration Number */}
        <div>
          <label className="form-label" htmlFor="manual-regno">
            Registration Number <span className="text-red-500">*</span>
          </label>
          <input
            id="manual-regno"
            type="text"
            className={`form-input ${errors.registration_number ? 'form-input-error' : ''}`}
            placeholder="21CS001"
            {...register('registration_number', { required: 'Registration number is required.' })}
          />
          {errors.registration_number && (
            <p className="form-error">{errors.registration_number.message}</p>
          )}
        </div>

        {/* Cert Type */}
        <div>
          <label className="form-label" htmlFor="manual-cert-type">
            Certificate Type
          </label>
          <select
            id="manual-cert-type"
            className="form-input"
            {...register('cert_type')}
          >
            {CERT_TYPES.map((ct) => (
              <option key={ct} value={ct}>
                {ct.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic template field slots */}
        {templateSlots.map((slot) => (
          <div key={slot.name}>
            <label className="form-label" htmlFor={`slot-${slot.name}`}>
              {slot.label ?? slot.name}
            </label>
            <input
              id={`slot-${slot.name}`}
              type="text"
              className="form-input"
              placeholder={slot.label ?? slot.name}
              {...register(slot.name)}
            />
          </div>
        ))}

        <div className="flex justify-between items-center pt-2">
          <button
            type="button"
            className="btn-ghost text-sm"
            onClick={onMappingNeeded}
          >
            Open Field Mapping
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding…' : 'Add Participant'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// QR Registrations Sub-tab
// ─────────────────────────────────────────────────────────────────────────────
function QrTab({ clubId, eventId }) {
  const addToast = useToastStore((s) => s.addToast)
  const qc = useQueryClient()

  const [customFields, setCustomFields] = useState([{ label: '' }])
  const [expiry, setExpiry]             = useState('2h')
  const [customExpiry, setCustomExpiry] = useState('')
  const [qrData, setQrData]             = useState(null)
  const [generating, setGenerating]     = useState(false)
  const [expiring, setExpiring]         = useState(false)

  // QR registrations list
  const { data: qrRegs, isLoading: regsLoading } = useQuery({
    queryKey: ['qr-regs', clubId, eventId],
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/clubs/${clubId}/events/${eventId}/participants?source=qr`,
      )
      return data
    },
  })

  const addCustomField = () => {
    if (customFields.length < 3) {
      setCustomFields((f) => [...f, { label: '' }])
    }
  }
  const removeCustomField = (i) =>
    setCustomFields((f) => f.filter((_, idx) => idx !== i))
  const updateField = (i, val) =>
    setCustomFields((f) => f.map((x, idx) => (idx === i ? { label: val } : x)))

  const generateQr = async () => {
    setGenerating(true)
    try {
      const { data } = await axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/qr/generate`,
        {
          custom_fields: customFields.map((f) => f.label).filter(Boolean),
          expiry: expiry === 'custom' ? customExpiry : expiry,
        },
      )
      setQrData(data)
      addToast({ type: 'success', message: 'QR code generated.' })
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to generate QR.' })
    } finally {
      setGenerating(false)
    }
  }

  const expireNow = async () => {
    setExpiring(true)
    try {
      await axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/qr/expire`,
      )
      setQrData(null)
      addToast({ type: 'success', message: 'QR link expired.' })
    } catch (err) {
      addToast({ type: 'error', message: 'Failed to expire QR.' })
    } finally {
      setExpiring(false)
    }
  }

  const verifyReg = async (regId) => {
    try {
      await axiosInstance.patch(
        `/clubs/${clubId}/events/${eventId}/participants/${regId}/verify`,
      )
      qc.invalidateQueries({ queryKey: ['qr-regs', clubId, eventId] })
      addToast({ type: 'success', message: 'Registration verified.' })
    } catch {
      addToast({ type: 'error', message: 'Verification failed.' })
    }
  }

  const deleteReg = async (regId) => {
    try {
      await axiosInstance.delete(
        `/clubs/${clubId}/events/${eventId}/participants/${regId}`,
      )
      qc.invalidateQueries({ queryKey: ['qr-regs', clubId, eventId] })
      addToast({ type: 'success', message: 'Registration deleted.' })
    } catch {
      addToast({ type: 'error', message: 'Delete failed.' })
    }
  }

  const verifyAll = async () => {
    try {
      await axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/participants/verify-all`,
        { source: 'qr' },
      )
      qc.invalidateQueries({ queryKey: ['qr-regs', clubId, eventId] })
      addToast({ type: 'success', message: 'All QR registrations verified.' })
    } catch {
      addToast({ type: 'error', message: 'Bulk verify failed.' })
    }
  }

  const qrColumns = [
    { key: 'email',              header: 'Email',          sortable: true, searchKey: true },
    { key: 'registration_number', header: 'Reg No',        sortable: true, searchKey: true },
    {
      key: 'custom_data',
      header: 'Custom Fields',
      render: (v) =>
        v && typeof v === 'object'
          ? Object.values(v).join(', ')
          : (v ?? '—'),
    },
    {
      key: 'registered_at',
      header: 'Registered At',
      render: (v) =>
        v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—',
    },
    {
      key: 'is_verified',
      header: 'Verified',
      align: 'center',
      render: (v) =>
        v ? (
          <span className="text-green-600 font-semibold text-xs">✓ Yes</span>
        ) : (
          <span className="text-gray-400 text-xs">No</span>
        ),
    },
    {
      key: 'id',
      header: 'Actions',
      align: 'center',
      render: (id, row) => (
        <div className="flex items-center justify-center gap-2">
          {!row.is_verified && (
            <button
              onClick={(e) => { e.stopPropagation(); verifyReg(id) }}
              className="rounded p-1 text-green-600 hover:bg-green-50 transition-colors"
              title="Verify"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); deleteReg(id) }}
            className="rounded p-1 text-red-500 hover:bg-red-50 transition-colors"
            title="Delete"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-8">
      {/* QR generation */}
      <div className="card p-6 max-w-lg space-y-5">
        <h3 className="text-sm font-semibold text-foreground">Generate Registration QR</h3>

        {/* Custom fields */}
        <div>
          <p className="form-label mb-2">Custom fields (max 3)</p>
          <div className="space-y-2">
            {customFields.map((f, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  className="form-input"
                  placeholder={`Field ${i + 1} label (e.g. College Name)`}
                  value={f.label}
                  onChange={(e) => updateField(i, e.target.value)}
                />
                {customFields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCustomField(i)}
                    className="shrink-0 text-red-400 hover:text-red-600 transition-colors"
                    aria-label="Remove field"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          {customFields.length < 3 && (
            <button
              type="button"
              onClick={addCustomField}
              className="btn-ghost mt-2 text-xs"
            >
              + Add Field
            </button>
          )}
        </div>

        {/* Expiry */}
        <div>
          <label className="form-label" htmlFor="qr-expiry">Link Expiry</label>
          <select
            id="qr-expiry"
            className="form-input"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          >
            {EXPIRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {expiry === 'custom' && (
            <input
              type="datetime-local"
              className="form-input mt-2"
              value={customExpiry}
              onChange={(e) => setCustomExpiry(e.target.value)}
            />
          )}
        </div>

        <button
          id="generate-qr-btn"
          className="btn-primary w-full"
          onClick={generateQr}
          disabled={generating}
        >
          {generating ? (
            <><LoadingSpinner size="sm" label="" /> Generating…</>
          ) : (
            'Generate QR Code'
          )}
        </button>
      </div>

      {/* Generated QR display */}
      {qrData && (
        <div className="card p-6 max-w-sm flex flex-col items-center gap-4"
          style={{ animation: 'fadeIn 0.2s ease-out' }}>
          <p className="text-sm font-semibold text-foreground">Registration QR Code</p>
          <img
            src={qrData.qr_image_url ?? `data:image/png;base64,${qrData.qr_base64}`}
            alt="QR Code"
            className="h-48 w-48 rounded border border-gray-200"
          />
          <p className="text-xs text-gray-500">
            Expires: {qrData.expires_at
              ? new Date(qrData.expires_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
              : 'N/A'}
          </p>
          <button
            className="btn-danger text-sm w-full"
            onClick={expireNow}
            disabled={expiring}
          >
            {expiring ? 'Expiring…' : 'Expire Now'}
          </button>
        </div>
      )}

      {/* QR registrations table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="section-title">QR Registrations</h3>
          <button
            id="verify-all-qr-btn"
            className="btn-secondary text-sm"
            onClick={verifyAll}
          >
            ✓ Verify All
          </button>
        </div>
        <DataTable
          columns={qrColumns}
          data={qrRegs ?? []}
          isLoading={regsLoading}
          emptyMessage="No QR registrations yet."
          searchable
          searchPlaceholder="Search by email or reg no…"
          rowKey="_id"
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Participants Tab (with 3 sub-tabs)
// ─────────────────────────────────────────────────────────────────────────────
const PARTICIPANT_SUBTABS = [
  { id: 'excel',  label: 'Excel Upload' },
  { id: 'manual', label: 'Manual Entry' },
  { id: 'qr',     label: 'QR Registrations' },
]

function ParticipantsTab({ clubId, eventId, event, onGoToMapping }) {
  const [subTab, setSubTab] = useState('excel')

  return (
    <div className="space-y-6">
      {/* Sub-tab bar */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {PARTICIPANT_SUBTABS.map((st) => (
          <button
            key={st.id}
            id={`participants-subtab-${st.id}`}
            onClick={() => setSubTab(st.id)}
            className={`
              rounded-md px-4 py-1.5 text-sm font-medium transition-colors
              ${subTab === st.id
                ? 'bg-white text-navy shadow-sm'
                : 'text-gray-500 hover:text-navy'
              }
            `}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === 'excel' && (
        <ExcelUploadTab
          clubId={clubId}
          eventId={eventId}
          onMappingNeeded={onGoToMapping}
        />
      )}
      {subTab === 'manual' && (
        <ManualEntryTab
          clubId={clubId}
          eventId={eventId}
          event={event}
          onMappingNeeded={onGoToMapping}
        />
      )}
      {subTab === 'qr' && (
        <QrTab clubId={clubId} eventId={eventId} />
      )}
    </div>
  )
}

// CertificateIssue is the real certificates tab — defined in pages/CertificateIssue.jsx

// FieldMappingCanvas is rendered inline inside the Field Mapping tab.
// The full canvas component lives in pages/FieldMappingCanvas.jsx.

// ─────────────────────────────────────────────────────────────────────────────
// EventDetail (main export)
// ─────────────────────────────────────────────────────────────────────────────
export default function EventDetail() {
  const { club_id, event_id } = useParams()
  const [activeTab, setActiveTab] = useState('overview')

  const { data: event, isLoading } = useEvent(club_id, event_id)

  const goToMapping = () => setActiveTab('field-mapping')

  if (isLoading) {
    return (
      <div className="flex h-dvh flex-col">
        <Navbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 bg-background">
            <LoadingSpinner fullPage label="Loading event…" />
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container">
            {/* Breadcrumb */}
            <nav className="mb-4 flex items-center gap-1.5 text-xs text-gray-400">
              <span
                className="cursor-pointer hover:text-navy transition-colors"
                onClick={() => window.history.back()}
              >
                Events
              </span>
              <span>›</span>
              <span className="font-medium text-foreground truncate max-w-xs">
                {event?.name ?? 'Event'}
              </span>
            </nav>

            {/* Page heading */}
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {event?.name ?? 'Event Detail'}
                </h1>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={event?.status ?? 'draft'} />
                  {event?.event_date && (
                    <span className="text-xs text-gray-500">
                      {new Date(event.event_date).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'long', year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tab bar */}
            <div className="mb-6 flex gap-1 border-b border-gray-200 overflow-x-auto scrollbar-hide">
              {TABS.map((tab) => {
                const labels = {
                  overview: 'Overview',
                  participants: 'Participants',
                  'field-mapping': 'Field Mapping',
                  certificates: 'Certificates',
                }
                return (
                  <button
                    key={tab}
                    id={`event-tab-${tab}`}
                    onClick={() => setActiveTab(tab)}
                    className={`
                      relative whitespace-nowrap shrink-0 px-4 py-2.5 text-sm font-medium transition-colors
                      ${activeTab === tab
                        ? 'text-navy after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-navy after:rounded-t-full'
                        : 'text-gray-500 hover:text-navy'
                      }
                    `}
                  >
                    {labels[tab]}
                  </button>
                )
              })}
            </div>

            {/* Tab content */}
            {activeTab === 'overview' && (
              <OverviewTab
                event={event}
                clubId={club_id}
                eventId={event_id}
              />
            )}
            {activeTab === 'participants' && (
              <ParticipantsTab
                clubId={club_id}
                eventId={event_id}
                event={event}
                onGoToMapping={goToMapping}
              />
            )}
            {activeTab === 'field-mapping' && (
              <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mb-6">
                <FieldMappingCanvas embedded />
              </div>
            )}
            {activeTab === 'certificates' && (
              <CertificateIssue
                embedded
                clubId={club_id}
                eventId={event_id}
                event={event}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
