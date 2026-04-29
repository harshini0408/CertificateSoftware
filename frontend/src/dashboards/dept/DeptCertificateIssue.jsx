import { useEffect, useMemo, useState } from 'react'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useToastStore } from '../../store/uiStore'
import { BACKEND_URL } from '../../utils/axiosInstance'
import { downloadDeptCertificatesZip } from './api'
import {
  useDeptEvent,
  useDeptEventCertificates,
  useSendDeptEventCertificates,
  useSendSingleDeptEventCertificate,
  useDeptAssets,
  useDeptEventTemplate,
  useDeptEventMapping,
  useDeptEventCertificatePreview,
  useGenerateDeptEventCertificatePreview,
  useApproveDeptEventCertificatePreview,
  useGenerateDeptEventCertificates,
} from './api'

function PreflightItem({ ok, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-green-100' : 'bg-gray-100'}`}>
        {ok ? (
          <svg className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      <span className={`text-sm ${ok ? 'text-gray-700' : 'text-gray-400'}`}>{label}</span>
    </div>
  )
}

function toImageUrl(url) {
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('blob:')) return url
  return `${BACKEND_URL}${url}`
}

function PreviewTag({ label, x, y, fontSize }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        fontSize: `${Math.max(10, Math.min(42, Number(fontSize || 24) * 0.45))}px`,
        lineHeight: 1.1,
      }}
      className="rounded border border-navy/50 bg-white/80 px-2 py-1 font-semibold text-navy shadow-sm"
    >
      {label}
    </div>
  )
}

export default function DeptCertificateIssue({ event }) {
  const addToast = useToastStore((s) => s.addToast)
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)
  const [localPreviewPayload, setLocalPreviewPayload] = useState(null)
  const { data: eventState } = useDeptEvent(event?.id)
  const { data: certs, isLoading: certsLoading } = useDeptEventCertificates(event?.id)

  const [allocateCredits, setAllocateCredits] = useState(false)
  const [manualPointsPerCert, setManualPointsPerCert] = useState(0)

  useEffect(() => {
    if (eventState) {
      setAllocateCredits(!!eventState.allocate_points)
      setManualPointsPerCert(eventState.points_per_cert || 0)
    }
  }, [eventState])
  const { data: assets } = useDeptAssets()
  const { data: eventTemplate } = useDeptEventTemplate(event?.id)
  const { data: mapping } = useDeptEventMapping(event?.id)
  const { data: previewData } = useDeptEventCertificatePreview(event?.id)

  const sendMutation = useSendDeptEventCertificates(event?.id)
  const sendSingleMutation = useSendSingleDeptEventCertificate(event?.id)
  const previewMutation = useGenerateDeptEventCertificatePreview(event?.id)
  const approvePreviewMutation = useApproveDeptEventCertificatePreview(event?.id)
  const generateMutation = useGenerateDeptEventCertificates(event?.id)

  const pendingEmailCount = (certs ?? []).filter((c) => c.status === 'generated').length

  const hasParticipants = (eventState?.source_rows_count ?? 0) > 0 || (certs?.length ?? 0) > 0
  const requiresLogo = !!mapping?.field_positions?._logo
  const requiresSignature = !!mapping?.field_positions?._signature
  const hasAssets = (!requiresLogo || !!assets?.has_logo) && (!requiresSignature || !!assets?.has_signature)
  const hasTemplate = !!eventTemplate?.template
  const hasMapping = !!mapping?.mapping_configured
  const hasPreview = !!(localPreviewPayload?.preview || previewData?.preview)
  const previewApproved = !!previewData?.preview_approved

  const allReady = hasParticipants && hasTemplate && hasMapping

  useEffect(() => {
    setLocalPreviewPayload(null)
  }, [event?.id])

  useEffect(() => {
    if (!previewData?.preview) return
    setLocalPreviewPayload((prev) => {
      if (!prev?.preview) {
        return { ...previewData, _previewTs: Date.now() }
      }
      if (prev.preview.id !== previewData.preview.id || prev.preview.png_url !== previewData.preview.png_url) {
        return { ...previewData, _previewTs: Date.now() }
      }
      return prev
    })
  }, [previewData])

  const firstGenerated = (certs || []).find((c) => !!c.png_url)
  const effectivePreviewPayload = localPreviewPayload || previewData
  const previewImageUrl = useMemo(() => {
    if (!effectivePreviewPayload?.preview?.png_url) return null
    const base = `${BACKEND_URL}${effectivePreviewPayload.preview.png_url}`
    const cacheKey = effectivePreviewPayload?._previewTs || effectivePreviewPayload?.preview?.id || effectivePreviewPayload?.preview?.created_at || Date.now()
    return `${base}${base.includes('?') ? '&' : '?'}t=${encodeURIComponent(String(cacheKey))}`
  }, [effectivePreviewPayload])
  const templateUrl = toImageUrl(eventTemplate?.template?.template_url)
  const templateAspectRatio = 2480 / 3508

  const getPreviewValue = (fieldId) => {
    if (fieldId === '_date') return event?.event_date ? new Date(event.event_date).toLocaleDateString('en-IN') : 'Date'
    if (fieldId === '_cert_number') return 'CERT-0001'
    if (fieldId === '_logo') return 'Logo'
    if (fieldId === '_signature') return 'Signature'
    if (!eventState?.preview_row) return fieldId
    const value = eventState.preview_row[fieldId]
    return value == null || String(value).trim() === '' ? fieldId : String(value)
  }

  const previewPlacementKeys = useMemo(() => {
    const selected = mapping?.selected_fields || []
    const positions = mapping?.field_positions || {}
    const mappedSpecial = ['_cert_number', '_logo', '_signature'].filter((k) => !!positions[k])
    return [...selected, ...mappedSpecial]
  }, [mapping])

  useEffect(() => {
    if (!allReady || hasPreview || previewMutation.isPending) return
    previewMutation.mutate()
  }, [allReady, hasPreview, previewMutation])

  const handleGenerate = async () => {
    if (!previewApproved) {
      addToast({ type: 'warning', message: 'Approve the preview certificate before generating all certificates.' })
      return
    }
    await generateMutation.mutateAsync({
      allocate_points: allocateCredits,
      manual_points: manualPointsPerCert,
    })
  }

  const handleGeneratePreview = async () => {
    const data = await previewMutation.mutateAsync()
    if (data?.preview) {
      setLocalPreviewPayload({ ...data, _previewTs: Date.now() })
    }
  }

  const handleDownloadZip = async () => {
    const certNumbers = (certs ?? [])
      .map((c) => c?.cert_number)
      .filter(Boolean)

    if (certNumbers.length === 0) {
      addToast({ type: 'warning', message: 'No generated certificates available to download.' })
      return
    }

    try {
      setIsDownloadingZip(true)
      const blob = await downloadDeptCertificatesZip(certNumbers)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(event?.name || 'department-event').replace(/\s+/g, '-').toLowerCase()}-certificates.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      addToast({ type: 'success', message: 'ZIP download started.' })
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to download ZIP.' })
    } finally {
      setIsDownloadingZip(false)
    }
  }

  const certColumns = [
    {
      key: 'cert_number',
      header: 'Cert No.',
      sortable: true,
      searchKey: true,
      render: (v) => <span className="font-mono text-xs font-semibold text-navy">{v || '-'}</span>,
    },
    {
      key: 'participant_name',
      header: 'Participant',
      sortable: true,
      searchKey: true,
      render: (v, row) => (
        <div className="flex flex-col">
          <span className="text-sm text-foreground">{v || row.participant_email || '-'}</span>
          {row.participant_email && <span className="text-xs text-gray-400">{row.participant_email}</span>}
        </div>
      ),
    },
    { key: 'cert_type', header: 'Type', render: (v) => <span className="text-xs font-medium capitalize text-gray-600">{(v || 'participant').replace(/_/g, ' ')}</span> },
    { key: 'status', header: 'Status', render: (v, row) => (<div className="flex flex-col gap-0.5"><StatusBadge status={v} />{v === 'failed' && row.failure_reason ? <span className="max-w-[260px] truncate text-[11px] text-red-500" title={row.failure_reason}>{row.failure_reason}</span> : null}</div>) },
    { key: 'generated_at', header: 'Generated' },
    {
      key: 'id',
      header: 'Actions',
      align: 'center',
      searchKey: false,
      render: (certId, row) => {
        const canSendSingle = !!row.participant_email && row.status !== 'emailed'
        return (
          <div className="flex items-center justify-center gap-2">
            {row.png_url ? (
              <a
                href={`${BACKEND_URL}${row.png_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded p-1 text-navy hover:bg-navy/10 transition-colors"
                title="View certificate"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7s-8.268-2.943-9.542-7z" />
                </svg>
              </a>
            ) : null}

            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!canSendSingle) return
                sendSingleMutation.mutate({ certId, payload: { allocateCredits, manualPointsPerCert: allocateCredits ? manualPointsPerCert : undefined } })
              }}
              disabled={!canSendSingle || sendSingleMutation.isPending}
              className="rounded p-1 text-amber-500 hover:bg-amber-50 transition-colors disabled:opacity-50"
              title={!row.participant_email ? 'No email for this certificate' : (row.status === 'emailed' ? 'Already emailed' : 'Send this certificate')}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <p className="text-sm text-gray-600">
          Use this tab to preview the first participant certificate, generate certificates, and send emails.
        </p>
      </div>

      <div className="card p-5">
        <p className="text-sm font-semibold text-foreground mb-3">Filled Certificate Preview</p>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {previewImageUrl ? (
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <img
                  key={effectivePreviewPayload?._previewTs || effectivePreviewPayload?.preview?.id || effectivePreviewPayload?.preview?.created_at || 'dept-preview'}
                  src={previewImageUrl}
                  alt="Preview certificate"
                  className="w-full rounded"
                />
                <p className="mt-2 text-xs text-gray-500">Showing backend-rendered preview using first Excel row and saved mapping.</p>
              </div>
            ) : firstGenerated?.png_url ? (
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <img
                  src={`${BACKEND_URL}${firstGenerated.png_url}`}
                  alt="Generated certificate preview"
                  className="w-full rounded"
                />
                <p className="mt-2 text-xs text-gray-500">Showing first generated certificate preview.</p>
              </div>
            ) : templateUrl ? (
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="relative mx-auto w-full max-w-[820px] overflow-hidden rounded border" style={{ aspectRatio: String(templateAspectRatio) }}>
                  <img src={templateUrl} alt="Certificate template preview" className="absolute inset-0 h-full w-full object-contain object-center" />
                  {!!eventState?.preview_row && previewPlacementKeys.map((key) => {
                    const pos = mapping?.field_positions?.[key]
                    if (!pos) return null
                    return (
                      <PreviewTag
                        key={key}
                        label={getPreviewValue(key)}
                        x={Number(pos.x_percent || 50)}
                        y={Number(pos.y_percent || 50)}
                        fontSize={Number(pos.font_size || 24)}
                      />
                    )
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {eventState?.preview_row ? 'Fallback visual preview. Click Generate Preview for exact rendered certificate.' : 'No preview data yet. Go to Overview, extract fields, and continue to Certificates.'}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-500">
                Upload template and mapping in Overview first.
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Participant Excel rows are persisted from the Overview step.
            </div>

            <div className="rounded-lg border border-navy/10 bg-navy/[0.02] p-3 space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="allocateCredits"
                  checked={allocateCredits}
                  onChange={(e) => {
                    setAllocateCredits(e.target.checked)
                    if (!e.target.checked) setManualPointsPerCert(0)
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-navy focus:ring-navy"
                />
                <label htmlFor="allocateCredits" className="text-sm font-medium text-foreground cursor-pointer">
                  Allocate credit points
                </label>
              </div>
              {allocateCredits && (
                <div className="ml-7 flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-700">Points:</span>
                  <input
                    id="pointsPerCert"
                    type="number"
                    min="0"
                    value={manualPointsPerCert}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10)
                      setManualPointsPerCert(isNaN(val) ? 0 : Math.max(0, val))
                    }}
                    className="w-20 px-2 py-1 rounded border border-gray-300 text-sm focus:border-navy focus:ring-1 focus:ring-navy"
                  />
                </div>
              )}
            </div>

            <button className="btn-secondary w-full" onClick={handleGeneratePreview} disabled={previewMutation.isPending || !allReady}>
              {previewMutation.isPending ? 'Generating Preview...' : (hasPreview ? 'Regenerate Preview' : 'Generate Preview')}
            </button>
            <button className="btn-secondary w-full" onClick={() => approvePreviewMutation.mutate()} disabled={approvePreviewMutation.isPending || !hasPreview || previewApproved}>
              {previewApproved ? 'Preview Approved' : (approvePreviewMutation.isPending ? 'Approving...' : 'Approve Preview')}
            </button>
            <button className="btn-primary w-full" onClick={handleGenerate} disabled={generateMutation.isPending || !allReady || !previewApproved}>
              {generateMutation.isPending ? 'Generating...' : 'Generate Remaining Certificates'}
            </button>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground mb-3">Pre-flight Checklist</p>
            <div className="space-y-2">
              <PreflightItem ok={hasParticipants} label="Participants imported" />
              <PreflightItem ok={true} label={requiresLogo || requiresSignature ? (hasAssets ? 'Mapped assets uploaded (optional)' : 'Mapped assets missing (optional)') : 'No assets mapped (optional)'} />
              <PreflightItem ok={hasTemplate} label="Event template uploaded" />
              <PreflightItem ok={hasMapping} label="Field mapping configured" />
              <PreflightItem ok={hasPreview} label="Preview certificate generated" />
              <PreflightItem ok={previewApproved} label="Preview approved" />
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <div className="w-full border-t pt-4">
              {/* Credits logic moved up */}
            </div>

            <button className="btn-secondary text-sm w-full" disabled={sendMutation.isPending || pendingEmailCount === 0} onClick={() => sendMutation.mutate({ allocateCredits, manualPointsPerCert: allocateCredits ? manualPointsPerCert : undefined })}>
              {sendMutation.isPending ? (<><LoadingSpinner size="sm" label="" /> Sending...</>) : `Approve & Send ${pendingEmailCount} Pending Email${pendingEmailCount !== 1 ? 's' : ''}`}
            </button>
            <button
              className="btn-secondary text-sm w-full"
              disabled={isDownloadingZip || (certs?.length ?? 0) === 0}
              onClick={handleDownloadZip}
            >
              {isDownloadingZip ? (<><LoadingSpinner size="sm" label="" /> Downloading...</>) : 'Download ZIP'}
            </button>
          </div>
        </div>

        {!allReady && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-100 px-4 py-2.5">
            <p className="text-xs text-amber-700">Complete all checklist items in Overview before generating certificates.</p>
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Certificates</h2>
        </div>
        <DataTable
          columns={certColumns}
          data={certs || []}
          isLoading={certsLoading}
          emptyMessage="Complete the checklist above to enable certificate generation."
          searchable
          searchPlaceholder="Search by cert no., email, or name..."
          rowKey="id"
        />
      </div>
    </div>
  )
}
