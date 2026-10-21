import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'

// ── Query Keys ────────────────────────────────────────────────────────────────
export const societyKeys = {
  all: () => ['societies'],
  list: (filters) => ['societies', 'list', filters],
  adminList: (filters) => ['admin', 'professional-societies', filters],
  detail: (societyId) => ['societies', societyId],
  dashboard: (societyId) => ['societies', societyId, 'dashboard'],
  events: (societyId) => ['societies', societyId, 'events'],
  eventDetail: (societyId, eventId) => ['societies', societyId, 'events', eventId],
  activeMembers: (societyId) => ['societies', societyId, 'active-members'],
  membershipRequests: () => ['society-coordinator', 'memberships', 'requests'],
  officeBearers: () => ['society-coordinator', 'office-bearers'],
  stats: () => ['society-coordinator', 'stats'],
}

const requireSocietyId = (societyId) => {
  if (!/^[a-f\d]{24}$/i.test(String(societyId || ''))) {
    throw new Error('Your professional society assignment is unavailable. Please sign in again.')
  }
  return societyId
}

// ── Admin Hooks ───────────────────────────────────────────────────────────────
export function useAdminSocieties(filters = {}) {
  return useQuery({
    queryKey: societyKeys.adminList(filters),
    queryFn: async () => {
      const params = {}
      if (filters.is_active !== undefined && filters.is_active !== null) {
        params.is_active = filters.is_active
      }
      if (filters.search) {
        params.search = filters.search
      }
      const { data } = await axiosInstance.get('/admin/professional-societies', { params })
      return data
    },
  })
}

export function useCreateAdminSociety() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) => axiosInstance.post('/admin/professional-societies', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'professional-societies'] })
      qc.invalidateQueries({ queryKey: ['societies'] })
      addToast({ type: 'success', message: 'Professional Society created successfully.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to create professional society.'
      addToast({ type: 'error', message: msg })
    },
  })
}

export function useUpdateAdminSociety() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ societyId, ...payload }) =>
      axiosInstance.patch(`/admin/professional-societies/${societyId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'professional-societies'] })
      qc.invalidateQueries({ queryKey: ['societies'] })
      addToast({ type: 'success', message: 'Professional Society updated.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to update professional society.'
      addToast({ type: 'error', message: msg })
    },
  })
}

export function useDeleteAdminSociety() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (societyId) => axiosInstance.delete(`/admin/professional-societies/${societyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'professional-societies'] })
      qc.invalidateQueries({ queryKey: ['societies'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      addToast({ type: 'success', message: 'Professional Society deleted.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to delete professional society.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── Coordinator Hooks ─────────────────────────────────────────────────────────
export function useSocietyDashboard(societyId) {
  return useQuery({
    queryKey: societyKeys.dashboard(societyId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/societies/${societyId}/dashboard`)
      return data
    },
    enabled: !!societyId,
  })
}

export function useSocietyCoordinatorStats() {
  return useQuery({
    queryKey: societyKeys.stats(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/society-coordinator/stats')
      return data
    },
  })
}

export function useSocietyEvents(societyId) {
  return useQuery({
    queryKey: societyKeys.events(societyId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/societies/${societyId}/events`)
      return data
    },
    enabled: !!societyId,
  })
}

export function useSocietyEvent(societyId, eventId) {
  return useQuery({
    queryKey: societyKeys.eventDetail(societyId, eventId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/societies/${societyId}/events/${eventId}`)
      return data
    },
    enabled: !!societyId && !!eventId,
  })
}

export function useCreateSocietyEvent(societyId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) => axiosInstance.post(`/societies/${requireSocietyId(societyId)}/events`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: societyKeys.events(societyId) })
      qc.invalidateQueries({ queryKey: societyKeys.dashboard(societyId) })
      addToast({ type: 'success', message: 'Event created successfully.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to create event.' })
    },
  })
}

export function useUpdateSocietyEvent(societyId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ eventId, ...payload }) =>
      axiosInstance.patch(`/societies/${requireSocietyId(societyId)}/events/${eventId}`, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: societyKeys.events(societyId) })
      qc.invalidateQueries({ queryKey: societyKeys.eventDetail(societyId, vars.eventId) })
      qc.invalidateQueries({ queryKey: societyKeys.dashboard(societyId) })
      addToast({ type: 'success', message: 'Event updated successfully.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to update event.' })
    },
  })
}

export function useDeleteSocietyEvent(societyId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (eventId) => axiosInstance.delete(`/societies/${requireSocietyId(societyId)}/events/${eventId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: societyKeys.events(societyId) })
      qc.invalidateQueries({ queryKey: societyKeys.dashboard(societyId) })
      addToast({ type: 'success', message: 'Event deleted successfully.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to delete event.' })
    },
  })
}

export function useUploadSocietyEventPoster(societyId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async ({ eventId, posterFile }) => {
      const formData = new FormData()
      formData.append('poster', posterFile)
      const { data } = await axiosInstance.post(
        `/societies/${requireSocietyId(societyId)}/events/${eventId}/poster`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: societyKeys.events(societyId) })
      qc.invalidateQueries({ queryKey: societyKeys.eventDetail(societyId, vars.eventId) })
      addToast({ type: 'success', message: 'Poster uploaded successfully.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to upload poster.' })
    },
  })
}

export function useUpdateSocietyAssets(societyId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async ({ logoFile, signatureFile }) => {
      const formData = new FormData()
      if (logoFile) formData.append('logo', logoFile)
      if (signatureFile) formData.append('signature', signatureFile)
      const { data } = await axiosInstance.post(`/societies/${requireSocietyId(societyId)}/assets`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: societyKeys.dashboard(societyId) })
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      addToast({ type: 'success', message: 'Society assets updated successfully.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to update assets.' })
    },
  })
}

export function useSocietyMembershipRequests() {
  return useQuery({
    queryKey: societyKeys.membershipRequests(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/society-coordinator/memberships/requests')
      return data
    },
  })
}

export function useReviewSocietyMembership() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ membershipId, action, reviewNote }) =>
      axiosInstance.patch(`/society-coordinator/memberships/${membershipId}`, {
        action,
        review_note: reviewNote,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: societyKeys.membershipRequests() })
      qc.invalidateQueries({ queryKey: societyKeys.stats() })
      qc.invalidateQueries({ queryKey: ['society-coordinator', 'active-members'] })
      addToast({ type: 'success', message: 'Membership status updated.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to update membership.' })
    },
  })
}

export function useBulkApproveSocietyMemberships() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ membershipIds, reviewNote }) =>
      axiosInstance.patch('/society-coordinator/memberships/requests/bulk-approve', {
        membership_ids: membershipIds,
        review_note: reviewNote,
      }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: societyKeys.membershipRequests() })
      qc.invalidateQueries({ queryKey: societyKeys.stats() })
      qc.invalidateQueries({ queryKey: ['society-coordinator', 'active-members'] })
      addToast({ type: 'success', message: data?.message || 'Memberships approved.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to approve memberships.' })
    },
  })
}

export function useDeleteSocietyMembership() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (membershipId) =>
      axiosInstance.delete(`/society-coordinator/memberships/${membershipId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: societyKeys.membershipRequests() })
      qc.invalidateQueries({ queryKey: societyKeys.stats() })
      qc.invalidateQueries({ queryKey: ['society-coordinator', 'active-members'] })
      addToast({ type: 'success', message: 'Membership removed successfully.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to remove membership.' })
    },
  })
}

export function useSocietyOfficeBearers() {
  return useQuery({
    queryKey: societyKeys.officeBearers(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/society-coordinator/office-bearers')
      return data
    },
  })
}

export function useAssignSocietyOfficeBearer() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ position, studentId, studentEmail }) =>
      axiosInstance.post('/society-coordinator/office-bearers', {
        position,
        student_id: studentId,
        student_email: studentEmail,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: societyKeys.officeBearers() })
      qc.invalidateQueries({ queryKey: ['society-coordinator', 'active-members'] })
      addToast({ type: 'success', message: 'Office bearer assigned successfully.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to assign office bearer.' })
    },
  })
}

export function useRemoveSocietyOfficeBearer() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (position) =>
      axiosInstance.delete(`/society-coordinator/office-bearers/${encodeURIComponent(position)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: societyKeys.officeBearers() })
      qc.invalidateQueries({ queryKey: ['society-coordinator', 'active-members'] })
      addToast({ type: 'success', message: 'Office bearer position unassigned.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to remove office bearer.' })
    },
  })
}

export function useSocietyActiveMembers() {
  return useQuery({
    queryKey: ['society-coordinator', 'active-members'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/society-coordinator/active-members')
      return data
    },
  })
}
