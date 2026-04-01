import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useRegisterSession, useSubmitRegistration } from '../api/register'
import LoadingSpinner from '../components/LoadingSpinner'

// ── Time remaining pill ───────────────────────────────────────────────────────
function ExpiryBadge({ expiresAt }) {
  const now      = Date.now()
  const expMs    = new Date(expiresAt).getTime()
  const diffMin  = Math.max(0, Math.floor((expMs - now) / 60_000))
  const diffSec  = Math.max(0, Math.floor(((expMs - now) % 60_000) / 1_000))
  const urgent   = diffMin < 10

  if (expMs <= now) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
        ✗ Expired
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold
        ${urgent
          ? 'bg-red-100 text-red-700 animate-pulse'
          : 'bg-green-100 text-green-700'
        }
      `}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${urgent ? 'bg-red-500' : 'bg-green-500'}`} />
      {diffMin}:{String(diffSec).padStart(2, '0')} remaining
    </span>
  )
}

// ── Success state ─────────────────────────────────────────────────────────────
function SuccessView({ data, session }) {
  return (
    <div
      className="flex flex-col items-center gap-5 text-center py-4"
      style={{ animation: 'fadeIn 0.3s ease-out' }}
    >
      {/* Checkmark animation */}
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-green-100 animate-ping opacity-30" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-green-500 shadow-lg">
          <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800">You're Registered!</h2>
        {data?.participant_name && (
          <p className="mt-1 text-sm text-gray-500">
            Welcome, <span className="font-semibold text-navy">{data.participant_name}</span>
          </p>
        )}
      </div>

      <div className="w-full rounded-xl bg-gray-50 border border-gray-200 px-5 py-4 text-left space-y-2">
        <p className="text-sm font-semibold text-gray-700">Registration Details</p>
        <div className="space-y-1.5">
          {[
            ['Event',  session.event_name],
            ['Club',   session.club_name],
            ['Date',   session.event_date
              ? new Date(session.event_date).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })
              : '—'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <span className="text-gray-400 w-14 shrink-0">{label}</span>
              <span className="font-medium text-gray-700">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Your certificate will be emailed after the event is concluded.
      </p>
    </div>
  )
}

// ── Expired / invalid state ───────────────────────────────────────────────────
function ExpiredView({ message }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-bold text-red-700">Registration Closed</h2>
        <p className="mt-1 text-sm text-gray-500">
          {message ?? 'This QR registration link has expired or is no longer valid.'}
        </p>
      </div>
      <p className="text-xs text-gray-400">
        Contact the event coordinator if you believe this is an error.
      </p>
    </div>
  )
}

// ── VenueRegister ─────────────────────────────────────────────────────────────
export default function VenueRegister() {
  const { token } = useParams()
  const [submitted, setSubmitted] = useState(false)
  const [successData, setSuccessData] = useState(null)

  const { data: session, isLoading, isError, error } = useRegisterSession(token)
  const submitMutation = useSubmitRegistration(token)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm()

  const onSubmit = async (values) => {
    try {
      const { data } = await submitMutation.mutateAsync(values)
      setSuccessData(data)
      setSubmitted(true)
    } catch (err) {
      const detail = err?.response?.data?.detail
      if (typeof detail === 'string') {
        setError('root', { message: detail })
      } else if (Array.isArray(detail)) {
        // FastAPI validation errors
        detail.forEach((d) => {
          const field = d.loc?.[d.loc.length - 1]
          if (field) setError(field, { message: d.msg })
        })
      } else {
        setError('root', { message: 'Registration failed. Please try again.' })
      }
    }
  }

  const isExpired    = session?.is_expired || error?.response?.status === 410
  const isForbidden  = error?.response?.status === 403 || error?.response?.status === 404
  const busy         = isSubmitting || submitMutation.isPending
  const customFields = session?.custom_fields ?? []

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#0f2540] via-[#1E3A5F] to-[#0f2540] flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-6 py-4 md:px-10">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold shrink-0">
          <svg className="h-5 w-5 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">PSG iTech</p>
          <p className="text-[10px] text-white/50 leading-none mt-0.5">Event Registration</p>
        </div>
      </header>

      {/* ── Main card ───────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-start justify-center px-4 py-8 md:py-14">
        <div
          className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
          style={{ animation: 'fadeIn 0.25s ease-out' }}
        >
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <LoadingSpinner label="Loading registration form…" />
            </div>
          )}

          {/* Error / expired / not found */}
          {!isLoading && (isError || isExpired) && (
            <div className="px-6 py-8">
              <ExpiredView
                message={
                  error?.response?.data?.detail
                  ?? (isForbidden
                    ? 'This registration link is invalid.'
                    : undefined)
                }
              />
            </div>
          )}

          {/* Success */}
          {!isLoading && !isError && submitted && session && (
            <div className="px-6 py-8">
              <SuccessView data={successData} session={session} />
            </div>
          )}

          {/* Registration form */}
          {!isLoading && !isError && !submitted && session && (
            <>
              {/* Event info banner */}
              <div className="bg-navy px-6 py-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-gold/80">
                  {session.club_name}
                </p>
                <h1 className="mt-0.5 text-lg font-bold text-white">
                  {session.event_name}
                </h1>
                {session.event_date && (
                  <p className="mt-1 text-sm text-white/60">
                    {new Date(session.event_date).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </p>
                )}
                {session.expires_at && (
                  <div className="mt-2">
                    <ExpiryBadge expiresAt={session.expires_at} />
                  </div>
                )}
              </div>

              {/* Form */}
              <form
                id="venue-register-form"
                onSubmit={handleSubmit(onSubmit)}
                className="px-6 py-5 space-y-4"
              >
                <p className="text-sm font-semibold text-gray-700">
                  Register your attendance
                </p>

                {/* Root/API error */}
                {errors.root && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5">
                    <p className="text-sm text-red-700">{errors.root.message}</p>
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="form-label" htmlFor="reg-email">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    className={`form-input ${errors.email ? 'form-input-error' : ''}`}
                    placeholder="your@email.com"
                    disabled={busy}
                    {...register('email', {
                      required: 'Email is required.',
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Enter a valid email address.',
                      },
                    })}
                  />
                  {errors.email && (
                    <p className="form-error">{errors.email.message}</p>
                  )}
                </div>

                {/* Registration number */}
                <div>
                  <label className="form-label" htmlFor="reg-regno">
                    Registration Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-regno"
                    type="text"
                    autoComplete="off"
                    className={`form-input ${errors.registration_number ? 'form-input-error' : ''}`}
                    placeholder="e.g. 21CS001"
                    disabled={busy}
                    {...register('registration_number', {
                      required: 'Registration number is required.',
                    })}
                  />
                  {errors.registration_number && (
                    <p className="form-error">{errors.registration_number.message}</p>
                  )}
                </div>

                {/* Dynamic custom fields */}
                {customFields.map((field) => (
                  <div key={field.name}>
                    <label
                      className="form-label"
                      htmlFor={`reg-field-${field.name}`}
                    >
                      {field.label}
                      {field.required && <span className="text-red-500"> *</span>}
                    </label>
                    <input
                      id={`reg-field-${field.name}`}
                      type="text"
                      className={`form-input ${errors[field.name] ? 'form-input-error' : ''}`}
                      placeholder={field.label}
                      disabled={busy}
                      {...register(field.name, {
                        required: field.required
                          ? `${field.label} is required.`
                          : false,
                      })}
                    />
                    {errors[field.name] && (
                      <p className="form-error">{errors[field.name].message}</p>
                    )}
                  </div>
                ))}

                {/* Submit */}
                <button
                  id="venue-register-submit"
                  type="submit"
                  className="btn-primary w-full mt-2"
                  disabled={busy}
                >
                  {busy ? (
                    <><LoadingSpinner size="sm" label="" /> Registering…</>
                  ) : (
                    'Register My Attendance'
                  )}
                </button>

                <p className="text-center text-[10px] text-gray-400">
                  Your details will be used only for certificate issuance.
                </p>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
