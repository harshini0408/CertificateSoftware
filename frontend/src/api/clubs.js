import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../utils/axiosInstance'
import { useToastStore } from '../store/uiStore'

// ── Query keys ────────────────────────────────────────────────────────────────
export const clubKeys = {
  all:    ()           => ['clubs'],
  list:   ()           => ['clubs', 'list'],
  detail: (clubId)     => ['clubs', clubId],
  stats:  (clubId)     => ['clubs', clubId, 'stats'],
}

// ── useClub ───────────────────────────────────────────────────────────────────
/**
 * GET /clubs/:club_id
 * Fetches a single club's details.
 */
export function useClub(clubId) {
  return useQuery({
    queryKey: clubKeys.detail(clubId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/clubs/${clubId}`)
      return data
    },
    enabled: !!clubId,
  })
}

// ── useClubStats ──────────────────────────────────────────────────────────────
/**
 * GET /clubs/:club_id/stats
 * Returns { total_events, certs_issued, pending_emails, failed_emails }
 */
export function useClubStats(clubId) {
  return useQuery({
    queryKey: clubKeys.stats(clubId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/clubs/${clubId}/stats`)
      return data
    },
    enabled: !!clubId,
  })
}

// ── useAllClubs (admin) ───────────────────────────────────────────────────────
/**
 * GET /clubs
 * Admin-only: lists all clubs.
 */
export function useAllClubs() {
  return useQuery({
    queryKey: clubKeys.list(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/clubs')
      return data
    },
  })
}

// ── useCreateClub (admin) ─────────────────────────────────────────────────────
/**
 * POST /clubs
 * { name, slug, contact_email }
 */
export function useCreateClub() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) => axiosInstance.post('/clubs', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clubKeys.list() })
      addToast({ type: 'success', message: 'Club created successfully.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to create club.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── usePatchClub (admin) ──────────────────────────────────────────────────────
/**
 * PATCH /clubs/:club_id
 * Partial update: name, contact_email, is_active
 */
export function usePatchClub(clubId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) => axiosInstance.patch(`/clubs/${clubId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clubKeys.detail(clubId) })
      qc.invalidateQueries({ queryKey: clubKeys.list() })
      addToast({ type: 'success', message: 'Club updated.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to update club.'
      addToast({ type: 'error', message: msg })
    },
  })
}
