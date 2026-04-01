import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../utils/axiosInstance'
import { useToastStore } from '../store/uiStore'

// ── Query keys ────────────────────────────────────────────────────────────────
export const adminKeys = {
  stats:    ()       => ['admin', 'stats'],
  clubs:    ()       => ['admin', 'clubs'],
  users:    ()       => ['admin', 'users'],
  certs:    (f)      => ['admin', 'certificates', f],
  activity: ()       => ['admin', 'activity'],
}

// ── useAdminStats ─────────────────────────────────────────────────────────────
/**
 * GET /admin/stats
 * {
 *   total_clubs, total_events, active_events,
 *   total_certs, total_students,
 *   pending_emails, failed_emails
 * }
 */
export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/stats')
      return data
    },
    refetchInterval: 60_000,   // refresh stats every minute
  })
}

// ── useAdminClubs ─────────────────────────────────────────────────────────────
/**
 * GET /admin/clubs
 * Returns all clubs with aggregate counts.
 */
export function useAdminClubs() {
  return useQuery({
    queryKey: adminKeys.clubs(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/clubs')
      return data
    },
  })
}

// ── useCreateAdminClub ────────────────────────────────────────────────────────
/**
 * POST /admin/clubs
 * { name, slug, contact_email }
 */
export function useCreateAdminClub() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) => axiosInstance.post('/admin/clubs', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.clubs() })
      qc.invalidateQueries({ queryKey: adminKeys.stats() })
      addToast({ type: 'success', message: 'Club created successfully.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to create club.' })
    },
  })
}

// ── useToggleClub ─────────────────────────────────────────────────────────────
/**
 * PATCH /admin/clubs/:club_id/toggle-active
 */
export function useToggleClub() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (clubId) =>
      axiosInstance.patch(`/admin/clubs/${clubId}/toggle-active`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.clubs() })
      addToast({ type: 'success', message: 'Club status updated.' })
    },
    onError: () => {
      addToast({ type: 'error', message: 'Failed to update club.' })
    },
  })
}

// ── useAdminUsers ─────────────────────────────────────────────────────────────
/**
 * GET /admin/users
 * Returns all platform users (coordinators, admins).
 */
export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/users')
      return data
    },
  })
}

// ── useCreateUser ─────────────────────────────────────────────────────────────
/**
 * POST /admin/users
 * { email, role, club_id?, name? }
 * Backend auto-generates initial password and emails the user.
 */
export function useCreateUser() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) => axiosInstance.post('/admin/users', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users() })
      qc.invalidateQueries({ queryKey: adminKeys.stats() })
      addToast({
        type: 'success',
        message: 'User created. Login credentials sent to their email.',
      })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to create user.',
      })
    },
  })
}

// ── useResetUserPassword ──────────────────────────────────────────────────────
/**
 * POST /admin/users/:user_id/reset-password
 * Generates new temporary password and emails user.
 */
export function useResetUserPassword() {
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (userId) =>
      axiosInstance.post(`/admin/users/${userId}/reset-password`),
    onSuccess: () => {
      addToast({ type: 'success', message: 'Password reset. New credentials emailed.' })
    },
    onError: () => {
      addToast({ type: 'error', message: 'Password reset failed.' })
    },
  })
}

// ── useToggleUser ─────────────────────────────────────────────────────────────
/**
 * PATCH /admin/users/:user_id/toggle-active
 */
export function useToggleUser() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (userId) =>
      axiosInstance.patch(`/admin/users/${userId}/toggle-active`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users() })
      addToast({ type: 'success', message: 'User status updated.' })
    },
    onError: () => {
      addToast({ type: 'error', message: 'Failed to update user.' })
    },
  })
}

// ── useAdminRecentActivity ────────────────────────────────────────────────────
/**
 * GET /admin/activity
 * Recent platform activity: cert generations, registrations, logins.
 * Array<{ action, actor, target, timestamp }>
 */
export function useAdminRecentActivity() {
  return useQuery({
    queryKey: adminKeys.activity(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/activity')
      return data
    },
    refetchInterval: 30_000,
  })
}
