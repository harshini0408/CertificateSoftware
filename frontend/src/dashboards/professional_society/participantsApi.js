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

// ── Query keys ─────────────────────────────────────────────────────────────
export const participantKeys = {
  list:    (societyId, eventId)          => ['participants', societyId, eventId],
  mapping: (societyId, eventId)          => ['participants', societyId, eventId, 'mapping'],
  columns: (societyId, eventId)          => ['participants', societyId, eventId, 'columns'],
}

// ── useParticipants ────────────────────────────────────────────────────────
/**
 * GET /societies/:society_id/events/:event_id/participants
 * Optional query param: source=excel|manual
 */
export function useParticipants(societyId, eventId, source) {
  return useQuery({
    queryKey: [...participantKeys.list(societyId, eventId), source],
    queryFn: async () => {
      const params = source ? { source } : {}
      const { data } = await axiosInstance.get(
        `/societies/${societyId}/events/${eventId}/participants`,
        { params },
      )
      return data
    },
    enabled: !!societyId && !!eventId,
  })
}

// ── useUploadExcel ─────────────────────────────────────────────────────────
/**
 * POST /societies/:society_id/events/:event_id/participants/upload
 * Multipart form — file field named "file".
 * Returns { created, skipped, errors[] }
 */
export function useUploadExcel(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (file) => {
      const formData = new FormData()
      formData.append('file', file)
      return axiosInstance.post(
        `/societies/${societyId}/events/${eventId}/participants/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
    },
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: participantKeys.list(societyId, eventId) })
      qc.invalidateQueries({ queryKey: participantKeys.columns(societyId, eventId) })
      qc.invalidateQueries({ queryKey: ['events', societyId, eventId] })
      qc.invalidateQueries({ queryKey: ['societies', societyId, 'dashboard'] })
      addToast({
        type: 'success',
        message: `Upload complete: ${data.created ?? 0} participants added, ${data.skipped ?? 0} skipped.`,
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

// ── useExcelColumns ────────────────────────────────────────────────────────
/**
 * GET /societies/:society_id/events/:event_id/participants/columns
 * Returns string[] — column headers detected from the uploaded Excel sheet.
 */
export function useExcelColumns(societyId, eventId) {
  return useQuery({
    queryKey: participantKeys.columns(societyId, eventId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/societies/${societyId}/events/${eventId}/participants/columns`,
      )
      return data
    },
    enabled: !!societyId && !!eventId,
  })
}

// ── useFieldMapping ────────────────────────────────────────────────────────
/**
 * GET /societies/:society_id/events/:event_id/participants/mapping
 * Returns { mapping: { [slot]: column } }
 */
export function useFieldMapping(societyId, eventId) {
  return useQuery({
    queryKey: participantKeys.mapping(societyId, eventId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/societies/${societyId}/events/${eventId}/participants/mapping`,
      )
      return data
    },
    enabled: !!societyId && !!eventId,
  })
}

// ── useConfirmMapping ──────────────────────────────────────────────────────
/**
 * POST /societies/:society_id/events/:event_id/participants/mapping
 * { mapping: { [slot]: column } }
 */
export function useConfirmMapping(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (mapping) =>
      axiosInstance.post(
        `/societies/${societyId}/events/${eventId}/participants/mapping`,
        { mapping },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: participantKeys.mapping(societyId, eventId) })
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

// ── useUpdateParticipantType ───────────────────────────────────────────────
/**
 * PATCH /societies/:society_id/events/:event_id/participants/:participant_id/type
 * { cert_type: string }
 */
export function useUpdateParticipantType(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ participantId, cert_type }) =>
      axiosInstance.patch(
        `/societies/${societyId}/events/${eventId}/participants/${participantId}/type`,
        { cert_type },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: participantKeys.list(societyId, eventId) })
      addToast({ type: 'success', message: 'Participant type updated.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: safeDetail(err, 'Update failed.') })
    },
  })
}

// ── useVerifyParticipant ───────────────────────────────────────────────────
/**
 * PATCH /societies/:society_id/events/:event_id/participants/:participant_id/verify
 * { verified: boolean }
 */
export function useVerifyParticipant(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ participantId, verified }) =>
      axiosInstance.patch(
        `/societies/${societyId}/events/${eventId}/participants/${participantId}/verify`,
        { verified },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: participantKeys.list(societyId, eventId) })
      addToast({ type: 'success', message: 'Participant verification updated.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: safeDetail(err, 'Verification update failed.') })
    },
  })
}

// ── useDeleteParticipant ───────────────────────────────────────────────────
/**
 * DELETE /societies/:society_id/events/:event_id/participants/:participant_id
 */
export function useDeleteParticipant(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (participantId) =>
      axiosInstance.delete(
        `/societies/${societyId}/events/${eventId}/participants/${participantId}`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: participantKeys.list(societyId, eventId) })
      qc.invalidateQueries({ queryKey: ['societies', societyId, 'dashboard'] })
      addToast({ type: 'success', message: 'Participant removed.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: safeDetail(err, 'Failed to remove participant.') })
    },
  })
}
