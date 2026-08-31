import { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams, useParams, useNavigate } from 'react-router-dom'
import jsQR from 'jsqr'

import Navbar from '../../components/Navbar'
import Sidebar from '../../components/Sidebar'
import DataTable from '../../components/DataTable'
import StatusBadge from '../../components/StatusBadge'
import StatCard from '../../components/StatCard'
import LoadingSpinner from '../../components/LoadingSpinner'
import axiosInstance, { BACKEND_URL } from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'
import {
  useMyCredits,
  useMyCertificates,
  useCreateManualCreditSubmission,
  useMyManualCreditSubmissions,
  useMyProfile,
  useStudentCreditRules,
  useMyClubMemberships,
  useApplyForClub,
  useAvailableClubs,
  useStudentUpcomingEvents,
  useRegisterForEvent,
  useCancelEventRegistration,
  useValidateAttendanceQR,
  useAttendanceSession,
  useSubmitAttendance,
  useUpdateStudentRegNo,
} from './api'
import { useChangePassword } from '../auth/api'

// ── QR Camera Scanner ─────────────────────────────────────────────────────────
function AttendanceScannerView({ event, onScanned, onCancel, onError }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraError, setCameraError] = useState(null)
  const [scanning, setScanning] = useState(true)

  const stopStream = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        const tick = () => {
          if (cancelled) return
          const video = videoRef.current
          const canvas = canvasRef.current
          if (!video || !canvas || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(tick)
            return
          }
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          ctx.drawImage(video, 0, 0)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)
          if (code && code.data) {
            setScanning(false)
            stopStream()
            onScanned(code.data)
          } else {
            rafRef.current = requestAnimationFrame(tick)
          }
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch (err) {
        if (!cancelled) setCameraError('Camera access denied. Please allow camera permission and try again.')
      }
    }
    startCamera()
    return () => { cancelled = true; stopStream() }
  }, [onScanned, stopStream])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => { stopStream(); onCancel() }}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          title="Back"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-bold text-foreground">Mark Attendance</h2>
          <p className="text-xs text-gray-500 line-clamp-1">{event?.name}</p>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        {cameraError ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-red-700">Camera Unavailable</p>
              <p className="text-xs text-gray-500 mt-1">{cameraError}</p>
            </div>
            <button type="button" onClick={() => { stopStream(); onCancel() }} className="btn-secondary">
              Go Back
            </button>
          </div>
        ) : (
          <>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Point your camera at the QR code shown by the event coordinator.</p>
              <p className="text-xs text-gray-500 mt-1">The QR code is only valid for <strong>45 seconds</strong> after it is generated.</p>
            </div>

            {/* Camera viewfinder */}
            <div className="relative mx-auto w-full max-w-xs aspect-square rounded-xl overflow-hidden border-2 border-navy/20 bg-black">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
              {/* Scan frame overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-navy rounded-tl-md" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-navy rounded-tr-md" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-navy rounded-bl-md" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-navy rounded-br-md" />
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-navy/60 animate-[scan_2s_linear_infinite]" />
                </div>
              </div>
              {!scanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              )}
            </div>
            {/* Hidden canvas for jsQR processing */}
            <canvas ref={canvasRef} className="hidden" />
          </>
        )}
      </div>
    </div>
  )
}

// ── Attendance Session View (Dedicated Page, No Time Limit) ──────────────────
function AttendanceSessionView({ eventId, token }) {
  const navigate = useNavigate()
  const { data: sessionInfo, isLoading, error } = useAttendanceSession(eventId, token)
  const submitAttendance = useSubmitAttendance()
  const [feedback, setFeedback] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitData, setSubmitData] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const result = await submitAttendance.mutateAsync({
        eventId,
        token,
        feedback: feedback.trim() || null,
      })
      setSubmitData(result)
      setSubmitted(true)
    } catch (err) {
      // toast shown by hook
    }
  }

  if (isLoading) {
    return (
      <div className="card p-12 flex flex-col items-center justify-center gap-3">
        <LoadingSpinner label="Validating attendance session…" />
      </div>
    )
  }

  if (error || !sessionInfo) {
    const errMsg = error?.response?.data?.detail || 'This attendance session is invalid, expired, or has already been used.'
    return (
      <div className="space-y-4 max-w-xl mx-auto">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/student?tab=upcoming')}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h2 className="text-lg font-bold text-foreground">Attendance Session Error</h2>
        </div>
        <div className="card p-8 flex flex-col items-center gap-5 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <p className="text-base font-bold text-red-700">Invalid or Used Session</p>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">{errMsg}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/student?tab=upcoming')}
            className="btn-primary w-full justify-center"
          >
            Back to Events
          </button>
        </div>
      </div>
    )
  }

  if (submitted && submitData) {
    return (
      <div className="space-y-4 max-w-xl mx-auto">
        <div className="card p-8 flex flex-col items-center gap-5 text-center">
          <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center border-2 border-green-200">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-green-700">Attendance Marked!</h2>
            <p className="text-sm text-gray-600 mt-1">{submitData.message}</p>
          </div>
          <div className="w-full rounded-xl border border-gray-100 bg-gray-50 p-4 text-left space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Event Details</p>
            <p className="text-sm font-bold text-foreground">{submitData.event_name}</p>
            <p className="text-xs text-gray-500">Recorded at: {submitData.marked_at}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/student?tab=upcoming')}
            className="btn-primary w-full justify-center"
          >
            Back to Events
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/student?tab=upcoming')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          title="Back to Dashboard"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h2 className="text-lg font-bold text-foreground">Confirm Event Attendance</h2>
          <p className="text-xs text-green-600 font-semibold">✓ QR verified • No time limit for feedback</p>
        </div>
      </div>

      {/* Event info card */}
      <div className="card p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-navy/10 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-foreground line-clamp-2">{sessionInfo.event_name}</p>
            {sessionInfo.club_name && (
              <p className="text-xs text-gray-500 font-semibold mt-0.5">{sessionInfo.club_name}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
              {sessionInfo.event_date && <span>📅 {new Date(sessionInfo.event_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
              {sessionInfo.venue && <span>📍 {sessionInfo.venue}</span>}
            </div>
          </div>
        </div>

        {/* Verified banner */}
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs font-semibold text-green-700">
            QR scanned within 20 seconds. Enter feedback and click submit below.
          </span>
        </div>
      </div>

      {/* Feedback form */}
      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        <div>
          <label className="form-label" htmlFor="attendance-feedback">
            Share your feedback about the event
          </label>
          <textarea
            id="attendance-feedback"
            rows={4}
            placeholder="What did you learn? How was the event organized? (optional)"
            className="form-input mt-1 resize-none"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">Your feedback is submitted with your attendance record.</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/student?tab=upcoming')}
            className="btn-secondary flex-1 justify-center"
            disabled={submitAttendance.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 justify-center"
            disabled={submitAttendance.isPending}
          >
            {submitAttendance.isPending ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent inline-block mr-2" />Submitting…</>
            ) : 'Confirm & Mark Attendance'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Icon helpers ──────────────────────────────────────────────────────────────
const Icons = {
  cert: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  star: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
}

// ── Credit type badge colours ─────────────────────────────────────────────────
const TYPE_COLORS = {
  guest:       'bg-violet-100 text-violet-700',
  participant: 'bg-blue-100 text-blue-700',
  coordinator: 'bg-gray-100 text-gray-600',
  winner_1st:  'bg-amber-100 text-amber-700',
  winner_2nd:  'bg-gray-100 text-gray-600',
  winner_3rd:  'bg-orange-100 text-orange-700',
  mentor:      'bg-green-100 text-green-700',
  judge:       'bg-red-100 text-red-700',
  volunteer:   'bg-teal-100 text-teal-700',
}

// ── Credits breakdown bar ─────────────────────────────────────────────────────
function normalizeCertType(value) {
  return (value || '').toLowerCase().replace(/-/g, '_').replace(/\s+/g, '_')
}

function CreditsBreakdown({ breakdown, total, creditRules, rulesLoading }) {
  if (!breakdown?.length) return null

  const PALETTE = [
    '#1E3A5F', '#C9A84C', '#3B82F6', '#10B981',
    '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4',
  ]

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Credit Breakdown</h2>
        <span className="text-2xl font-black text-navy">{total}</span>
      </div>

      <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
        {breakdown.map((item, i) => {
          const pct = total > 0 ? (item.credits / total) * 100 : 0
          if (pct < 1) return null
          return (
            <div
              key={item.cert_type}
              title={`${item.cert_type}: ${item.credits} credits`}
              style={{ width: `${pct}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
              className="rounded-sm transition-all duration-500"
            />
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {breakdown.map((item, i) => (
          <div key={item.cert_type} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
            />
            <span className="text-xs text-gray-600 capitalize truncate">
              {item.cert_type.replace(/_/g, ' ')}
            </span>
            <span className="text-xs font-bold text-navy ml-auto">{item.credits}</span>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-1.5">Credit weights per cert type:</p>
        <div className="flex flex-wrap gap-2">
          {rulesLoading && (
            <span className="text-[10px] text-gray-400">Loading credit rules...</span>
          )}
          {!rulesLoading && !(creditRules || []).length && (
            <span className="text-[10px] text-gray-400">No credit rules configured.</span>
          )}
          {!rulesLoading && (creditRules || []).map((rule) => {
            const type = rule?.cert_type || ''
            const normalizedType = normalizeCertType(type)
            return (
              <span
                key={type}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium
                  ${TYPE_COLORS[normalizedType] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {type.replace(/_/g, ' ')} × {rule?.points ?? 0}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StudentSettingsTab({ profile, profileLoading }) {
  const updateRegNo = useUpdateStudentRegNo()
  const changePassword = useChangePassword()

  const [newRegNo, setNewRegNo] = useState('')
  const [regNoError, setRegNoError] = useState('')

  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [pwError, setPwError] = useState('')

  const handleRegNoSubmit = (e) => {
    e.preventDefault()
    const clean = newRegNo.trim()
    if (!clean) {
      setRegNoError('Please enter your 12-digit registration number.')
      return
    }
    if (!/^\d{12}$/.test(clean)) {
      setRegNoError('Registration number must be exactly 12 numeric digits (e.g. 715522104001).')
      return
    }
    setRegNoError('')
    updateRegNo.mutate(clean, {
      onSuccess: () => {
        setNewRegNo('')
      },
    })
  }

  const handlePwSubmit = (e) => {
    e.preventDefault()
    if (!pwForm.current_password || !pwForm.new_password || !pwForm.confirm_password) {
      setPwError('Please fill in all password fields.')
      return
    }
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError('New passwords do not match.')
      return
    }
    if (pwForm.new_password.length < 6) {
      setPwError('New password must be at least 6 characters.')
      return
    }
    setPwError('')
    changePassword.mutate(
      {
        current_password: pwForm.current_password,
        new_password: pwForm.new_password,
      },
      {
        onSuccess: () => {
          setPwForm({ current_password: '', new_password: '', confirm_password: '' })
        },
      }
    )
  }

  if (profileLoading) return <LoadingSpinner fullPage label="Loading settings..." />

  const canUpdate = profile?.can_update_reg_no

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings & Profile</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Manage your account profile and registration details.
        </p>
      </div>

      {/* Account Info */}
      <div className="card p-6 space-y-4">
        <h2 className="section-title">Profile Information</h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase text-gray-400">Full Name</dt>
            <dd className="text-sm font-medium text-foreground mt-0.5">{profile?.name || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-gray-400">Email Address (Permanent ID)</dt>
            <dd className="text-sm font-medium text-foreground mt-0.5">{profile?.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-gray-400">Department</dt>
            <dd className="text-sm font-medium text-foreground mt-0.5">{profile?.department || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase text-gray-400">Batch & Section</dt>
            <dd className="text-sm font-medium text-foreground mt-0.5">
              {(profile?.batch || '')} {profile?.section ? `(${profile.section})` : ''}
            </dd>
          </div>
        </dl>
      </div>

      {/* Registration Number Management */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Registration Number</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Your official academic identifier used for certificates and credit tracking.
            </p>
          </div>
          {canUpdate ? (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              Temporary Number
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
              ✓ Verified 12-Digit
            </span>
          )}
        </div>

        {canUpdate ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-amber-800 font-bold text-sm">⚠ Temporary Register Number Assigned</span>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                You are currently registered with a temporary ID (<strong className="font-mono">{profile?.registration_number || profile?.username}</strong>).
                When you receive your official 12-digit university registration number, enter it below.
                <strong className="block mt-1">IMPORTANT: This register number can be updated only ONCE. Once submitted, it cannot be changed again by you.</strong>
              </p>
            </div>

            <form onSubmit={handleRegNoSubmit} className="space-y-3">
              <div>
                <label className="form-label" htmlFor="student-reg-no-input">
                  New 12-Digit Registration Number *
                </label>
                <input
                  id="student-reg-no-input"
                  type="text"
                  maxLength={12}
                  value={newRegNo}
                  onChange={(e) => {
                    setNewRegNo(e.target.value.replace(/\D/g, ''))
                    setRegNoError('')
                  }}
                  placeholder="e.g. 715522104001"
                  className={`form-input font-mono text-sm ${regNoError ? 'border-red-500' : ''}`}
                />
                {regNoError && <p className="form-error mt-1">{regNoError}</p>}
                <p className="text-[11px] text-gray-400 mt-1">Must be exactly 12 numeric digits.</p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={updateRegNo.isPending || !newRegNo || newRegNo.length !== 12}
                  className="btn-primary text-xs py-2 px-4"
                >
                  {updateRegNo.isPending ? 'Updating…' : 'Update Register Number (1-Time)'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 p-4">
            <div>
              <p className="text-xs text-gray-400 uppercase font-semibold">Current Register Number</p>
              <p className="text-base font-mono font-bold text-navy mt-0.5">{profile?.registration_number || '—'}</p>
            </div>
            <span className="text-xs text-gray-500 italic">
              {profile?.student_reg_no_change_count > 0 ? 'Updated by student' : 'Permanent 12-digit registered'}
            </span>
          </div>
        )}
      </div>

      {/* Change Password */}
      <div className="card p-6 space-y-4">
        <h2 className="section-title">Change Password</h2>
        <form onSubmit={handlePwSubmit} className="space-y-3">
          {pwError && <p className="form-error">{pwError}</p>}
          <div>
            <label className="form-label">Current Password *</label>
            <input
              type="password"
              value={pwForm.current_password}
              onChange={(e) => setPwForm((p) => ({ ...p, current_password: e.target.value }))}
              className="form-input text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">New Password *</label>
              <input
                type="password"
                value={pwForm.new_password}
                onChange={(e) => setPwForm((p) => ({ ...p, new_password: e.target.value }))}
                className="form-input text-sm"
              />
            </div>
            <div>
              <label className="form-label">Confirm New Password *</label>
              <input
                type="password"
                value={pwForm.confirm_password}
                onChange={(e) => setPwForm((p) => ({ ...p, confirm_password: e.target.value }))}
                className="form-input text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={changePassword.isPending}
              className="btn-primary text-xs py-2 px-4"
            >
              {changePassword.isPending ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function StudentDashboard() {
  const [searchParams] = useSearchParams()
  const { eventId: routeEventId, token: routeToken } = useParams()
  const navigate = useNavigate()
  const activeTab = searchParams.get('tab') || 'certificates'

  const [downloadingId, setDownloadingId] = useState(null)
  const [uploadForm, setUploadForm] = useState({ cert_type: '', event_date: '', certificate_image: null })
  const addToast = useToastStore((s) => s.addToast)

  const { data: profile,  isLoading: profileLoading  } = useMyProfile()
  const { data: credits,  isLoading: creditsLoading  } = useMyCredits()
  const { data: certs,    isLoading: certsLoading    } = useMyCertificates()
  const { data: creditRules, isLoading: rulesLoading } = useStudentCreditRules()
  const { data: manualSubmissions, isLoading: submissionsLoading } = useMyManualCreditSubmissions()
  const { data: clubMemberships, isLoading: membershipsLoading } = useMyClubMemberships()
  const { data: availableClubs } = useAvailableClubs()
  const { data: upcomingEvents, isLoading: upcomingLoading } = useStudentUpcomingEvents()
  const applyForClub = useApplyForClub()
  const createSubmission = useCreateManualCreditSubmission()
  const registerForEvent = useRegisterForEvent()
  const cancelEventRegistration = useCancelEventRegistration()
  const validateQR = useValidateAttendanceQR()

  const [selectedClubId, setSelectedClubId] = useState('')
  const [registeringEventId, setRegisteringEventId] = useState(null)
  const [cancellingEventId, setCancellingEventId] = useState(null)
  const [eventSearch, setEventSearch] = useState('')
  const [eventCategoryFilter, setEventCategoryFilter] = useState('')

  // ── Attendance scanner state ──────────────────────────────────────────────
  // 'idle' | 'scanning' | 'scan_error'
  const [attendanceView, setAttendanceView] = useState('idle')
  const [attendanceEvent, setAttendanceEvent] = useState(null)
  const [scanError, setScanError] = useState(null)

  const openScanner = (ev) => {
    setScanError(null)
    setAttendanceEvent(ev)
    setAttendanceView('scanning')
  }

  const closeAttendance = () => {
    setAttendanceView('idle')
    setAttendanceEvent(null)
    setScanError(null)
  }

  const handleQRScanned = useCallback(async (rawPayload) => {
    setScanError(null)
    try {
      const result = await validateQR.mutateAsync({
        eventId: attendanceEvent.id,
        qr_payload: rawPayload,
      })
      // QR successfully validated within 20s! Redirect to the unique event+student attendance page
      closeAttendance()
      navigate(`/student/attendance/${attendanceEvent.id}/${result.token}`)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Invalid or expired QR code. Please try again.'
      setScanError(msg)
      setAttendanceView('scan_error')
    }
  }, [attendanceEvent, validateQR, navigate])

  const handleRegister = (eventId, type = 'participant') => {
    setRegisteringEventId(eventId)
    registerForEvent.mutate({ eventId, type }, {
      onSettled: () => setRegisteringEventId(null),
    })
  }

  const handleCancelRegistration = (eventId) => {
    setCancellingEventId(eventId)
    cancelEventRegistration.mutate(eventId, {
      onSettled: () => setCancellingEventId(null),
    })
  }

  const generatedCertificatesCount = (certs || []).filter((c) => ['generated', 'emailed'].includes((c?.status || '').toLowerCase())).length
  const visibleCertificates = (certs || []).filter((c) => c?.status === 'emailed')
  const uploadedVerifiedCount = (manualSubmissions || []).filter((s) => s?.status === 'verified').length
  const totalCerts   = generatedCertificatesCount + uploadedVerifiedCount
  const totalCredits = credits?.total_credits ?? 0
  const currentSemester = credits?.current_semester
  const semesterTotals = credits?.semester_totals || []
  const creditHistory = credits?.credit_history || []
  const semesterOptions = [
    ...(currentSemester ? [currentSemester] : []),
    ...semesterTotals.map((item) => item?.semester || 'Unknown'),
  ].filter(Boolean)
  const uniqueSemesters = Array.from(new Set(semesterOptions))
  const [selectedSemester, setSelectedSemester] = useState(
    currentSemester || uniqueSemesters[0] || 'Unknown',
  )

  useEffect(() => {
    const next = currentSemester || uniqueSemesters[0]
    if (next) setSelectedSemester(next)
  }, [currentSemester, semesterTotals])

  const selectedHistory = creditHistory.filter(
    (entry) => (entry.semester || 'Unknown') === selectedSemester,
  )
  const selectedTotal = semesterTotals.find(
    (item) => (item?.semester || 'Unknown') === selectedSemester,
  )?.total_credits ?? 0

  const handleDownload = async (certNumber, certId) => {
    setDownloadingId(certId)
    try {
      const response = await axiosInstance.get(
        `/students/me/certificates/${certNumber}/download`,
        { responseType: 'blob' }
      )
      const blob = new Blob([response.data], { type: 'image/png' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${certNumber}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      const status = err?.response?.status
      const msg =
        status === 404
          ? 'Certificate file is not available yet. Try again after generation completes.'
          : 'Download failed. Please try again.'
      addToast({ type: 'error', message: msg })
    } finally {
      setDownloadingId(null)
    }
  }

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!uploadForm.cert_type || !uploadForm.event_date || !uploadForm.certificate_image) {
      addToast({ type: 'error', message: 'Please choose role, event date, and certificate image.' })
      return
    }

    await createSubmission.mutateAsync({
      cert_type: uploadForm.cert_type,
      event_date: uploadForm.event_date,
      certificate_image: uploadForm.certificate_image,
    })

    setUploadForm({ cert_type: '', event_date: '', certificate_image: null })
    const fileInput = document.getElementById('student-certificate-upload')
    if (fileInput) fileInput.value = ''
  }

  const certColumns = [
    {
      key: 'cert_number',
      header: 'Cert No.',
      sortable: true,
      searchKey: true,
      render: (v) => (
        <span className="font-mono text-xs font-semibold text-navy">{v ?? '—'}</span>
      ),
    },
    {
      key: 'event_name',
      header: 'Event',
      sortable: true,
      searchKey: true,
    },
    {
      key: 'club_name',
      header: 'Club',
      sortable: true,
      searchKey: true,
      render: (v) => (
        <span className="text-xs text-gray-500">{v ?? '—'}</span>
      ),
    },
    {
      key: 'cert_type',
      header: 'Type',
      render: (v) => (
        <span
          className={`
            inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize
            ${TYPE_COLORS[v] ?? 'bg-gray-100 text-gray-600'}
          `}
        >
          {(v ?? 'participant').replace(/_/g, ' ')}
        </span>
      ),
    },
    {
      key: 'issued_at',
      header: 'Issued On',
      sortable: true,
      render: (v) =>
        v
          ? new Date(v).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
            })
          : '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: '_actions',
      header: 'Actions',
      align: 'center',
      render: (_, row) => {
        const certNumber = row?.cert_number
        const isDownloading = downloadingId === row._id
        const canDownload = ['generated', 'emailed'].includes(String(row?.status || '').toLowerCase())
        const viewUrl = row?.png_url
          ? (String(row.png_url).startsWith('http') ? row.png_url : `${BACKEND_URL}${row.png_url}`)
          : null

        if (!canDownload) {
          return <span className="text-xs text-gray-300">Not ready</span>
        }

        return (
          <div className="inline-flex items-center gap-2">
            {viewUrl && (
              <a
                href={viewUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                title="View certificate"
              >
                View
              </a>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDownload(certNumber, row._id)
              }}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium
                text-navy border border-navy/30 hover:bg-navy hover:text-white
                transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download certificate as PNG"
            >
              {isDownloading ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  PNG
                </>
              )}
            </button>
          </div>
        )
      },
    },
  ]

  const filteredUpcomingEvents = (upcomingEvents || []).filter((ev) => {
    if (eventCategoryFilter && ev.category !== eventCategoryFilter) return false
    if (eventSearch) {
      const q = eventSearch.toLowerCase()
      const matchName = (ev.name || '').toLowerCase().includes(q)
      const matchClub = (ev.club_name || '').toLowerCase().includes(q)
      const matchVenue = (ev.venue || '').toLowerCase().includes(q)
      if (!matchName && !matchClub && !matchVenue) return false
    }
    return true
  })

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="page-container space-y-6">

            {/* ── Direct Attendance Session Page (Unique URL, No Time Limit) ── */}
            {routeEventId && routeToken ? (
              <AttendanceSessionView eventId={routeEventId} token={routeToken} />
            ) : (
              <>
            {/* ── Attendance scanner overlay (replaces upcoming tab content when active) ── */}
            {attendanceView !== 'idle' && activeTab === 'upcoming' && (
              <div className="space-y-4">
                {attendanceView === 'scanning' && (
                  <AttendanceScannerView
                    event={attendanceEvent}
                    onScanned={handleQRScanned}
                    onCancel={closeAttendance}
                    onError={(msg) => { setScanError(msg); setAttendanceView('scan_error') }}
                  />
                )}

                {attendanceView === 'scan_error' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={closeAttendance}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                      </button>
                      <h2 className="text-lg font-bold text-foreground">QR Scan Failed</h2>
                    </div>
                    <div className="card p-6 flex flex-col items-center gap-5 text-center">
                      <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-red-700">Invalid or Expired QR Code</p>
                        <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">{scanError}</p>
                      </div>
                      <div className="flex gap-3 w-full">
                        <button
                          type="button"
                          onClick={() => { setScanError(null); setAttendanceView('scanning') }}
                          className="btn-primary flex-1 justify-center"
                        >
                          Try Again
                        </button>
                        <button
                          type="button"
                          onClick={closeAttendance}
                          className="btn-secondary flex-1 justify-center"
                        >
                          Go Back
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'upcoming' && attendanceView === 'idle' ? (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Upcoming Club Events</h1>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Discover and register for upcoming events conducted by college clubs. Note: You can register for only one event per session (Morning / Afternoon) on the same date.
                  </p>
                </div>

                {/* Filters */}
                <div className="card p-4 flex flex-wrap items-center gap-3">
                  <input
                    type="search"
                    placeholder="Search upcoming events…"
                    value={eventSearch}
                    onChange={(e) => setEventSearch(e.target.value)}
                    className="form-input w-full sm:w-64 text-xs"
                  />
                  <select
                    value={eventCategoryFilter}
                    onChange={(e) => setEventCategoryFilter(e.target.value)}
                    className="form-input w-full sm:w-48 text-xs"
                  >
                    <option value="">All Categories</option>
                    {['Workshop', 'Technical Talk', 'Hackathon', 'Cultural', 'Seminar', 'Competition', 'Other'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Events Grid */}
                {upcomingLoading ? (
                  <LoadingSpinner fullPage label="Loading upcoming events…" />
                ) : filteredUpcomingEvents.length === 0 ? (
                  <div className="card p-8 text-center text-gray-400">
                    No upcoming events found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredUpcomingEvents.map((ev) => {
                      const sessionLabel = ev.session === 'AN' ? 'Afternoon (AN)' : 'Morning (FN)'
                      return (
                        <div key={ev.id} className="card overflow-hidden flex flex-col justify-between hover:shadow-lg transition-all border border-gray-200">
                          <div>
                            {/* Poster */}
                            {ev.poster_url ? (
                              <div className="aspect-[16/9] w-full overflow-hidden bg-gray-100 border-b border-gray-200">
                                {ev.poster_url.toLowerCase().endsWith('.pdf') ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gray-50 text-navy">
                                    <span className="text-3xl">📄</span>
                                    <a
                                      href={`${BACKEND_URL}${ev.poster_url}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-semibold text-navy hover:underline mt-1"
                                    >
                                      View Event PDF
                                    </a>
                                  </div>
                                ) : (
                                  <img
                                    src={ev.poster_url.startsWith('/') ? `${BACKEND_URL}${ev.poster_url}` : ev.poster_url}
                                    alt={ev.name}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="aspect-[16/9] w-full bg-navy/5 border-b border-gray-200 flex items-center justify-center text-3xl text-navy/40">
                                📅
                              </div>
                            )}

                            <div className="p-5 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold text-navy uppercase tracking-wider">{ev.club_name}</span>
                                <span className="inline-flex rounded-full bg-navy/10 px-2.5 py-0.5 text-[10px] font-semibold text-navy">
                                  {ev.category || 'Event'}
                                </span>
                              </div>

                              <h3 className="text-base font-bold text-foreground line-clamp-1">{ev.name}</h3>
                              {ev.description && (
                                <p className="text-xs text-gray-600 line-clamp-3">{ev.description}</p>
                              )}

                              <div className="space-y-1.5 pt-2 text-xs text-gray-500 border-t border-gray-100">
                                <div className="flex items-center gap-1.5">
                                  <span>📅</span>
                                  <span className="font-medium text-gray-700">
                                    {ev.event_date ? new Date(ev.event_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span>🕐</span>
                                  <span className="font-semibold text-navy">{sessionLabel}</span>
                                </div>
                                {ev.venue && (
                                  <div className="flex items-center gap-1.5">
                                    <span>📍</span>
                                    <span>{ev.venue}</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 pt-1">
                                  <span>👥</span>
                                  <span>{ev.registered_count || 0} student(s) registered</span>
                                </div>
                                {(ev.volunteers_required || 0) > 0 && (
                                  <div className="flex items-center gap-1.5 text-[11px] text-teal-600 font-medium">
                                    <span>🤝</span>
                                    <span>
                                      Volunteers: {ev.volunteers_registered || 0} / {ev.volunteers_required} filled
                                      {(ev.volunteers_registered || 0) >= (ev.volunteers_required || 0) && ' (Full)'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="p-5 pt-0">
                            {ev.is_registered ? (
                              <div className="space-y-2">
                                {ev.registration_type === 'volunteer' ? (
                                  ev.volunteer_status === 'accepted' ? (
                                    <div className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-green-50 text-green-700 font-semibold text-xs border border-green-200">
                                      ✓ Volunteer Request Accepted ({sessionLabel})
                                    </div>
                                  ) : ev.volunteer_status === 'rejected' ? (
                                    <div className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-red-50 text-red-700 font-semibold text-xs border border-red-200">
                                      ✕ Volunteer Request Rejected ({sessionLabel})
                                    </div>
                                  ) : (
                                    <div className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-50 text-amber-700 font-semibold text-xs border border-amber-200">
                                      ⏳ Volunteer Request Pending ({sessionLabel})
                                    </div>
                                  )
                                ) : (
                                  <div className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-green-50 text-green-700 font-semibold text-xs border border-green-200">
                                    ✓ Registered for Event ({sessionLabel})
                                  </div>
                                )}

                                {/* Mark Attendance button — for participant registrations or accepted volunteers */}
                                {(ev.registration_type === 'participant' ||
                                  (ev.registration_type === 'volunteer' && ev.volunteer_status === 'accepted')
                                ) && (
                                  <button
                                    type="button"
                                    onClick={() => openScanner(ev)}
                                    className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                    </svg>
                                    Mark Attendance
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleCancelRegistration(ev.id)}
                                  disabled={cancelEventRegistration.isPending && cancellingEventId === ev.id}
                                  className="w-full text-center text-xs text-red-600 hover:text-red-800 hover:underline py-1 font-medium disabled:opacity-50"
                                >
                                  {cancelEventRegistration.isPending && cancellingEventId === ev.id
                                    ? 'Cancelling…'
                                    : ev.registration_type === 'volunteer'
                                    ? 'Cancel Volunteer Request'
                                    : 'Cancel Registration'}
                                </button>
                              </div>
                            ) : ev.registration_stopped ? (
                              <div className="w-full flex flex-col items-center justify-center p-3 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 text-center space-y-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                                  <span>⚠️</span> Max Participants Reached
                                </span>
                                <p className="text-xs font-medium text-amber-800 leading-snug">
                                  Max participants reached. We will be coming up with new events.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <button
                                  type="button"
                                  onClick={() => handleRegister(ev.id, 'participant')}
                                  disabled={registerForEvent.isPending && registeringEventId === ev.id}
                                  className="btn-primary w-full text-xs justify-center"
                                >
                                  {registerForEvent.isPending && registeringEventId === ev.id ? 'Registering…' : 'Register for Event'}
                                </button>

                                {/* Volunteer Register Option */}
                                {(ev.volunteers_required || 0) > 0 && (
                                  (ev.volunteers_registered || 0) >= (ev.volunteers_required || 0) ? (
                                    <button
                                      type="button"
                                      disabled
                                      className="btn-secondary w-full text-xs justify-center opacity-60 cursor-not-allowed text-gray-500 bg-gray-100 border-gray-300 font-medium"
                                      title="Maximum volunteers already registered"
                                    >
                                      Maximum volunteers already registered
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleRegister(ev.id, 'volunteer')}
                                      disabled={registerForEvent.isPending && registeringEventId === ev.id}
                                      className="btn-secondary w-full text-xs justify-center text-teal-700 border-teal-300 hover:bg-teal-50 font-semibold"
                                    >
                                      {registerForEvent.isPending && registeringEventId === ev.id ? 'Submitting Request…' : 'Volunteer Register'}
                                    </button>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : activeTab === 'settings' ? (
              <StudentSettingsTab profile={profile} profileLoading={profileLoading} />
            ) : (
              <>

            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {profileLoading ? (
                    <span className="inline-block h-7 w-48 animate-pulse rounded bg-gray-200" />
                  ) : (
                    <>Hello, {profile?.name ?? profile?.email?.split('@')[0] ?? 'Student'} 👋</>
                  )}
                </h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  Here's your certificate and credit summary.
                </p>
              </div>

            </div>

            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="My Certificates"
                value={totalCerts}
                subText={`Generated: ${generatedCertificatesCount} • Uploaded & Verified: ${uploadedVerifiedCount}`}
                icon={Icons.cert}
                accent="navy"
                isLoading={certsLoading || submissionsLoading}
              />
              <StatCard
                label="Current Semester Credits"
                value={totalCredits}
                icon={Icons.star}
                accent="gold"
                isLoading={creditsLoading}
              />
            </div>

            <CreditsBreakdown
              breakdown={credits?.breakdown}
              total={totalCredits}
              creditRules={creditRules}
              rulesLoading={rulesLoading}
            />

            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="section-title">Semester Totals</h2>
                <span className="text-xs text-gray-500">
                  {currentSemester ? `Current: ${currentSemester}` : 'Current: —'}
                </span>
              </div>
              <DataTable
                columns={[
                  {
                    key: 'semester',
                    header: 'Semester',
                    render: (v) => (
                      <span className="text-sm font-medium text-gray-700">
                        {v || 'Unknown'}{v === currentSemester ? ' (Current)' : ''}
                      </span>
                    ),
                  },
                  {
                    key: 'total_credits',
                    header: 'Total Credits',
                    align: 'right',
                    render: (v) => <span className="font-semibold text-navy">{v ?? 0}</span>,
                  },
                ]}
                data={semesterTotals}
                isLoading={creditsLoading}
                emptyMessage="No semester totals yet."
                rowKey="semester"
              />
            </div>

            {/* ─── Club Memberships ─────────────────────────────────── */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="section-title">My Club Memberships</h2>
                {clubMemberships && clubMemberships.length > 0 && (
                  <span className="text-xs text-gray-500">{clubMemberships.length} / 2 slots used</span>
                )}
              </div>

              {/* Current memberships */}
              {membershipsLoading ? (
                <div className="flex justify-center py-4"><div className="h-6 w-6 animate-spin rounded-full border-2 border-navy border-t-transparent" /></div>
              ) : clubMemberships && clubMemberships.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {clubMemberships.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{m.club_name || '—'}</p>
                          {m.office_bearer_role && (
                            <span className="inline-flex rounded bg-navy/10 px-2 py-0.5 text-xs font-semibold text-navy">
                              {m.office_bearer_role}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Applied {m.applied_at ? new Date(m.applied_at).toLocaleDateString('en-IN') : '—'}
                          {m.review_note ? ` • ${m.review_note}` : ''}
                        </p>
                      </div>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        m.status === 'approved' ? 'bg-green-100 text-green-700' :
                        m.status === 'rejected' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">You haven't applied to any clubs yet.</p>
              )}

              {/* Apply section — only if fewer than 2 active slots */}
              {(() => {
                const activeCount = (clubMemberships || []).filter(
                  (m) => m.status === 'pending' || m.status === 'approved'
                ).length
                if (activeCount >= 2) return null

                const appliedClubIds = new Set(
                  (clubMemberships || [])
                    .filter((m) => m.status === 'pending' || m.status === 'approved')
                    .map((m) => m.club_id)
                )
                const eligibleClubs = (availableClubs || []).filter(
                  (c) => !appliedClubIds.has(c.id)
                )

                return (
                  <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
                    <select
                      className="form-input flex-1"
                      value={selectedClubId}
                      onChange={(e) => setSelectedClubId(e.target.value)}
                    >
                      <option value="">Select a club to join…</option>
                      {eligibleClubs.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      id="apply-club-btn"
                      className="btn-primary whitespace-nowrap"
                      disabled={!selectedClubId || applyForClub.isPending}
                      onClick={() => {
                        if (!selectedClubId) return
                        applyForClub.mutate(selectedClubId, {
                          onSuccess: () => setSelectedClubId('')
                        })
                      }}
                    >
                      {applyForClub.isPending ? 'Applying…' : 'Apply'}
                    </button>
                  </div>
                )
              })()}
            </div>

            {activeTab === 'cert_verification' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Certificate Verification</h1>
                  <p className="mt-0.5 text-sm text-gray-500">
                    Submit your certificates from external or other events for credit verification by your tutor.
                  </p>
                </div>

                <div className="card p-5">
                  <h2 className="section-title mb-3">Submit Certificate For Credit Verification</h2>
                  <p className="mb-3 text-sm text-gray-500">
                    Upload your certificate, choose role and event date. Credits are added only after tutor verification.
                  </p>

                  <form className="grid grid-cols-1 gap-3 sm:grid-cols-4" onSubmit={handleManualSubmit}>
                    <div>
                      <label className="form-label">Role *</label>
                      <select
                        className="form-input"
                        value={uploadForm.cert_type}
                        onChange={(e) => setUploadForm((p) => ({ ...p, cert_type: e.target.value }))}
                        disabled={rulesLoading}
                      >
                        <option value="">Select role</option>
                        {(creditRules || []).map((r) => (
                          <option key={r.cert_type} value={r.cert_type}>
                            {r.cert_type} (+{r.points})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Event Date *</label>
                      <input
                        type="date"
                        className="form-input"
                        value={uploadForm.event_date}
                        onChange={(e) => setUploadForm((p) => ({ ...p, event_date: e.target.value }))}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="form-label">Certificate Image *</label>
                      <input
                        id="student-certificate-upload"
                        type="file"
                        accept="image/*"
                        className="form-input"
                        onChange={(e) => setUploadForm((p) => ({ ...p, certificate_image: e.target.files?.[0] || null }))}
                      />
                    </div>

                    <div className="sm:col-span-4 flex justify-end">
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={createSubmission.isPending || !uploadForm.cert_type || !uploadForm.event_date || !uploadForm.certificate_image}
                      >
                        {createSubmission.isPending ? 'Submitting...' : 'Submit For Verification'}
                      </button>
                    </div>
                  </form>
                </div>

                <div>
                  <h2 className="section-title mb-3">My Verification Requests</h2>
                  <DataTable
                    columns={[
                      { key: 'cert_type', header: 'Role', render: (v) => <span className="capitalize">{(v || '').replace(/_/g, ' ')}</span> },
                      { key: 'semester', header: 'Semester', render: (v) => <span className="text-xs text-gray-500">{v || 'Unknown'}</span> },
                      { key: 'event_date', header: 'Event Date', render: (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—') },
                      { key: 'certificate_image_url', header: 'Certificate', render: (v) => (
                        v ? <a href={v} target="_blank" rel="noreferrer" className="text-navy hover:underline">View Image</a> : '—'
                      ) },
                      { key: 'status', header: 'Status', render: (v) => <StatusBadge status={v} /> },
                      { key: 'points_awarded', header: 'Points', align: 'right', render: (v) => <span className="font-bold text-green-700">{v || 0}</span> },
                      { key: 'review_comment', header: 'Tutor Remarks', render: (v) => v || '—' },
                      { key: 'submitted_at', header: 'Submitted', render: (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—') },
                    ]}
                    data={manualSubmissions || []}
                    isLoading={submissionsLoading}
                    emptyMessage="No verification requests yet."
                    rowKey="id"
                  />
                </div>
              </div>
            )}

            {activeTab !== 'cert_verification' && (
              <>
            <div>
              <h2 className="section-title mb-3">Credit History</h2>
              <DataTable
                columns={[
                 { key: 'cert_number', header: 'Cert No.', searchKey: true,
                   render: (v) => <span className="font-mono text-xs font-semibold text-navy">{v}</span> },
                 { key: 'semester', header: 'Semester', render: (v) => <span className="text-xs text-gray-500">{v || 'Unknown'}</span> },
                 { key: 'event_name', header: 'Event' },
                 { key: 'club_name', header: 'Club',
                   render: (v) => <span className="text-xs text-gray-500">{v}</span> },
                 { key: 'cert_type', header: 'Type',
                   render: (v) => <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${TYPE_COLORS[v] ?? 'bg-gray-100 text-gray-600'}`}>{v.replace(/_/g, ' ')}</span> },
                 { key: 'points_awarded', header: 'Credits Earned', align: 'right',
                   render: (v) => <span className="font-bold text-green-600">+{v ?? 0}</span> },
                 { key: 'awarded_at', header: 'Date',
                   render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' }
               ]}
                data={creditHistory}
                isLoading={creditsLoading}
                emptyMessage="No credit history found."
                searchable
                searchPlaceholder="Search history..."
              />
            </div>

            <div>
              <h2 className="section-title mb-3">Certificates by Semester</h2>
              {uniqueSemesters.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                  No semester data yet.
                </div>
              ) : (
                <div className="card p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-gray-600">Semester</label>
                      <select
                        className="form-input h-9 py-1 text-sm"
                        value={selectedSemester}
                        onChange={(e) => setSelectedSemester(e.target.value)}
                      >
                        {uniqueSemesters.map((semester) => (
                          <option key={semester} value={semester}>
                            {semester}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="text-xs text-gray-500">Total: {selectedTotal}</span>
                  </div>
                  <DataTable
                    columns={[
                      { key: 'cert_number', header: 'Cert No.', render: (v) => <span className="font-mono text-xs">{v || '—'}</span> },
                      { key: 'event_name', header: 'Event' },
                      { key: 'club_name', header: 'Club', render: (v) => <span className="text-xs text-gray-500">{v || '—'}</span> },
                      { key: 'cert_type', header: 'Type', render: (v) => <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${TYPE_COLORS[v] ?? 'bg-gray-100 text-gray-600'}`}>{(v || 'participant').replace(/_/g, ' ')}</span> },
                      { key: 'points_awarded', header: 'Credits', align: 'right', render: (v) => <span className="font-semibold text-green-700">+{v ?? 0}</span> },
                      { key: 'awarded_at', header: 'Date', render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
                    ]}
                    data={selectedHistory}
                    isLoading={creditsLoading}
                    emptyMessage="No certificates for this semester."
                    rowKey="cert_number"
                  />
                </div>
              )}
            </div>

            <div>
              <h2 className="section-title mb-3">My Certificates</h2>
              <DataTable
                columns={certColumns}
                data={visibleCertificates}
                isLoading={certsLoading}
                emptyMessage="No certificates yet. Participate in events to earn certificates."
                searchable
                searchPlaceholder="Search by event name, cert no…"
                rowKey="_id"
              />
            </div>
              </>
            )}
            </>
          )}
          </>
        )}
          </div>
        </main>
      </div>
    </div>
  )
}
