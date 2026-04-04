import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLogin } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { Navigate } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'
import collegeBg from '../Images/college bg.jpeg'
import collegeLogo from '../Images/College logo.png'

// ── PSG Logo ───────────────────────────────────────────────────────────────
function PsgLogo() {
  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md p-2">
        <img
          src={collegeLogo}
          alt="PSG College Logo"
          className="h-full w-full object-contain"
        />
      </div>
      <div className="text-center">
        <p className="text-xl font-bold text-navy leading-tight">PSG iTech</p>
        <p className="text-xs font-medium text-gray-500 tracking-wide uppercase">
          Certificate Platform
        </p>
      </div>
    </div>
  )
}

// ── Show / hide password button ───────────────────────────────────────────
function TogglePasswordBtn({ show, onToggle }) {
  return (
    <button
      type="button"
      aria-label={show ? 'Hide password' : 'Show password'}
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy transition-colors"
      tabIndex={-1}
    >
      {show ? (
        // Eye-off icon
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        // Eye icon
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  )
}

// ── Login page ────────────────────────────────────────────────────────────────
export default function Login() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.role)
  const club_id = useAuthStore((s) => s.club_id)
  const event_id = useAuthStore((s) => s.event_id)

  const [showPassword, setShowPassword] = useState(false)

  const loginMutation = useLogin()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { username: '', password: '' } })

  // Already logged in — redirect to own dashboard
  if (isAuthenticated) {
    const redirectMap = {
      super_admin:      '/admin',
      club_coordinator: `/club/${club_id}`,
      dept_coordinator: '/dept',
      student:          '/student',
      guest:            `/club/${club_id}/events/${event_id}`,
    }
    return <Navigate to={redirectMap[role] ?? '/login'} replace />
  }

  const onSubmit = (values) => {
    loginMutation.mutate(values)
  }

  const busy = isSubmitting || loginMutation.isPending
  const adminMail = '24z108@psgitech.ac.in'

  return (
    <div className="relative min-h-dvh flex items-center justify-center px-4 py-12 overflow-hidden">
      {/* Background image */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-center bg-cover opacity-60"
        style={{ backgroundImage: `url(${collegeBg})` }}
      />
      {/* Soft overlay for readability */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-white/55"
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm">
        {/* Card shell */}
        <div className="card px-8 py-10 shadow-modal">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <PsgLogo />
          </div>

          {/* Heading */}
          <h1 className="mb-1 text-center text-2xl font-bold text-foreground">
            Welcome back
          </h1>
          <p className="mb-7 text-center text-sm text-gray-500">
            Sign in to your account to continue
          </p>

          {/* Form */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-5"
          >
            {/* Username */}
            <div>
              <label htmlFor="username" className="form-label">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                placeholder="Enter your username"
                className={`form-input ${errors.username ? 'form-input-error' : ''}`}
                disabled={busy}
                {...register('username', {
                  required: 'Username is required.',
                  minLength: { value: 3, message: 'Username is too short.' },
                })}
              />
              {errors.username && (
                <p className="form-error" role="alert">
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={`form-input pr-10 ${errors.password ? 'form-input-error' : ''}`}
                  disabled={busy}
                  {...register('password', {
                    required: 'Password is required.',
                    minLength: { value: 4, message: 'Password is too short.' },
                  })}
                />
                <TogglePasswordBtn
                  show={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />
              </div>
              {errors.password && (
                <p className="form-error" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* API error banner */}
            {loginMutation.isError && !loginMutation.isPending && (
              <div
                role="alert"
                className="
                  flex items-start gap-2 rounded-lg border border-red-200
                  bg-red-50 px-4 py-3 text-sm text-red-700
                "
              >
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>
                  {loginMutation.error?.response?.data?.detail ||
                    'Invalid credentials. Please try again.'}
                </span>
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={busy}
              className="btn-primary w-full py-2.5 text-base"
            >
              {busy ? (
                <>
                  <LoadingSpinner size="sm" label="" />
                  <span>Signing in…</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className="mt-6 text-center text-xs text-gray-400">
            Forgot your password?{' '}
            <a
              href={`mailto:${adminMail}`}
              className="font-medium text-navy/70 hover:text-navy underline-offset-2 hover:underline"
            >
              Contact your administrator.
            </a>
          </p>
        </div>

        {/* Below-card footnote */}
        <p className="mt-4 text-center text-xs text-black">
          PSG Institute of Technology and Applied Research
        </p>
      </div>
    </div>
  )
}
