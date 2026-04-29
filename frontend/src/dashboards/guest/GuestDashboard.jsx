import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useToastStore } from '../../store/uiStore'
import axiosInstance from '../../utils/axiosInstance'
import GuestWizard from '../../components/GuestWizard'
import LoadingSpinner from '../../components/LoadingSpinner'
import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'

export default function GuestDashboard() {
  const user = useAuthStore((s) => s.user)
  const addToast = useToastStore((s) => s.addToast)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [eventName, setEventName] = useState('')
  const [submittedName, setSubmittedName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const forceFresh = searchParams.get('new') === '1' || searchParams.get('home') === '1'
  const [isRestoring, setIsRestoring] = useState(!forceFresh)

  useEffect(() => {
    if (forceFresh) {
      setSubmittedName('')
      setIsRestoring(false)
    }
  }, [forceFresh])

  useEffect(() => {
    if (forceFresh) return
    let mounted = true

    const restoreSession = async () => {
      try {
        const { data } = await axiosInstance.get('/guest/status')
        if (mounted && data?.event_name) {
          setSubmittedName(data.event_name)
        }
      } catch {
        // No active session; stay on the start form.
      } finally {
        if (mounted) setIsRestoring(false)
      }
    }

    restoreSession()
    return () => {
      mounted = false
    }
  }, [])

  // Start fresh wrapper
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
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to start session.'
      addToast({ type: 'error', message: msg })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isRestoring) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6 flex justify-center py-24">
            <LoadingSpinner label="Restoring session..." />
          </main>
        </div>
      </div>
    )
  }

  // Once a session is successfully created and we have the submittedName,
  // we step directly into the Wizard.
  if (submittedName) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <div className="mb-6 border-b border-gray-100 pb-4">
                  <h2 className="text-xl font-semibold">Event: {submittedName}</h2>
                  <p className="text-sm text-gray-500">
                    Follow the steps below to upload templates and generate bulk certificates.
                  </p>
                </div>
                <GuestWizard eventName={submittedName} />
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // The initial event name form
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl border border-gray-100 shadow-sm mt-12">
              <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome, {user || 'Guest'}! Let's get started.</h1>
          <p className="text-sm text-gray-500">
            Enter a descriptive name for your certificate-generation event.
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
              placeholder="e.g. Annual Tech Symposium 2024"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              className="w-full form-input px-4 py-3 rounded-xl border-gray-300 shadow-sm focus:border-indigo-500 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || eventName.trim().length < 3}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? <><LoadingSpinner size="sm" label="" /> Starting…</> : 'Continue →'}
          </button>
        </form>

              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-500">
                  Looking for past certificates?
                  <button
                    onClick={() => navigate('/guest/history')}
                    className="ml-2 text-indigo-600 font-semibold hover:underline"
                  >
                    View History
                  </button>
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
