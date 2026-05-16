import { useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, ShieldCheck, UserSquare2, X } from 'lucide-react'

import LoadingSpinner from '../../components/LoadingSpinner'
import { useForgotPassword, useResetPassword, useVerifyOTP } from './api'


export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [step, setStep] = useState('email')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const forgotMutation = useForgotPassword()
  const verifyMutation = useVerifyOTP()
  const resetMutation = useResetPassword()

  if (!isOpen) return null

  const handleClose = () => {
    setStep('email')
    setUsername('')
    setEmail('')
    setMaskedEmail('')
    setOtp('')
    setNewPassword('')
    setConfirmPassword('')
    onClose()
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    if (!username.trim()) return

    try {
      const res = await forgotMutation.mutateAsync(username.trim())
      const resolvedEmail = res?.data?.email || ''
      setEmail(resolvedEmail)
      setMaskedEmail(res?.data?.message?.split(': ')[1] || 'your registered email')
      setStep('otp')
    } catch {
      // Toast handled in hook.
    }
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    if (otp.length !== 4) return

    try {
      await verifyMutation.mutateAsync({ email, otp_code: otp })
      setStep('reset')
    } catch {
      // Toast handled in hook.
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (!newPassword || newPassword !== confirmPassword) return

    try {
      await resetMutation.mutateAsync({
        email,
        otp_code: otp,
        new_password: newPassword,
      })
      setStep('success')
    } catch {
      // Toast handled in hook.
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-xl font-bold text-navy flex items-center gap-2">
            {step === 'email' && <UserSquare2 size={20} />}
            {step === 'otp' && <ShieldCheck size={20} />}
            {step === 'reset' && <KeyRound size={20} />}
            {step === 'success' && <CheckCircle2 size={20} className="text-green-500" />}
            {step === 'email' && 'Reset Password'}
            {step === 'otp' && 'Verify Identity'}
            {step === 'reset' && 'Set New Password'}
            {step === 'success' && 'Password Updated'}
          </h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-navy transition-colors" type="button">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          {step === 'email' && (
            <form onSubmit={handleSendOTP} className="space-y-6">
              <p className="text-sm text-gray-500 leading-relaxed">
                Enter your Faculty ID or email. We will send a 4-digit OTP to your registered email.
              </p>
              <div>
                <label className="form-label">Faculty ID / Username / Email</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. 24Z108"
                  className="form-input"
                  disabled={forgotMutation.isPending}
                />
              </div>
              <button
                type="submit"
                disabled={forgotMutation.isPending || !username.trim()}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
              >
                {forgotMutation.isPending ? <LoadingSpinner size="sm" color="white" label="" /> : <>Send OTP <ArrowRight size={18} /></>}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-700 font-medium">OTP Sent</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  We sent a 4-digit code to:<br />
                  <span className="font-bold text-navy text-sm">{maskedEmail}</span>
                </p>
              </div>
              <div>
                <label className="form-label">4-Digit OTP Code</label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="0000"
                  className="form-input text-center text-3xl tracking-[1em] font-bold"
                  disabled={verifyMutation.isPending}
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep('email')} className="btn-secondary flex-1 py-2.5 flex items-center justify-center gap-2">
                  <ArrowLeft size={18} /> Back
                </button>
                <button
                  type="submit"
                  disabled={verifyMutation.isPending || otp.length !== 4}
                  className="btn-primary flex-[2] py-2.5 flex items-center justify-center gap-2"
                >
                  {verifyMutation.isPending ? <LoadingSpinner size="sm" color="white" label="" /> : <>Verify OTP <ArrowRight size={18} /></>}
                </button>
              </div>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <p className="text-sm text-gray-500 leading-relaxed">
                OTP verified. Enter your new password and confirm it.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 4 characters"
                    className="form-input"
                    disabled={resetMutation.isPending}
                  />
                </div>
                <div>
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className={`form-input ${confirmPassword && newPassword !== confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                    disabled={resetMutation.isPending}
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
                  )}
                </div>
              </div>
              <button
                type="submit"
                disabled={resetMutation.isPending || !newPassword || newPassword !== confirmPassword}
                className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
              >
                {resetMutation.isPending ? <LoadingSpinner size="sm" color="white" label="" /> : 'Reset Password'}
              </button>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center py-4 space-y-6">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto scale-110">
                <CheckCircle2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-navy">Done</h3>
                <p className="text-sm text-gray-500">Your password has been updated. You can now sign in.</p>
              </div>
              <button onClick={handleClose} className="btn-primary w-full py-2.5" type="button">
                Back To Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
