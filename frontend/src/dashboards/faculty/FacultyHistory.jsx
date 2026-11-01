/**
 * FacultyHistory.jsx — Event history for Faculty Certificate Generation.
 *
 * Exclusively uses /faculty/* endpoints (completely decoupled from /guest/*).
 */
import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useToastStore } from '../../store/uiStore'
import axiosInstance, { BACKEND_URL } from '../../utils/axiosInstance'

function resolveImgSrc(url) {
  if (!url) return null
  if (url.startsWith('blob:') || url.startsWith('http')) return url
  return `${BACKEND_URL}${url}`
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

const DownloadIcon = ({ className = 'w-4 h-4' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const EyeIcon = ({ className = 'w-4 h-4' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const PencilIcon = ({ className = 'w-4 h-4' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
)

function CertificateViewModal({ cert, onClose }) {
  if (!cert) return null
  const previewSrc = resolveImgSrc(cert.preview_url)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
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
            >
              ✕
            </button>
          </div>
        </div>

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

function EditSessionModal({ session, onClose }) {
  const addToast = useToastStore((s) => s.addToast)
  const queryClient = useQueryClient()
  const [name, setName] = useState(session?.event_name || '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.patch(`/faculty/sessions/${session.session_id}`, { event_name: name.trim() })
      return res.data
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Event name updated successfully.' })
      queryClient.invalidateQueries({ queryKey: ['facultyHistory'] })
      queryClient.invalidateQueries({ queryKey: ['facultySessionDetail', session.session_id] })
      onClose()
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to update event name.' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.delete(`/faculty/sessions/${session.session_id}`)
      return res.data
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Event session deleted.' })
      queryClient.invalidateQueries({ queryKey: ['facultyHistory'] })
      onClose()
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to delete event session.' })
    },
  })

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-lg font-bold text-gray-900">Edit Event</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Event Name
          </label>
          <input
            type="text"
            className="form-input w-full rounded-xl border-gray-300 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter event name..."
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs font-semibold text-red-600 hover:text-red-700"
            >
              Delete Event
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-500"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending || !name.trim()}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SessionDetailModal({ sessionId, onClose }) {
  const addToast = useToastStore((s) => s.addToast)
  const queryClient = useQueryClient()
  const [viewingCert, setViewingCert] = useState(null)

  const sendEmailsMutation = useMutation({
    mutationFn: async (rowIndexes) => {
      const payload = rowIndexes?.length ? { row_indexes: rowIndexes } : undefined
      const res = await axiosInstance.post(`/faculty/sessions/${sessionId}/send-emails`, payload)
      return res.data
    },
    onSuccess: async () => {
      addToast({ type: 'success', message: 'Email delivery queued for this session.' })
      await queryClient.invalidateQueries({ queryKey: ['facultySessionDetail', sessionId] })
      await queryClient.invalidateQueries({ queryKey: ['facultyHistory'] })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to send emails.' })
    },
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['facultySessionDetail', sessionId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/faculty/sessions/${sessionId}`)
      return res.data
    },
    enabled: !!sessionId,
  })

  const sendableCertificates = (data?.certificates || []).filter((cert) => {
    const status = (cert?.status || 'generated').toLowerCase()
    return status !== 'emailed' && !cert?.sent_at
  })
  const hasUnsentEmails = sendableCertificates.length > 0

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-6xl rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4 bg-gray-50">
            <div>
              <h3 className="text-xl font-bold text-gray-900">{data?.event_name || 'Faculty Event Session'}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Created {data?.created_at ? formatDateTime(data.created_at) : '—'} · {data?.cert_count || 0} certificates
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => sendEmailsMutation.mutate()}
                disabled={!hasUnsentEmails || sendEmailsMutation.isPending}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 cursor-pointer"
              >
                {sendEmailsMutation.isPending ? 'Sending...' : 'Send Unsent Emails'}
              </button>
              <button onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 cursor-pointer">
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoading && <div className="py-16 text-center text-gray-400">Loading certificate details...</div>}
            {isError && <div className="py-16 text-center text-red-500 font-semibold">Failed to load session details.</div>}

            {!isLoading && !isError && data && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Certificates</p>
                    <p className="mt-1 text-2xl font-black text-gray-900">{data.cert_count || 0}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Email Dispatch</p>
                    <p className="mt-1 text-sm font-semibold text-gray-800">{data.emails_sent ? 'Dispatched' : 'Pending'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Credit Points</p>
                    <p className="mt-1 text-sm font-semibold text-gray-800">
                      {data.guest_allocate_points ? `${data.guest_points_per_cert} pts` : 'None'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Days Remaining</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-700">{data.days_remaining} days left</p>
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Generated Certificates</h4>
                    <span className="text-xs text-gray-500">{data.cert_count || 0} item(s)</span>
                  </div>

                  {!data.certificates?.length ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-gray-500 text-sm">
                      No certificate files found for this session.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-3">#</th>
                            <th className="px-4 py-3">Cert Number</th>
                            <th className="px-4 py-3">Recipient Name</th>
                            <th className="px-4 py-3">Email Address</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {data.certificates.map((cert, idx) => (
                            <tr key={cert.cert_number || idx} className="hover:bg-indigo-50/20 transition-colors">
                              <td className="px-4 py-3 text-xs text-gray-400 font-mono">{idx + 1}</td>
                              <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-700">
                                {cert.cert_number}
                              </td>
                              <td className="px-4 py-3 font-semibold text-gray-900">
                                {cert.recipient_name || '—'}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-600">
                                {cert.recipient_email || '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  cert.status === 'emailed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {cert.status || 'generated'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setViewingCert(cert)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition shadow-xs cursor-pointer"
                                    title="View certificate"
                                  >
                                    <EyeIcon className="w-4 h-4" /> View
                                  </button>
                                  {cert.preview_url && (
                                    <a
                                      href={resolveImgSrc(cert.preview_url)}
                                      download={`${cert.cert_number}.png`}
                                      className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                                      title="Download PNG"
                                    >
                                      <DownloadIcon className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  {cert.status !== 'emailed' && (
                                    <button
                                      type="button"
                                      onClick={() => sendEmailsMutation.mutate([cert.index])}
                                      disabled={sendEmailsMutation.isPending}
                                      className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold hover:bg-amber-100 transition"
                                    >
                                      Email
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {viewingCert && (
        <CertificateViewModal
          cert={viewingCert}
          onClose={() => setViewingCert(null)}
        />
      )}
    </>
  )
}

export function FacultyEventHistoryContent({ onNewSession }) {
  const addToast = useToastStore((s) => s.addToast)
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [editingSession, setEditingSession] = useState(null)

  const { data: sessions, isLoading, isError, refetch } = useQuery({
    queryKey: ['facultyHistory'],
    queryFn: async () => {
      const res = await axiosInstance.get('/faculty/history')
      return res.data
    },
  })

  const handleDownloadZip = async (sessionId, eventName) => {
    try {
      const resp = await axiosInstance.get(`/faculty/sessions/${sessionId}/zip`, { responseType: 'blob' })
      const url = URL.createObjectURL(resp.data)
      const a = document.createElement('a')
      a.href = url
      const safeName = (eventName || 'faculty_event').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)
      a.download = `${safeName}_certificates.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Download failed or session expired.' })
      refetch()
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="text-gray-400">Loading faculty history...</div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex justify-center py-24">
        <div className="text-red-500 font-semibold">Failed to load event history.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Faculty Event History</h1>
          <p className="text-sm text-gray-500">
            View past certificate batches, preview individual certificates, download ZIP packages, or send emails.
          </p>
        </div>
        {onNewSession && (
          <button
            onClick={onNewSession}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition shrink-0 cursor-pointer shadow-xs"
          >
            + Generate New Certificates
          </button>
        )}
      </div>

      {!sessions || sessions.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center">
          <p className="text-gray-500 mb-4">No faculty certificate events generated yet.</p>
          {onNewSession && (
            <button
              onClick={onNewSession}
              className="text-indigo-600 font-semibold hover:underline cursor-pointer"
            >
              Start generating institutional certificates →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <div key={session.session_id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-full relative overflow-hidden">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0 pr-2">
                  <h3 className="font-bold text-gray-900 truncate text-base" title={session.event_name}>
                    {session.event_name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Created {new Date(session.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setEditingSession(session)}
                    className="p-1 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                    title="Edit event name"
                  >
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    session.days_remaining > 5
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {session.days_remaining}d left
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-gray-50">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Certificates: <strong className="text-gray-900">{session.cert_count}</strong></span>
                  <span>Emails: <strong className={session.emails_sent ? 'text-emerald-600' : 'text-gray-500'}>
                    {session.emails_sent ? 'Dispatched' : 'Pending'}
                  </strong></span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setSelectedSessionId(session.session_id)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition cursor-pointer"
                  >
                    <EyeIcon className="w-3.5 h-3.5" /> View Details
                  </button>
                  <button
                    onClick={() => handleDownloadZip(session.session_id, session.event_name)}
                    disabled={!session.has_downloadable_certs}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50 transition cursor-pointer shadow-xs"
                  >
                    <DownloadIcon className="w-3.5 h-3.5" /> Download ZIP
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedSessionId && (
        <SessionDetailModal
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}

      {editingSession && (
        <EditSessionModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
        />
      )}
    </div>
  )
}
