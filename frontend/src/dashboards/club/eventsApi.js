import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'

// ── Helper ────────────────────────────────────────────────────────────────────
function extractErrorMsg(err, fallback) {
  const detail = err?.response?.data?.detail
  if (Array.isArray(detail)) {
    return detail.map(d => {
      if (typeof d === 'string') return d
      return d?.msg ?? d?.message ?? JSON.stringify(d)
    }).join(' | ')
  }
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') return detail?.msg ?? detail?.message ?? JSON.stringify(detail)
  return fallback
}

// ── Query keys ────────────────────────────────────────────────────────────────
export const eventKeys = {
  all:    ()                  => ['events'],
  list:   (clubId)            => ['events', 'list', clubId],
  detail: (clubId, eventId)   => ['events', clubId, eventId],
}

// ── useEvents ─────────────────────────────────────────────────────────────────
/**
 * GET /clubs/:club_id/events
 * Lists all events for a club.
 */
export function useEvents(clubId) {
  return useQuery({
    queryKey: eventKeys.list(clubId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/clubs/${clubId}/events`)
      return data
    },
    enabled: !!clubId,
  })
}

// ── useEvent ──────────────────────────────────────────────────────────────────
/**
 * GET /clubs/:club_id/events/:event_id
 * Fetches a single event's full details.
 */
export function useEvent(clubId, eventId) {
  return useQuery({
    queryKey: eventKeys.detail(clubId, eventId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/clubs/${clubId}/events/${eventId}`,
      )
      return data
    },
    enabled: !!clubId && !!eventId,
  })
}

// ── useCreateEvent ────────────────────────────────────────────────────────────
/**
 * POST /clubs/:club_id/events
 * { name, description?, event_date }
 *
 * Usage:
 *   const { mutate, isPending } = useCreateEvent(clubId)
 *   mutate({ name, description, event_date })
 */
export function useCreateEvent(clubId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) =>
      axiosInstance.post(`/clubs/${clubId}/events`, payload),

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKeys.list(clubId) })
      addToast({ type: 'success', message: 'Event created successfully.' })
    },

    onError: (err) => {
      const msg = extractErrorMsg(err, 'Failed to create event.')
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useUpdateEvent ────────────────────────────────────────────────────────────
/**
 * PUT /clubs/:club_id/events/:event_id
 * Full update: name, description, event_date, status
 *
 * Usage:
 *   const { mutate, isPending } = useUpdateEvent(clubId, eventId)
 *   mutate({ name, description, event_date, status })
 */
export function useUpdateEvent(clubId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) =>
      axiosInstance.put(`/clubs/${clubId}/events/${eventId}`, payload),

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKeys.detail(clubId, eventId) })
      qc.invalidateQueries({ queryKey: eventKeys.list(clubId) })
      addToast({ type: 'success', message: 'Event updated.' })
    },

    onError: (err) => {
      const msg = extractErrorMsg(err, 'Failed to update event.')
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useDeleteEvent ────────────────────────────────────────────────────────────
/**
 * DELETE /clubs/:club_id/events/:event_id
 * Only allowed for draft events with no issued certificates.
 *
 * Usage:
 *   const { mutate, isPending } = useDeleteEvent(clubId)
 *   mutate(eventId)
 */
export function useDeleteEvent(clubId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (eventId) =>
      axiosInstance.delete(`/clubs/${clubId}/events/${eventId}`),

    onSuccess: (_data, eventId) => {
      qc.invalidateQueries({ queryKey: eventKeys.list(clubId) })
      qc.removeQueries({ queryKey: eventKeys.detail(clubId, eventId) })
      addToast({ type: 'success', message: 'Event deleted.' })
    },

    onError: (err) => {
      const msg = extractErrorMsg(err, 'Failed to delete event.')
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useImageTemplates ─────────────────────────────────────────────────────────
/**
 * GET /image-templates  (public, no auth)
 * Returns the list of all active pre-built PNG certificate templates.
 * { id, filename, display_name, preview_url, is_active, created_at }[]
 */
export function useImageTemplates() {
  return useQuery({
    queryKey: ['image-templates'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/image-templates')
      return data
    },
  })
}

// ── useRolePresets ───────────────────────────────────────────────────────────
/**
 * GET /role-presets
 * Returns active role presets for auto role→template generation.
 */
export function useRolePresets() {
  return useQuery({
    queryKey: ['role-presets'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/role-presets')
      return data
    },
  })
}

// ── useAllFieldPositions ──────────────────────────────────────────────────────
/**
 * GET /clubs/:clubId/events/:eventId/field-positions
 * Returns ALL FieldPosition documents for this event (one per cert_type).
 * Returns [] if none saved yet.
 */
export function useAllFieldPositions(clubId, eventId) {
  return useQuery({
    queryKey: ['field-positions', clubId, eventId],
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get(
          `/clubs/${clubId}/events/${eventId}/field-positions`,
        )
        return data   // array of { cert_type, template_filename, column_positions, ... }
      } catch (err) {
        if (err?.response?.status === 404) return []
        throw err
      }
    },
    enabled: !!clubId && !!eventId,
  })
}

// ── useFieldPositionsForCertType ──────────────────────────────────────────────
/**
 * GET /clubs/:clubId/events/:eventId/field-positions/:certType
 * Returns FieldPosition for one cert_type, or null if not found.
 */
export function useFieldPositionsForCertType(clubId, eventId, certType) {
  return useQuery({
    queryKey: ['field-positions', clubId, eventId, certType],
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get(
          `/clubs/${clubId}/events/${eventId}/field-positions/${certType}`,
        )
        return data
      } catch (err) {
        if (err?.response?.status === 404) return null
        throw err
      }
    },
    enabled: !!clubId && !!eventId && !!certType,
  })
}

// ── useSaveFieldPositions ─────────────────────────────────────────────────────
/**
 * POST /clubs/:clubId/events/:eventId/field-positions
 * Upserts the FieldPosition document for this event + cert_type.
 * Payload: { cert_type, template_filename, column_positions, display_width, confirmed }
 */
export function useSaveFieldPositions(clubId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) =>
      axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/field-positions`,
        payload,
      ),
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ['field-positions', clubId, eventId] })
      if (payload?.cert_type) {
        qc.invalidateQueries({ queryKey: ['field-positions', clubId, eventId, payload.cert_type] })
      }
      qc.invalidateQueries({ queryKey: eventKeys.detail(clubId, eventId) })
      addToast({ type: 'success', message: 'Field positions saved.' })
    },
    onError: (err) => {
      const msg = extractErrorMsg(err, 'Failed to save field positions.')
      addToast({ type: 'error', message: msg })
    },
  })
}
