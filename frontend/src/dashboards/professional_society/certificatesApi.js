import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'
import { participantKeys } from './participantsApi'
import { eventKeys } from './eventsApi'

// ── Query keys ─────────────────────────────────────────────────────────────
export const certKeys = {
  all:    ()                        => ['certificates'],
  list:   (societyId, eventId)     => ['certificates', societyId, eventId],
  detail: (societyId, eventId, id) => ['certificates', societyId, eventId, id],
}

// ── useCertificates ────────────────────────────────────────────────────────
/**
 * GET /societies/:society_id/events/:event_id/certificates
 * Lists all certificates for an event.
 * Supports optional `status` filter param.
 */
export function useCertificates(societyId, eventId, options = {}) {
  const { status, refetchInterval } = options

  return useQuery({
    queryKey: [...certKeys.list(societyId, eventId), status],
    queryFn: async () => {
      const params = status ? { status } : {}
      const { data } = await axiosInstance.get(
        `/societies/${societyId}/events/${eventId}/certificates`,
        { params },
      )
      return data
    },
    enabled: !!societyId && !!eventId,
    refetchInterval: refetchInterval ?? false,
  })
}

// ── useGenerateCerts ───────────────────────────────────────────────────────
/**
 * POST /societies/:society_id/events/:event_id/certificates/generate
 * Triggers certificate generation for all participants.
 * Returns { job_id, total, message }
 */
export function useGenerateCerts(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: () =>
      axiosInstance.post(
        `/societies/${societyId}/events/${eventId}/certificates/generate`,
      ),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: certKeys.list(societyId, eventId) })
      qc.invalidateQueries({ queryKey: participantKeys.list(societyId, eventId) })
      qc.invalidateQueries({ queryKey: eventKeys.detail(societyId, eventId) })
      qc.invalidateQueries({ queryKey: ['societies', societyId, 'dashboard'] })
      addToast({
        type: 'success',
        message:
          data?.message ||
          `Generation started — ${data.queued_count ?? 0} of ${data.total ?? 0} certificate(s) queued.`,
      })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to start certificate generation.',
      })
    },
  })
}

// ── useSendRemaining ───────────────────────────────────────────────────────
/**
 * POST /societies/:society_id/events/:event_id/certificates/send-remaining
 * Triggers email dispatch for all generated-but-not-emailed certs.
 * Returns { queued }
 */
export function useSendRemaining(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: () =>
      axiosInstance.post(
        `/societies/${societyId}/events/${eventId}/certificates/send-remaining`,
      ),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: certKeys.list(societyId, eventId) })
      qc.invalidateQueries({ queryKey: eventKeys.detail(societyId, eventId) })
      qc.invalidateQueries({ queryKey: ['societies', societyId, 'dashboard'] })
      addToast({
        type: 'success',
        message: `${data.queued ?? 0} email(s) queued for dispatch.`,
      })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to queue emails.',
      })
    },
  })
}

// ── useResendCert ──────────────────────────────────────────────────────────
/**
 * POST /societies/:society_id/events/:event_id/certificates/:cert_id/resend
 * Re-sends a single failed certificate email.
 */
export function useResendCert(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (certId) =>
      axiosInstance.post(
        `/societies/${societyId}/events/${eventId}/certificates/${certId}/resend`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: certKeys.list(societyId, eventId) })
      qc.invalidateQueries({ queryKey: eventKeys.detail(societyId, eventId) })
      qc.invalidateQueries({ queryKey: ['societies', societyId, 'dashboard'] })
      addToast({ type: 'success', message: 'Email re-queued.' })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Resend failed.',
      })
    },
  })
}

// ── Admin hooks ────────────────────────────────────────────────────────────

// useAllCerts — admin use
export function useAllCerts(filters = {}) {
  return useQuery({
    queryKey: ['admin', 'certificates', filters],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/certificates', {
        params: filters,
      })
      return data
    },
  })
}

// useRevokeCert — admin use
export function useRevokeCert() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (certNumber) =>
      axiosInstance.patch(`/admin/certificates/${certNumber}/revoke`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'certificates'] })
      addToast({ type: 'success', message: 'Certificate revoked.' })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Revoke failed.',
      })
    },
  })
}
