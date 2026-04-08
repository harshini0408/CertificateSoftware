import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useToastStore } from '../store/uiStore'
import axiosInstance from '../utils/axiosInstance'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'

const DownloadIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="7 10 12 15 17 10"></polyline>
    <line x1="12" y1="15" x2="12" y2="3"></line>
  </svg>
)

export default function GuestHistory() {
  const addToast = useToastStore((s) => s.addToast)

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
      // Use event name safely
      const safeName = eventName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50)
      a.download = `${safeName}_certificates.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Download failed or session expired.' })
      // Auto-refetch to update UI if it became expired
      refetch()
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6 flex justify-center py-24">
            <div className="text-gray-400">Loading history...</div>
          </main>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6 flex justify-center py-24">
            <div className="text-red-500 font-semibold">Failed to load history.</div>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Certificate History</h1>
          <p className="text-sm text-gray-500">
            Access certificates from your previous sessions. Data expires and is securely deleted after 15 days.
          </p>
        </div>
        <Link
          to="/guest"
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
        >
          + New Session
        </Link>
      </div>

      {!sessions || sessions.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center">
          <p className="text-gray-500 mb-4">No certificate history yet.</p>
          <Link
            to="/guest"
            className="text-indigo-600 font-semibold hover:underline"
          >
            Start a new session from the dashboard.
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <div key={session.session_id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 pt-4">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                  session.days_remaining > 5
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {session.days_remaining} {session.days_remaining === 1 ? 'day' : 'days'} left
                </span>
              </div>
              
              <div className="mb-4 pr-24">
                <h3 className="font-bold text-gray-900 truncate" title={session.event_name}>
                  {session.event_name}
                </h3>
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
                <button
                  onClick={() => handleDownloadZip(session.session_id, session.event_name)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
                  title="Download ZIP archive"
                >
                  <DownloadIcon className="w-4 h-4" /> Download ZIP
                </button>
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
          </div>
        </main>
      </div>
    </div>
  )
}
