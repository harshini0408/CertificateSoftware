import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'

// ── Query keys ────────────────────────────────────────────────────────────────
export const clubKeys = {
  all:              ()             => ['clubs'],
  list:             (filters)      => ['clubs', 'list', filters],
  detail:           (clubId)       => ['clubs', clubId],
  dashboard:        (clubId)       => ['clubs', clubId, 'dashboard'],
  assets:           (clubId)       => ['clubs', clubId, 'assets'],
  members:          (clubId)       => ['clubs', clubId, 'members'],
  users:            (clubId)       => ['clubs', clubId, 'users'],
  membershipRequests: ()           => ['coordinator', 'memberships', 'requests'],
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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: clubKeys.dashboard(clubId) })
      qc.invalidateQueries({ queryKey: clubKeys.assets(clubId) })
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      const assets = data?.assets
      const isConfigured = assets?.is_configured === true
      setRequiresProfileSetup(!isConfigured)

      if (isConfigured) {
        addToast({ type: 'success', message: 'Club logo and faculty signature saved. Setup is complete.' })
        return
      }

      const missingAssets = []
      if (!assets?.logo_url) missingAssets.push('club logo')
      if (!assets?.signature_url) missingAssets.push('faculty signature')
      addToast({
        type: 'warning',
        message: missingAssets.length
          ? `Upload saved. Setup is still incomplete: ${missingAssets.join(' and ')} ${missingAssets.length === 1 ? 'is' : 'are'} still required.`
          : 'Upload saved, but setup is still incomplete. Please verify both the club logo and faculty signature.',
      })
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

// ── useDeleteClub ─────────────────────────────────────────────────────────────
/**
 * DELETE /admin/clubs/{club_id}
 */
export function useDeleteClub() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (clubId) =>
      axiosInstance.delete(`/admin/clubs/${clubId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clubs'] })
      qc.invalidateQueries({ queryKey: ['admin'] })
      qc.invalidateQueries({ queryKey: ['users'] })
      addToast({ type: 'success', message: 'Club and associated coordinator deleted successfully.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to delete club.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useMembershipRequests (coordinator) ──────────────────────────────────────
/**
 * GET /coordinator/memberships/requests
 */
export function useMembershipRequests() {
  return useQuery({
    queryKey: clubKeys.membershipRequests(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/coordinator/memberships/requests')
      return data
    },
  })
}

// ── useUpdateMembershipStatus (coordinator) ─────────────────────────────────
/**
 * PUT /coordinator/memberships/{membership_id}/status
 * Body: { status: 'approved' | 'rejected', review_note?: string }
 */
export function useUpdateMembershipStatus() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ membershipId, status, review_note }) =>
      axiosInstance.put(`/coordinator/memberships/${membershipId}/status`, { status, review_note }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: clubKeys.membershipRequests() })
      qc.invalidateQueries({ queryKey: ['coordinator', 'active-members'] })
      qc.invalidateQueries({ queryKey: ['coordinator', 'office-bearers'] })
      qc.invalidateQueries({ queryKey: ['clubs', 'me', 'memberships'] })
      qc.invalidateQueries({ queryKey: ['admin', 'student-club-memberships'] })
      qc.invalidateQueries({ queryKey: ['tutor'] })
      qc.invalidateQueries({ queryKey: ['hod'] })
      qc.invalidateQueries({ queryKey: ['principal'] })
      addToast({
        type: 'success',
        message: vars.status === 'approved' ? 'Membership approved.' : 'Membership rejected.',
      })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to update membership status.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useClubOfficeBearers (coordinator) ────────────────────────────────────────
/**
 * GET /coordinator/office-bearers
 */
export function useClubOfficeBearers() {
  return useQuery({
    queryKey: ['coordinator', 'office-bearers'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/coordinator/office-bearers')
      return data
    },
  })
}

// ── useAllocateOfficeBearer (coordinator) ─────────────────────────────────────
/**
 * POST /coordinator/office-bearers/allocate
 * Body: { position: string, student_id: string }
 */
export function useAllocateOfficeBearer() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async ({ position, student_id }) => {
      const { data } = await axiosInstance.post('/coordinator/office-bearers/allocate', { position, student_id })
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['coordinator', 'office-bearers'] })
      qc.invalidateQueries({ queryKey: clubKeys.membershipRequests() })
      addToast({ type: 'success', message: data?.message || 'Office bearer allocated successfully.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to allocate office bearer.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useRemoveOfficeBearer (coordinator) ──────────────────────────────────────
/**
 * DELETE /coordinator/office-bearers/{position}
 */
export function useRemoveOfficeBearer() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (position) => {
      const { data } = await axiosInstance.delete(`/coordinator/office-bearers/${encodeURIComponent(position)}`)
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['coordinator', 'office-bearers'] })
      qc.invalidateQueries({ queryKey: clubKeys.membershipRequests() })
      addToast({ type: 'success', message: data?.message || 'Office bearer position unassigned.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to unassign office bearer.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useAddOfficeBearerPosition (coordinator) ─────────────────────────────────
/**
 * POST /coordinator/office-bearers/positions
 * Body: { position: string }
 */
export function useAddOfficeBearerPosition() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (position) => {
      const { data } = await axiosInstance.post('/coordinator/office-bearers/positions', { position })
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['coordinator', 'office-bearers'] })
      addToast({ type: 'success', message: data?.message || 'Position added successfully.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to add position.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useDeleteOfficeBearerPosition (coordinator) ──────────────────────────────
/**
 * DELETE /coordinator/office-bearers/positions/{position}
 */
export function useDeleteOfficeBearerPosition() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (position) => {
      const { data } = await axiosInstance.delete(`/coordinator/office-bearers/positions/${encodeURIComponent(position)}`)
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['coordinator', 'office-bearers'] })
      addToast({ type: 'success', message: data?.message || 'Position removed.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to remove position.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useClubActiveMembers (coordinator) ───────────────────────────────────────
/**
 * GET /coordinator/active-members
 */
export function useClubActiveMembers() {
  return useQuery({
    queryKey: ['coordinator', 'active-members'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/coordinator/active-members')
      return data
    },
  })
}

// ── useBulkApproveMemberships (coordinator) ──────────────────────────────────
/**
 * POST /coordinator/memberships/bulk-approve
 * Body: { membership_ids: string[], review_note?: string }
 */
export function useBulkApproveMemberships() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ membershipIds, review_note }) =>
      axiosInstance.post('/coordinator/memberships/bulk-approve', {
        membership_ids: membershipIds,
        review_note,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: clubKeys.membershipRequests() })
      qc.invalidateQueries({ queryKey: ['coordinator', 'active-members'] })
      qc.invalidateQueries({ queryKey: ['coordinator', 'office-bearers'] })
      qc.invalidateQueries({ queryKey: ['clubs', 'me', 'memberships'] })
      qc.invalidateQueries({ queryKey: ['admin', 'student-club-memberships'] })
      qc.invalidateQueries({ queryKey: ['tutor'] })
      qc.invalidateQueries({ queryKey: ['hod'] })
      qc.invalidateQueries({ queryKey: ['principal'] })
      addToast({
        type: 'success',
        message: res.data?.message || 'Membership requests approved.',
      })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to approve membership requests.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useRemoveClubMember (coordinator) ─────────────────────────────────────────
/**
 * DELETE /coordinator/members/:identifier
 */
export function useRemoveClubMember() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (identifier) =>
      axiosInstance.delete(`/coordinator/members/${identifier}`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['coordinator', 'active-members'] })
      qc.invalidateQueries({ queryKey: clubKeys.membershipRequests() })
      qc.invalidateQueries({ queryKey: ['coordinator', 'office-bearers'] })
      qc.invalidateQueries({ queryKey: ['clubs', 'me', 'memberships'] })
      qc.invalidateQueries({ queryKey: ['admin', 'student-club-memberships'] })
      qc.invalidateQueries({ queryKey: ['tutor'] })
      qc.invalidateQueries({ queryKey: ['hod'] })
      qc.invalidateQueries({ queryKey: ['principal'] })
      addToast({
        type: 'success',
        message: res.data?.message || 'Member removed from club.',
      })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to remove club member.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useDeleteMembershipRequest (coordinator) ─────────────────────────────────
/**
 * DELETE /coordinator/memberships/:membershipId
 */
export function useDeleteMembershipRequest() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (membershipId) =>
      axiosInstance.delete(`/coordinator/memberships/${membershipId}`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: clubKeys.membershipRequests() })
      qc.invalidateQueries({ queryKey: ['coordinator', 'active-members'] })
      qc.invalidateQueries({ queryKey: ['coordinator', 'office-bearers'] })
      qc.invalidateQueries({ queryKey: ['clubs', 'me', 'memberships'] })
      qc.invalidateQueries({ queryKey: ['admin', 'student-club-memberships'] })
      qc.invalidateQueries({ queryKey: ['tutor'] })
      qc.invalidateQueries({ queryKey: ['hod'] })
      qc.invalidateQueries({ queryKey: ['principal'] })
      addToast({
        type: 'success',
        message: res.data?.message || 'Membership request removed.',
      })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to remove membership request.'
      addToast({ type: 'error', message: msg })
    },
  })
}
