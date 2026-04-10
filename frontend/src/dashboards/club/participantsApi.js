import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'

function safeDetail(err, fallback) {
  const detail = err?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail.map(d => d?.msg ?? d?.message ?? JSON.stringify(d)).join(' | ')
  }
  return fallback
}

// ── Query keys ────────────────────────────────────────────────────────────────
export const participantKeys = {
  list:    (clubId, eventId)          => ['participants', clubId, eventId],
  mapping: (clubId, eventId)          => ['participants', clubId, eventId, 'mapping'],
  columns: (clubId, eventId)          => ['participants', clubId, eventId, 'columns'],
}

// ── useParticipants ───────────────────────────────────────────────────────────
/**
 * GET /clubs/:club_id/events/:event_id/participants
 * Optional query param: source=excel|manual
 */
export function useParticipants(clubId, eventId, source) {
  return useQuery({
    queryKey: [...participantKeys.list(clubId, eventId), source],
    queryFn: async () => {
      const params = source ? { source } : {}
      const { data } = await axiosInstance.get(
        `/clubs/${clubId}/events/${eventId}/participants`,
        { params },
      )
      return data
    },
    enabled: !!clubId && !!eventId,
  })
}

// ── useUploadExcel ────────────────────────────────────────────────────────────
/**
 * POST /clubs/:club_id/events/:event_id/participants/upload
 * Multipart form — file field named "file".
 * Returns { created, skipped, errors[] }
 */
export function useUploadExcel(clubId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (file) => {
      const formData = new FormData()
      formData.append('file', file)
      return axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/participants/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
    },
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: participantKeys.list(clubId, eventId) })
      // Also invalidate columns (backend derives them from uploaded data)
      qc.invalidateQueries({ queryKey: participantKeys.columns(clubId, eventId) })
      qc.invalidateQueries({ queryKey: ['clubs', clubId, 'dashboard'] })
      addToast({
        type: 'success',
        message: `${data.created ?? 0} participant(s) imported.`,
      })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: safeDetail(err, 'Excel upload failed.'),
      })
    },
  })
}

// ── useAddParticipant ─────────────────────────────────────────────────────────
/**
 * POST /clubs/:club_id/events/:event_id/participants
 * Single participant manual entry.
 */
export function useAddParticipant(clubId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) =>
      axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/participants`,
        payload,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: participantKeys.list(clubId, eventId) })
      qc.invalidateQueries({ queryKey: ['clubs', clubId, 'dashboard'] })
      addToast({ type: 'success', message: 'Participant added.' })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: safeDetail(err, 'Failed to add participant.'),
      })
    },
  })
}

// ── useVerifyParticipant ──────────────────────────────────────────────────────
/**
 * PATCH /clubs/:club_id/events/:event_id/participants/:participant_id/verify
 */
export function useVerifyParticipant(clubId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (participantId) =>
      axiosInstance.patch(
        `/clubs/${clubId}/events/${eventId}/participants/${participantId}/verify`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: participantKeys.list(clubId, eventId) })
      qc.invalidateQueries({ queryKey: ['clubs', clubId, 'dashboard'] })
      addToast({ type: 'success', message: 'Registration verified.' })
    },
    onError: () => {
      addToast({ type: 'error', message: 'Verification failed.' })
    },
  })
}

// ── useExcelColumns ───────────────────────────────────────────────────────────
/**
 * GET /clubs/:club_id/events/:event_id/participants/columns
 * Returns the list of column headers from the uploaded Excel.
 * { columns: string[] }
 */
export function useExcelColumns(clubId, eventId) {
  return useQuery({
    queryKey: participantKeys.columns(clubId, eventId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/clubs/${clubId}/events/${eventId}/participants/columns`,
      )
      return data
    },
    enabled: !!clubId && !!eventId,
  })
}

// ── useFieldMapping ───────────────────────────────────────────────────────────
/**
 * GET /clubs/:club_id/events/:event_id/participants/mapping
 * Returns the current saved column→slot mapping.
 * { mapping: { [slot]: column } }
 */
export function useFieldMapping(clubId, eventId) {
  return useQuery({
    queryKey: participantKeys.mapping(clubId, eventId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/clubs/${clubId}/events/${eventId}/participants/mapping`,
      )
      return data
    },
    enabled: !!clubId && !!eventId,
  })
}

// ── useConfirmMapping ─────────────────────────────────────────────────────────
/**
 * POST /clubs/:club_id/events/:event_id/participants/mapping
 * { mapping: { [slot]: column } }
 */
export function useConfirmMapping(clubId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (mapping) =>
      axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/participants/mapping`,
        { mapping },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: participantKeys.mapping(clubId, eventId) })
      addToast({ type: 'success', message: 'Field mapping confirmed.' })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: safeDetail(err, 'Failed to confirm mapping.'),
      })
    },
  })
}
