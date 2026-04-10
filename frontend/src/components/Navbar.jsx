import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import { useToastStore } from '../store/uiStore'
import axiosInstance from '../utils/axiosInstance'
import queryClient from '../utils/queryClient'
import logoImg from '../Images/logo.png'

// ── Role badge colours ────────────────────────────────────────────────────────
const roleMeta = {
  super_admin:      { label: 'Super Admin',      cls: 'bg-purple-100 text-purple-700' },
  club_coordinator: { label: 'Club Coordinator', cls: 'bg-blue-100 text-blue-700' },
  dept_coordinator: { label: 'Dept Coordinator', cls: 'bg-teal-100 text-teal-700' },
  tutor:            { label: 'Tutor',            cls: 'bg-indigo-100 text-indigo-700' },
  student:          { label: 'Student',           cls: 'bg-green-100 text-green-700' },
  guest:            { label: 'Guest',             cls: 'bg-gray-100 text-gray-600' },
}

// ── Change-password popover ───────────────────────────────────────────────────
function ChangePasswordForm({ onClose }) {
  const addToast = useToastStore((s) => s.addToast)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm()

  const mutation = useMutation({
    mutationFn: (data) =>
      axiosInstance.patch('/auth/password', {
        current_password: data.current_password,
        new_password: data.new_password,
      }),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Password changed successfully.' })
      onClose()
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to change password.'
      addToast({ type: 'error', message: msg })
    },
  })

  return (
    <form
      onSubmit={handleSubmit((d) => mutation.mutate(d))}
      className="flex flex-col gap-4"
    >
      <div>
        <label className="form-label">Current password</label>
        <input
          type="password"
          autoComplete="current-password"
          className={`form-input ${errors.current_password ? 'form-input-error' : ''}`}
          {...register('current_password', { required: 'Required' })}
        />
        {errors.current_password && (
          <p className="form-error">{errors.current_password.message}</p>
        )}
      </div>

      <div>
        <label className="form-label">New password</label>
        <input
          type="password"
          autoComplete="new-password"
          className={`form-input ${errors.new_password ? 'form-input-error' : ''}`}
          {...register('new_password', {
            required: 'Required',
            minLength: { value: 8, message: 'Min 8 characters' },
          })}
        />
        {errors.new_password && (
          <p className="form-error">{errors.new_password.message}</p>
        )}
      </div>

      <div>
        <label className="form-label">Confirm new password</label>
        <input
          type="password"
          autoComplete="new-password"
          className={`form-input ${errors.confirm ? 'form-input-error' : ''}`}
          {...register('confirm', {
            required: 'Required',
            validate: (v) => v === watch('new_password') || 'Passwords do not match',
          })}
        />
        {errors.confirm && (
          <p className="form-error">{errors.confirm.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

// ── Navbar ────────────────────────────────────────────────────────────────────
export default function Navbar({ onBrandClick, brandAriaLabel = 'Go back' }) {
  const navigate = useNavigate()
  const { user, role, clearAuth } = useAuthStore()
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const addToast = useToastStore((s) => s.addToast)

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showChangePw, setShowChangePw] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
        setShowChangePw(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const logoutMutation = useMutation({
    mutationFn: () => axiosInstance.post('/auth/logout'),
    onSettled: () => {
      clearAuth()
      queryClient.clear()
      navigate('/login', { replace: true })
    },
    onError: () => {
      addToast({ type: 'error', message: 'Logout failed. Please try again.' })
    },
  })

  const meta = roleMeta[role] ?? { label: role, cls: 'bg-gray-100 text-gray-600' }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center border-b border-gray-200 bg-white px-4 shadow-sm">
        {/* Sidebar hamburger */}
        <button
          id="navbar-sidebar-toggle"
          aria-label="Toggle sidebar"
          onClick={toggleSidebar}
          className="mr-3 rounded p-1.5 text-navy hover:bg-navy/8 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Brand */}
        {onBrandClick ? (
          <button
            type="button"
            onClick={onBrandClick}
            aria-label={brandAriaLabel}
            className="flex items-center gap-2 select-none rounded px-1 py-0.5 hover:bg-navy/8 transition-colors"
          >
            <img src={logoImg} alt="Logo" className="h-8 w-8 object-contain" />
            <span className="hidden sm:block text-sm font-semibold text-navy leading-tight text-left">
              PSG iTech<br />
              <span className="font-normal text-xs text-gray-500">Certificate Platform</span>
            </span>
          </button>
        ) : (
          <div className="flex items-center gap-2 select-none">
            <img src={logoImg} alt="Logo" className="h-8 w-8 object-contain" />
            <span className="hidden sm:block text-sm font-semibold text-navy leading-tight">
              PSG iTech<br />
              <span className="font-normal text-xs text-gray-500">Certificate Platform</span>
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {/* Role badge */}
          <span className={`hidden sm:inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>
            {meta.label}
          </span>

          {/* User dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              id="navbar-user-menu"
              onClick={() => { setDropdownOpen((o) => !o); setShowChangePw(false) }}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-navy hover:bg-navy/8 transition-colors"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy/10 text-navy font-bold text-xs uppercase">
                {user ? user[0] : '?'}
              </span>
              <span className="hidden sm:block max-w-[140px] truncate">{user ?? 'User'}</span>
              <svg className={`h-4 w-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown panel */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-lg border border-gray-200 bg-white shadow-modal z-50">
                {/* User info header */}
                <div className="border-b border-gray-100 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">{user ?? 'User'}</p>
                  <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>

                {/* Change password section */}
                <div className="px-4 py-3">
                  {!showChangePw ? (
                    <button
                      id="navbar-change-password"
                      onClick={() => setShowChangePw(true)}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-navy hover:bg-navy/8 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Change Password
                    </button>
                  ) : (
                    <ChangePasswordForm onClose={() => setShowChangePw(false)} />
                  )}
                </div>

                {/* Logout */}
                <div className="border-t border-gray-100 px-4 py-2">
                  <button
                    id="navbar-logout"
                    onClick={() => logoutMutation.mutate()}
                    disabled={logoutMutation.isPending}
                    className="flex w-full items-center gap-2 rounded px-2 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {logoutMutation.isPending ? 'Logging out…' : 'Log out'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Spacer keeps content from being hidden behind fixed header */}
      <div className="h-14 shrink-0" />
    </>
  )
}
