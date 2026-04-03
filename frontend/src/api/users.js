import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../utils/axiosInstance'
import { useToastStore } from '../store/uiStore'

// ── Query keys ────────────────────────────────────────────────────────────────
export const userKeys = {
  all:    ()           => ['users'],
  list:   (filters)    => ['users', 'list', filters],
  detail: (userId)     => ['users', userId],
}

// ── useUsers ──────────────────────────────────────────────────────────────────
/**
 * GET /admin/users with query params
 * @param {{ role?: string, club_id?: string, department?: string,
 *           is_active?: boolean, search?: string }} filters
 */
export function useUsers(filters = {}) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: async () => {
      const params = {}
      if (filters.role) params.role = filters.role
      if (filters.club_id) params.club_id = filters.club_id
      if (filters.department) params.department = filters.department
      if (filters.is_active !== undefined && filters.is_active !== null) {
        params.is_active = filters.is_active
      }
      if (filters.search) params.search = filters.search
      const { data } = await axiosInstance.get('/admin/users', { params })
      return data
    },
  })
}

// ── useUser ───────────────────────────────────────────────────────────────────
/**
 * GET /admin/users/{user_id}
 */
export function useUser(userId) {
  return useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/admin/users/${userId}`)
      return data
    },
    enabled: !!userId,
  })
}

// ── useCreateUser ─────────────────────────────────────────────────────────────
/**
 * POST /admin/users
 */
export function useCreateUser() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) => axiosInstance.post('/admin/users', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      addToast({ type: 'success', message: 'User created successfully.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to create user.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useUpdateUser ─────────────────────────────────────────────────────────────
/**
 * PATCH /admin/users/{user_id}
 */
export function useUpdateUser() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ userId, ...payload }) =>
      axiosInstance.patch(`/admin/users/${userId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      addToast({ type: 'success', message: 'User updated.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to update user.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useDeactivateUser ─────────────────────────────────────────────────────────
/**
 * DELETE /admin/users/{user_id}
 * Soft delete: sets is_active=False
 */
export function useDeactivateUser() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (userId) => axiosInstance.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      addToast({ type: 'success', message: 'User deactivated.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to deactivate user.'
      addToast({ type: 'error', message: msg })
    },
  })
}
