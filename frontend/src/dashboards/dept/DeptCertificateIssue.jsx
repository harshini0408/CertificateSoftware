import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useToastStore } from '../../store/uiStore'
import { BACKEND_URL } from '../../utils/axiosInstance'
import {
  useDeptEventCertificates,
  useSendDeptEventCertificates,
  useSendSingleDeptEventCertificate,
  useDeptAssets,
  useDeptEventTemplate,
  useDeptEventMapping,
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

export default function DeptCertificateIssue({ event }) {
  const addToast = useToastStore((s) => s.addToast)

  const { data: certs, isLoading: certsLoading } = useDeptEventCertificates(event?.id)
  const { data: assets } = useDeptAssets()
  const { data: eventTemplate } = useDeptEventTemplate(event?.id)
  const { data: mapping } = useDeptEventMapping(event?.id)

  const sendMutation = useSendDeptEventCertificates(event?.id)
  const sendSingleMutation = useSendSingleDeptEventCertificate(event?.id)

  const pendingEmailCount = (certs ?? []).filter((c) => c.status === 'generated').length

  const hasParticipants = (event?.participant_count ?? 0) > 0 || (certs?.length ?? 0) > 0
  const hasAssets = !!(assets?.has_logo && assets?.has_signature)
  const hasTemplate = !!eventTemplate?.template
  const hasMapping = !!mapping?.mapping_configured

  const allReady = hasParticipants && hasAssets && hasTemplate && hasMapping

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
                sendSingleMutation.mutate(certId)
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
          Generation setup is handled in the <span className="font-semibold text-foreground">Overview</span> tab.
          This tab is only for reviewing generated certificates and sending emails.
        </p>
      </div>

      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground mb-3">Pre-flight Checklist</p>
            <div className="space-y-2">
              <PreflightItem ok={hasParticipants} label="Participants imported" />
              <PreflightItem ok={hasAssets} label="Logo & signature uploaded" />
              <PreflightItem ok={hasTemplate} label="Event template uploaded" />
              <PreflightItem ok={hasMapping} label="Field mapping configured" />
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <button className="btn-secondary text-sm" disabled={sendMutation.isPending || pendingEmailCount === 0} onClick={() => sendMutation.mutate()}>
              {sendMutation.isPending ? (<><LoadingSpinner size="sm" label="" /> Sending...</>) : `Approve & Send ${pendingEmailCount} Pending Email${pendingEmailCount !== 1 ? 's' : ''}`}
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
