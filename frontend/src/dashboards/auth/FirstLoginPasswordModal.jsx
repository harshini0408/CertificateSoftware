import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useFirstLoginChangePassword, useFirstLoginResendOtp } from './api'
import LoadingSpinner from '../../components/LoadingSpinner'

export default function FirstLoginPasswordModal({
  isOpen,
  loginData,
  onClose,
}) {
  const [showNewPassword, setShowNewPassword] = useState(false)
  const changePasswordMutation = useFirstLoginChangePassword()
  const resendOtpMutation = useFirstLoginResendOtp()

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      otp_code: '',
      new_password: '',
      confirm_password: '',
    },
  })

  // Ensure form is strictly cleared every time the modal is opened
  useEffect(() => {
    if (isOpen) {
      reset({
        otp_code: '',
        new_password: '',
        confirm_password: '',
      })
    }
  }, [isOpen, reset])

  if (!isOpen || !loginData) return null

  const newPassword = watch('new_password')

  const onSubmit = (values) => {
    changePasswordMutation.mutate({
      username_or_email: loginData.username,
      current_password: loginData.password,
      otp_code: values.otp_code.trim(),
      new_password: values.new_password,
    })
  }

  const handleResendOtp = () => {
    resendOtpMutation.mutate({
      username: loginData.username,
      password: loginData.password,
    })
  }

  const busy = changePasswordMutation.isPending || resendOtpMutation.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-gray-100 z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center mb-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-3 border border-amber-200">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">First-Time Login Security</h2>
          <p className="mt-1 text-xs text-gray-500 leading-relaxed">
            Welcome! As this is your first time logging in, you must change your default password before accessing your dashboard.
          </p>
          {loginData.email && (
            <p className="mt-2 text-xs font-semibold text-indigo-700 bg-indigo-50 py-1.5 px-3 rounded-lg border border-indigo-100 inline-block">
              OTP sent to: {loginData.email}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" autoComplete="off">
          {/* Hidden decoy fields to intercept browser auto-fill of username & password */}
          <input type="text" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="off" />
          <input type="password" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" autoComplete="off" />

          {/* OTP Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="first-login-otp" className="block text-xs font-semibold text-gray-700">
                4-Digit Verification OTP <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={busy}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
              >
                {resendOtpMutation.isPending ? 'Sending...' : 'Resend OTP'}
              </button>
            </div>
            <input
              id="first-login-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              placeholder="e.g. 1234"
              className={`form-input text-center tracking-widest text-lg font-bold py-2 ${errors.otp_code ? 'form-input-error' : ''}`}
              disabled={busy}
              {...register('otp_code', {
                required: 'OTP is required.',
                pattern: { value: /^\d{4}$/, message: 'Must be a 4-digit code.' },
              })}
            />
            {errors.otp_code && (
              <p className="form-error text-xs">{errors.otp_code.message}</p>
            )}
          </div>

          {/* New Password */}
          <div>
            <label htmlFor="first-login-new-pass" className="block text-xs font-semibold text-gray-700 mb-1">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="first-login-new-pass"
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
                className={`form-input pr-10 ${errors.new_password ? 'form-input-error' : ''}`}
                disabled={busy}
                {...register('new_password', {
                  required: 'New password is required.',
                  minLength: { value: 8, message: 'Password must be at least 8 characters.' },
                })}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-navy"
                tabIndex={-1}
              >
                {showNewPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.new_password && (
              <p className="form-error text-xs">{errors.new_password.message}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="first-login-confirm-pass" className="block text-xs font-semibold text-gray-700 mb-1">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <input
              id="first-login-confirm-pass"
              type={showNewPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Re-enter new password"
              className={`form-input ${errors.confirm_password ? 'form-input-error' : ''}`}
              disabled={busy}
              {...register('confirm_password', {
                required: 'Please confirm your new password.',
                validate: (val) => val === newPassword || 'Passwords do not match.',
              })}
            />
            {errors.confirm_password && (
              <p className="form-error text-xs">{errors.confirm_password.message}</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full py-2.5 text-sm font-bold shadow-md hover:shadow-lg transition-all"
            >
              {changePasswordMutation.isPending ? (
                <>
                  <LoadingSpinner size="sm" label="" />
                  <span>Updating Password…</span>
                </>
              ) : (
                'Set New Password & Access Dashboard →'
              )}
            </button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Cancel and return to sign in
          </button>
        </div>
      </div>
    </div>
  )
}
