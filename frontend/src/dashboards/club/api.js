import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'

// ── Query keys ────────────────────────────────────────────────────────────────
export const clubKeys = {
  all:       ()             => ['clubs'],
  list:      (filters)      => ['clubs', 'list', filters],
  detail:    (clubId)       => ['clubs', clubId],
  dashboard: (clubId)       => ['clubs', clubId, 'dashboard'],
  assets:    (clubId)       => ['clubs', clubId, 'assets'],
  members:   (clubId)       => ['clubs', clubId, 'members'],
  users:     (clubId)       => ['clubs', clubId, 'users'],
}

// ── useClubs (admin) ──────────────────────────────────────────────────────────
/**
 * GET /admin/clubs with query params
 * @param {{ is_active?: boolean, search?: string }} filters
 */
export function useClubs(filters = {}) {
  return useQuery({
    queryKey: clubKeys.list(filters),
    queryFn: async () => {
      const params = {}
      if (filters.is_active !== undefined && filters.is_active !== null) {
        params.is_active = filters.is_active
      }
      if (filters.search) {
        params.search = filters.search
      }
      const { data } = await axiosInstance.get('/admin/clubs', { params })
      return data
    },
  })
}

// ── useClub ───────────────────────────────────────────────────────────────────
/**
 * GET /admin/clubs/{club_id}
 */
export function useClub(clubId) {
  return useQuery({
    queryKey: clubKeys.detail(clubId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/admin/clubs/${clubId}`)
      return data
    },
    enabled: !!clubId,
  })
}

// ── useClubDashboard ──────────────────────────────────────────────────────────
/**
 * GET /clubs/{club_id}/dashboard
 */
export function useClubDashboard(clubId) {
  return useQuery({
    queryKey: clubKeys.dashboard(clubId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/clubs/${clubId}/dashboard`)
      return data
    },
    enabled: !!clubId,
  })
}

export function useClubAssets(clubId) {
  return useQuery({
    queryKey: clubKeys.assets(clubId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/clubs/${clubId}/assets`)
      return data
    },
    enabled: !!clubId,
  })
}

export function useUpdateClubAssets(clubId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  const setRequiresProfileSetup = useAuthStore((s) => s.setRequiresProfileSetup)

  return useMutation({
    mutationFn: async ({ logoFile, signatureFile }) => {
      const formData = new FormData()
      if (logoFile) formData.append('logo', logoFile)
      if (signatureFile) formData.append('signature', signatureFile)
      const { data } = await axiosInstance.post(`/clubs/${clubId}/assets`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clubKeys.dashboard(clubId) })
      qc.invalidateQueries({ queryKey: clubKeys.assets(clubId) })
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      setRequiresProfileSetup(false)
      addToast({ type: 'success', message: 'Logo/signature updated.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to update assets.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useClubMembers ────────────────────────────────────────────────────────────
/**
 * GET /clubs/{club_id}/members
 */
export function useClubMembers(clubId) {
  return useQuery({
    queryKey: clubKeys.members(clubId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/clubs/${clubId}/members`)
      return data
    },
    enabled: !!clubId,
  })
}

// ── useClubUsers (admin) ──────────────────────────────────────────────────────
/**
 * GET /admin/clubs/{club_id}/users
 */
export function useClubUsers(clubId) {
  return useQuery({
    queryKey: clubKeys.users(clubId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/admin/clubs/${clubId}/users`)
      return data
    },
    enabled: !!clubId,
  })
}

// ── useCreateClub ─────────────────────────────────────────────────────────────
/**
 * POST /admin/clubs
 * Body: { name, slug, contact_email }
 */
export function useCreateClub() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) => axiosInstance.post('/admin/clubs', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clubs'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
      addToast({ type: 'success', message: 'Club created successfully.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to create club.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useUpdateClub ─────────────────────────────────────────────────────────────
/**
 * PATCH /admin/clubs/{club_id}
 * Body: { name?, contact_email?, is_active? }
 */
export function useUpdateClub() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ clubId, ...payload }) =>
      axiosInstance.patch(`/admin/clubs/${clubId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clubs'] })
      addToast({ type: 'success', message: 'Club updated.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to update club.'
      addToast({ type: 'error', message: msg })
    },
  })
}
