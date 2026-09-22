import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useToastStore } from '../../store/uiStore'
import axiosInstance from '../../utils/axiosInstance'
import GuestWizard from '../../components/GuestWizard'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function FacultyCertificateGenerator({ forceNew = false, onCompleteSession }) {
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)

  const [eventName, setEventName] = useState('')
  const [submittedName, setSubmittedName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRestoring, setIsRestoring] = useState(!forceNew)

  useEffect(() => {
    if (forceNew) {
      setSubmittedName('')
      setIsRestoring(false)
      return
    }

    let mounted = true
    const restoreSession = async () => {
      setIsRestoring(true)
      try {
        const { data } = await axiosInstance.get('/guest/status')
        if (mounted && data?.event_name) {
          setSubmittedName(data.event_name)
        } else if (mounted) {
          setSubmittedName('')
        }
      } catch {
        if (mounted) setSubmittedName('')
      } finally {
        if (mounted) setIsRestoring(false)
      }
    }

    restoreSession()
    return () => {
      mounted = false
    }
  }, [forceNew])

  const handleStartSession = async (e) => {
    e.preventDefault()
    const trimmed = eventName.trim()
    if (trimmed.length < 3) {
      addToast({ type: 'warning', message: 'Event name must be at least 3 characters long.' })
      return
    }

    setIsSubmitting(true)
    try {
      await axiosInstance.post('/guest/start-session', { event_name: trimmed })
      setSubmittedName(trimmed)
      addToast({ type: 'success', message: `Started event: ${trimmed}` })
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to start session.'
      addToast({ type: 'error', message: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetSession = () => {
    setSubmittedName('')
    setEventName('')
  }

  if (isRestoring) {
    return (
      <div className="flex justify-center py-24">
        <LoadingSpinner label="Checking for active session..." />
      </div>
    )
  }

  if (submittedName) {
    return (
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Active Event
              </span>
              <h2 className="text-xl font-bold text-gray-900">{submittedName}</h2>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Upload certificate template, match student fields from Excel, allocate credit points, and generate certificates.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetSession}
            className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 shrink-0"
          >
            + Start Another Event
          </button>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <GuestWizard eventName={submittedName} />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl border border-gray-100 shadow-sm my-6">
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          🎓
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Generate Certificates</h1>
        <p className="text-sm text-gray-500">
          Enter your event name to begin generating institutional certificates for your participants.
        </p>
      </div>

      <form onSubmit={handleStartSession} className="space-y-6">
        <div>
          <label htmlFor="event-name" className="block text-sm font-semibold text-gray-800 mb-2">
            Event Name <span className="text-red-500">*</span>
          </label>
          <input
            id="event-name"
            type="text"
            required
            minLength={3}
            maxLength={100}
            placeholder="e.g. AI & Machine Learning Workshop 2024"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className="w-full form-input px-4 py-3 rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1">This will identify your certificate batch in event history.</p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || eventName.trim().length < 3}
          className="w-full flex items-center justify-center py-3.5 px-6 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all cursor-pointer"
        >
          {isSubmitting ? 'Initializing…' : 'Start Certificate Flow →'}
        </button>
      </form>
    </div>
  )
}
