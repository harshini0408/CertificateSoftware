import { useMutation, useQuery } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useAuthStore } from '../../store/authStore'
import { useToastStore } from '../../store/uiStore'
import { useNavigate } from 'react-router-dom'
import queryClient from '../../utils/queryClient'

// ── Role → redirect path ──────────────────────────────────────────────────────
const roleRedirect = (data) => {
  // Backend can send an explicit redirect_to field; fall back to role-based.
  if (data.redirect_to) return data.redirect_to

  switch (data.role) {
    case 'super_admin':
      return '/admin'
    case 'club_coordinator':
      return `/club/${data.club_id}`
    case 'dept_coordinator':
      return '/dept'
    case 'tutor':
      return '/tutor'
    case 'student':
      return '/student'
    case 'guest':
      return '/guest'
    default:
      return '/login'
  }
}

// ── useLogin ─────────────────────────────────────────────────────────────────
/**
 * POST /auth/login
 * On success: populates authStore + navigates to role dashboard.
 */
export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ username, password }) =>
      axiosInstance.post('/auth/login', {
        username: username?.trim(),
        password,
      }),

    onSuccess: ({ data }) => {
      setAuth(data)
      navigate(roleRedirect(data), { replace: true })
    },

    onError: (err) => {
      const status = err?.response?.status
      if (status === 401) {
        addToast({ type: 'error', message: 'Invalid username or password.' })
      } else if (status === 403) {
        addToast({ type: 'error', message: 'Your account has been deactivated. Contact admin.' })
      } else {
        addToast({
          type: 'error',
          message: err?.response?.data?.detail || 'Login failed. Please try again.',
        })
      }
    },
  })
}

// ── useLogout ─────────────────────────────────────────────────────────────────
/**
 * POST /auth/logout
 * Clears auth store + React Query cache then redirects to /login.
 */
export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => axiosInstance.post('/auth/logout'),
    onSettled: () => {
      clearAuth()
      queryClient.clear()
      navigate('/login', { replace: true })
    },
  })
}

// ── useChangePassword ─────────────────────────────────────────────────────────
/**
 * PATCH /auth/password
 * { current_password, new_password }
 */
export function useChangePassword() {
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ current_password, new_password }) =>
      axiosInstance.patch('/auth/password', { current_password, new_password }),

    onSuccess: () => {
      addToast({ type: 'success', message: 'Password changed successfully.' })
    },

    onError: (err) => {
      const msg =
        err?.response?.data?.detail || 'Failed to change password. Please try again.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useRefreshToken ───────────────────────────────────────────────────────────
/**
 * POST /auth/refresh
 * Called automatically by the Axios interceptor — rarely used directly.
 */
export function useRefreshToken() {
  return useMutation({
    mutationFn: () => axiosInstance.post('/auth/refresh'),
  })
}

// ── useMe ─────────────────────────────────────────────────────────────────────
/**
 * GET /auth/me
 * Fetches current user info (useful for hydrating the store on page reload
 * if the session cookie is still valid but sessionStorage was cleared).
 */
export function useMe(options = {}) {
  const setAuth = useAuthStore((s) => s.setAuth)
  const { enabled = true } = options

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get('/auth/me')
        setAuth(data)
        return data
      } catch (err) {
        const { clearAuth } = useAuthStore.getState()
        clearAuth()
        throw err
      }
    },
    // Always reconcile persisted store with the real cookie session on app load.
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  })
}


// --- Forgot password OTP flow ---
export function useForgotPassword() {
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (username) => axiosInstance.post('/auth/forgot-password', { username }),
    onSuccess: (res) => {
      addToast({ type: 'info', message: res.data.message })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to send OTP. Try again later.',
      })
    },
  })
}

export function useVerifyOTP() {
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ email, otp_code }) => axiosInstance.post('/auth/verify-otp', { email, otp_code }),
    onSuccess: (res) => {
      addToast({ type: 'success', message: res.data.message })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Invalid or expired OTP.',
      })
    },
  })
}

export function useResetPassword() {
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) => axiosInstance.post('/auth/reset-password', payload),
    onSuccess: (res) => {
      addToast({ type: 'success', message: res.data.message })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to reset password.',
      })
    },
  })
}
