import { useState } from 'react'
import { useLogin } from './api'
import LoadingSpinner from '../../components/LoadingSpinner'
import ForgotPasswordModal from './ForgotPasswordModal'
import { LogIn, Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false)

  const loginMutation = useLogin()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!username || !password) return
    loginMutation.mutate({ username, password })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-card border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-navy-50 rounded-2xl flex items-center justify-center text-navy mb-4">
            <ShieldCheck size={40} />
          </div>
          <h2 className="text-3xl font-extrabold text-navy">
            Sign in
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Access your certificate dashboard
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="form-label">
                Faculty ID / Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User size={18} />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  className="form-input pl-10"
                  placeholder="e.g. 24Z108"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loginMutation.isPending}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="form-label mb-0">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-xs font-semibold text-navy hover:text-navy-700 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="form-input pl-10 pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginMutation.isPending}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-navy transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loginMutation.isPending || !username || !password}
              className="btn-primary w-full py-3 text-base shadow-lg shadow-navy/10 relative overflow-hidden group"
            >
              {loginMutation.isPending ? (
                <LoadingSpinner size="sm" color="white" label="Signing in..." />
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign In <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 italic text-center text-xs text-gray-400">
          Secure Certificate Issuance & Verification System
        </div>
      </div>

      <ForgotPasswordModal 
        isOpen={isForgotModalOpen} 
        onClose={() => setIsForgotModalOpen(false)} 
      />
    </div>
  )
}
