import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../utils/axiosInstance'
import { useToastStore } from '../store/uiStore'

// ── Query keys ────────────────────────────────────────────────────────────────
export const certKeys = {
  all:    ()                    => ['certificates'],
  list:   (clubId, eventId)     => ['certificates', clubId, eventId],
  detail: (clubId, eventId, id) => ['certificates', clubId, eventId, id],
}

// ── useCertificates ───────────────────────────────────────────────────────────
/**
 * GET /clubs/:club_id/events/:event_id/certificates
 * Lists all certificates for an event.
 * Supports optional `status` filter param.
 */
export function useCertificates(clubId, eventId, options = {}) {
  const { status, refetchInterval } = options

  return useQuery({
    queryKey: [...certKeys.list(clubId, eventId), status],
    queryFn: async () => {
      const params = status ? { status } : {}
      const { data } = await axiosInstance.get(
        `/clubs/${clubId}/events/${eventId}/certificates`,
        { params },
      )
      return data
    },
    enabled: !!clubId && !!eventId,
    refetchInterval: refetchInterval ?? false,
  })
}

// ── useGenerateCerts ──────────────────────────────────────────────────────────
/**
 * POST /clubs/:club_id/events/:event_id/certificates/generate
 * Triggers certificate generation for all participants.
 * Returns { job_id, total, message }
 */
export function useGenerateCerts(clubId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: () =>
      axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/certificates/generate`,
      ),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: certKeys.list(clubId, eventId) })
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

// ── useSendRemaining ──────────────────────────────────────────────────────────
/**
 * POST /clubs/:club_id/events/:event_id/certificates/send-remaining
 * Triggers email dispatch for all generated-but-not-emailed certs.
 * Returns { queued }
 */
export function useSendRemaining(clubId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: () =>
      axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/certificates/send-remaining`,
      ),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: certKeys.list(clubId, eventId) })
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

// ── useResendCert ─────────────────────────────────────────────────────────────
/**
 * POST /clubs/:club_id/events/:event_id/certificates/:cert_id/resend
 * Re-sends a single failed certificate email.
 */
export function useResendCert(clubId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (certId) =>
      axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/certificates/${certId}/resend`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: certKeys.list(clubId, eventId) })
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

// ── Admin hooks ───────────────────────────────────────────────────────────────

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
    mutationFn: (certId) =>
      axiosInstance.post(`/admin/certificates/${certId}/revoke`),
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
