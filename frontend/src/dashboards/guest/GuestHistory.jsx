import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useToastStore } from '../../store/uiStore'
import axiosInstance from '../../utils/axiosInstance'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'

const DownloadIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
)

const EyeIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
)

const PencilIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
  </svg>
)

const TrashIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
)

function EditSessionModal({ session, onClose }) {
  const addToast = useToastStore((s) => s.addToast)
  const queryClient = useQueryClient()
  const [name, setName] = useState(session?.event_name || '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.patch(`/guest/sessions/${session.session_id}`, { event_name: name.trim() })
      return res.data
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Event name updated successfully.' })
      queryClient.invalidateQueries({ queryKey: ['guestHistory'] })
      queryClient.invalidateQueries({ queryKey: ['guestSessionDetail', session.session_id] })
      onClose()
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to update event name.' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await axiosInstance.delete(`/guest/sessions/${session.session_id}`)
      return res.data
    },
    onSuccess: () => {
      addToast({ type: 'success', message: 'Event session deleted.' })
      queryClient.invalidateQueries({ queryKey: ['guestHistory'] })
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
            className="form-input w-full"
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
            >
              <TrashIcon className="w-3.5 h-3.5" /> Delete Event
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-medium">Are you sure?</span>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
                className="text-xs font-bold text-red-700 hover:underline"
              >
                Yes, Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!name.trim() || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
}

function SessionDetailModal({ sessionId, onClose }) {
  const addToast = useToastStore((s) => s.addToast)
  const queryClient = useQueryClient()

  const sendEmailsMutation = useMutation({
    mutationFn: async (rowIndexes) => {
      const payload = rowIndexes?.length ? { row_indexes: rowIndexes } : undefined
      const res = await axiosInstance.post(`/guest/sessions/${sessionId}/send-emails`, payload)
      return res.data
    },
    onSuccess: async () => {
      addToast({ type: 'success', message: 'Email delivery queued for this session.' })
      await queryClient.invalidateQueries({ queryKey: ['guestSessionDetail', sessionId] })
      await queryClient.invalidateQueries({ queryKey: ['guestHistory'] })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to send emails for this session.' })
    },
  })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['guestSessionDetail', sessionId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/guest/sessions/${sessionId}`)
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-6xl rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Session Details</h3>
            <p className="text-sm text-gray-500">
              {data?.event_name || 'Guest session'} · {data?.created_at ? formatDateTime(data.created_at) : '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => sendEmailsMutation.mutate()}
              disabled={!hasUnsentEmails || sendEmailsMutation.isPending}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendEmailsMutation.isPending ? 'Sending...' : 'Send Unsent Emails'}
            </button>
            <button onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-6">
          {isLoading && <div className="py-16 text-center text-gray-400">Loading certificate details...</div>}
          {isError && <div className="py-16 text-center text-red-500 font-semibold">Failed to load session details.</div>}

          {!isLoading && !isError && data && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Certificates</p>
                  <p className="mt-2 text-2xl font-black text-gray-900">{data.cert_count || 0}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Emails</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{data.emails_sent ? 'Sent' : 'Not sent yet'}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Credit Points</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {data.guest_allocate_points ? `${data.guest_points_per_cert} per certificate` : 'Not enabled'}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Email Column</p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 truncate">{data.email_column || 'Not detected'}</p>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-lg font-bold text-gray-900">Generated Certificates</h4>
                  <span className="text-sm text-gray-500">{data.cert_count || 0} item(s)</span>
                </div>

                {!data.certificates?.length ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center text-gray-500">
                    No certificate files found for this session.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {data.certificates.map((cert) => (
                      <div key={cert.cert_number} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-gray-900">{cert.recipient_name || 'Unnamed recipient'}</p>
                              <p className="text-xs text-gray-500 break-all">{cert.recipient_email || 'No email found'}</p>
                            </div>
                            <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">
                              {cert.cert_number}
                            </span>
                          </div>
                        </div>

                        <div className="p-4 space-y-3">
                          <div className="overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                            <img
                              src={axiosInstance.defaults.baseURL ? `${axiosInstance.defaults.baseURL}${cert.preview_url}` : cert.preview_url}
                              alt={cert.cert_number}
                              className="h-56 w-full object-contain bg-white"
                            />
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Status: <span className="font-semibold text-gray-800">{cert.status || 'generated'}</span></span>
                            <span>{cert.sent_at ? `Sent ${formatDateTime(cert.sent_at)}` : 'Not emailed'}</span>
                          </div>

                          {cert.error && (
                            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{cert.error}</p>
                          )}

                          <div className={`grid gap-2 ${cert.status === 'emailed' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            <a
                              href={axiosInstance.defaults.baseURL ? `${axiosInstance.defaults.baseURL}${cert.preview_url}` : cert.preview_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              <EyeIcon className="h-4 w-4" /> View
                            </a>
                            <a
                              href={axiosInstance.defaults.baseURL ? `${axiosInstance.defaults.baseURL}${cert.preview_url}` : cert.preview_url}
                              download={`${cert.cert_number}.png`}
                              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                            >
                              <DownloadIcon className="h-4 w-4" /> Download
                            </a>
                            {cert.status !== 'emailed' && !cert.sent_at ? (
                              <button
                                type="button"
                                onClick={() => sendEmailsMutation.mutate([cert.index])}
                                disabled={sendEmailsMutation.isPending}
                                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                                title="Send email for this certificate"
                              >
                                Send Email
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function EventHistoryContent({ newSessionUrl = '/guest?new=1', onNewSession, title = 'Certificate History', description }) {
  const addToast = useToastStore((s) => s.addToast)
  const [selectedSessionId, setSelectedSessionId] = useState(null)
  const [editingSession, setEditingSession] = useState(null)

  const { data: sessions, isLoading, isError, refetch } = useQuery({
    queryKey: ['guestHistory'],
    queryFn: async () => {
      const res = await axiosInstance.get('/guest/history')
      return res.data
    },
  })

  const handleDownloadZip = async (sessionId, eventName) => {
    try {
      const resp = await axiosInstance.get(`/guest/sessions/${sessionId}/zip`, { responseType: 'blob' })
      const url = URL.createObjectURL(resp.data)
      const a = document.createElement('a')
      a.href = url
      const safeName = (eventName || 'event').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)
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
        <div className="text-gray-400">Loading history...</div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex justify-center py-24">
        <div className="text-red-500 font-semibold">Failed to load history.</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">
            {description || 'Access and manage certificates from your previous events. Data expires and is securely deleted after 15 days.'}
          </p>
        </div>
        {onNewSession ? (
          <button
            onClick={onNewSession}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition shrink-0"
          >
            + New Event Certificates
          </button>
        ) : newSessionUrl ? (
          <Link
            to={newSessionUrl}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition shrink-0"
          >
            + New Session
          </Link>
        ) : null}
      </div>

      {!sessions || sessions.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center">
          <p className="text-gray-500 mb-4">No certificate history yet.</p>
          {onNewSession ? (
            <button
              onClick={onNewSession}
              className="text-indigo-600 font-semibold hover:underline"
            >
              Start generating certificates.
            </button>
          ) : newSessionUrl ? (
            <Link
              to={newSessionUrl}
              className="text-indigo-600 font-semibold hover:underline"
            >
              Start a new session from the dashboard.
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <div key={session.session_id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 pt-4 flex items-center gap-1.5">
                <button
                  onClick={() => setEditingSession(session)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                  title="Edit event name"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                </button>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  session.days_remaining > 5
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {session.days_remaining} {session.days_remaining === 1 ? 'day' : 'days'} left
                </span>
              </div>
              
              <div className="mb-4 pr-24">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-gray-900 truncate" title={session.event_name}>
                    {session.event_name}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Created {new Date(session.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>

              <div className="flex-1 space-y-3 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-gray-50 border border-gray-200 flex items-center justify-center">
                    <span className="text-xs text-gray-600 font-bold whitespace-nowrap">
                      {session.cert_count}
                    </span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {session.cert_count === 1 ? 'certificate generated' : 'certificates generated'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`flex w-3 h-3 rounded-full ${session.emails_sent ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                  <span className={`text-sm ${session.emails_sent ? 'text-gray-800' : 'text-gray-500'}`}>
                    {session.emails_sent ? 'Emails sent' : 'Emails not sent'}
                  </span>
                </div>
              </div>

              {session.has_downloadable_certs ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedSessionId(session.session_id)}
                    className="flex items-center justify-center gap-2 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition"
                    title="View certificate details"
                  >
                    <EyeIcon className="w-4 h-4" /> View Details
                  </button>
                  <button
                    onClick={() => handleDownloadZip(session.session_id, session.event_name)}
                    className="flex items-center justify-center gap-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
                    title="Download ZIP archive"
                  >
                    <DownloadIcon className="w-4 h-4" /> Download ZIP
                  </button>
                </div>
              ) : (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm font-medium text-gray-400 cursor-not-allowed"
                >
                  No cert files
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedSessionId && (
        <SessionDetailModal sessionId={selectedSessionId} onClose={() => setSelectedSessionId(null)} />
      )}
      {editingSession && (
        <EditSessionModal session={editingSession} onClose={() => setEditingSession(null)} />
      )}
    </div>
  )
}

export default function GuestHistory() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <EventHistoryContent newSessionUrl="/guest?new=1" title="Certificate History" />
          </div>
        </main>
      </div>
    </div>
  )
}
