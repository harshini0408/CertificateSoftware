import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'

// ── Helper ─────────────────────────────────────────────────────────────────
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

// ── Query keys ─────────────────────────────────────────────────────────────
export const eventKeys = {
  all:    ()                        => ['events'],
  list:   (societyId)               => ['events', 'list', societyId],
  detail: (societyId, eventId)      => ['events', societyId, eventId],
}

const isValidHexId = (val) => Boolean(val && val !== 'null' && val !== 'undefined' && /^[a-f\d]{24}$/i.test(String(val)))

// ── useEvents ──────────────────────────────────────────────────────────────
/**
 * GET /societies/:society_id/events
 * Lists all events for a professional society.
 */
export function useEvents(societyId) {
  return useQuery({
    queryKey: eventKeys.list(societyId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/societies/${societyId}/events`)
      return data
    },
    enabled: isValidHexId(societyId),
  })
}

// ── useEvent ───────────────────────────────────────────────────────────────
/**
 * GET /societies/:society_id/events/:event_id
 * Fetches a single event's full details.
 */
export function useEvent(societyId, eventId) {
  return useQuery({
    queryKey: eventKeys.detail(societyId, eventId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/societies/${societyId}/events/${eventId}`,
      )
      return data
    },
    enabled: isValidHexId(societyId) && isValidHexId(eventId),
  })
}

// ── useCreateEvent ─────────────────────────────────────────────────────────
/**
 * POST /societies/:society_id/events
 */
export function useCreateEvent(societyId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) =>
      axiosInstance.post(`/societies/${societyId}/events`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKeys.list(societyId) })
      qc.invalidateQueries({ queryKey: ['societies', societyId, 'dashboard'] })
      addToast({ type: 'success', message: 'Event created successfully.' })
    },
    onError: (err) => {
      const msg = extractErrorMsg(err, 'Failed to create event.')
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useUpdateEvent ─────────────────────────────────────────────────────────
/**
 * PATCH /societies/:society_id/events/:event_id
 */
export function useUpdateEvent(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) =>
      axiosInstance.patch(`/societies/${societyId}/events/${eventId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKeys.detail(societyId, eventId) })
      qc.invalidateQueries({ queryKey: eventKeys.list(societyId) })
      qc.invalidateQueries({ queryKey: ['societies', societyId, 'dashboard'] })
      addToast({ type: 'success', message: 'Event updated successfully.' })
    },
    onError: (err) => {
      const msg = extractErrorMsg(err, 'Failed to update event.')
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useDeleteEvent ─────────────────────────────────────────────────────────
/**
 * DELETE /societies/:society_id/events/:event_id
 */
export function useDeleteEvent(societyId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (eventId) =>
      axiosInstance.delete(`/societies/${societyId}/events/${eventId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKeys.list(societyId) })
      qc.invalidateQueries({ queryKey: ['societies', societyId, 'dashboard'] })
      addToast({ type: 'success', message: 'Event deleted successfully.' })
    },
    onError: (err) => {
      const msg = extractErrorMsg(err, 'Failed to delete event.')
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useImageTemplates ──────────────────────────────────────────────────────
/**
 * GET /templates/images
 * Lists predefined PNG background templates available for click-to-place.
 */
export function useImageTemplates() {
  return useQuery({
    queryKey: ['templates', 'images'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/templates/images')
      return data
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ── useAllFieldPositions ───────────────────────────────────────────────────
/**
 * GET /societies/:societyId/events/:eventId/field-positions
 * Returns all saved FieldPosition docs for the event across all cert_types:
 * { [cert_type]: { template_filename, column_positions, display_width, confirmed } }
 */
export function useAllFieldPositions(societyId, eventId) {
  return useQuery({
    queryKey: ['field-positions', societyId, eventId],
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/societies/${societyId}/events/${eventId}/field-positions`,
      )
      return data
    },
    enabled: !!societyId && !!eventId,
  })
}

// ── useFieldPositions ──────────────────────────────────────────────────────
/**
 * GET /societies/:societyId/events/:eventId/field-positions/:cert_type
 * Returns the FieldPosition document for this event + cert_type, or null if none saved.
 */
export function useFieldPositions(societyId, eventId, certType) {
  return useQuery({
    queryKey: ['field-positions', societyId, eventId, certType],
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get(
          `/societies/${societyId}/events/${eventId}/field-positions/${certType}`,
        )
        return data
      } catch (err) {
        if (err?.response?.status === 404) return null
        throw err
      }
    },
    enabled: !!societyId && !!eventId && !!certType,
  })
}

export function useFieldPositionByType(societyId, eventId, certType) {
  return useQuery({
    queryKey: ['field-positions', societyId, eventId, certType],
    queryFn: async () => {
      try {
        const { data } = await axiosInstance.get(
          `/societies/${societyId}/events/${eventId}/field-positions/${certType}`,
        )
        return data
      } catch (err) {
        if (err?.response?.status === 404) return null
        throw err
      }
    },
    enabled: !!societyId && !!eventId && !!certType,
  })
}

// ── useSaveFieldPositions ──────────────────────────────────────────────────
/**
 * POST /societies/:societyId/events/:eventId/field-positions
 * Upserts the FieldPosition document for this event + cert_type.
 * Payload: { cert_type, template_filename, column_positions, display_width, confirmed }
 */
export function useSaveFieldPositions(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) =>
      axiosInstance.post(
        `/societies/${societyId}/events/${eventId}/field-positions`,
        payload,
      ),
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ['field-positions', societyId, eventId] })
      if (payload?.cert_type) {
        qc.invalidateQueries({ queryKey: ['field-positions', societyId, eventId, payload.cert_type] })
      }
      qc.invalidateQueries({ queryKey: eventKeys.detail(societyId, eventId) })
      addToast({ type: 'success', message: 'Field positions saved.' })
    },
    onError: (err) => {
      const msg = extractErrorMsg(err, 'Failed to save field positions.')
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useUploadPoster ────────────────────────────────────────────────────────
export function useUploadPoster(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (file) => {
      const formData = new FormData()
      formData.append('poster', file)
      const { data } = await axiosInstance.post(
        `/societies/${societyId}/events/${eventId}/poster`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKeys.detail(societyId, eventId) })
      qc.invalidateQueries({ queryKey: eventKeys.list(societyId) })
      addToast({ type: 'success', message: 'Poster uploaded successfully.' })
    },
    onError: (err) => {
      const msg = extractErrorMsg(err, 'Failed to upload poster.')
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useSocietyCreditRules ──────────────────────────────────────────────────
export function useSocietyCreditRules(societyId) {
  return useQuery({
    queryKey: ['society-credit-rules', societyId],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/societies/${societyId}/credit-rules`)
      return data
    },
    enabled: !!societyId,
  })
}

// Alias for drop-in compatibility
export const useClubCreditRules = useSocietyCreditRules

// ── Volunteer Requests Hooks ───────────────────────────────────────────────
export function useVolunteerRequests(societyId, eventId) {
  return useQuery({
    queryKey: ['events', societyId, eventId, 'volunteers'],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/societies/${societyId}/events/${eventId}/volunteers`)
      return data
    },
    enabled: !!societyId && !!eventId,
  })
}

export function useUpdateVolunteerStatus(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async ({ itemId, status }) => {
      const { data } = await axiosInstance.patch(
        `/societies/${societyId}/events/${eventId}/volunteers/${itemId}`,
        { status },
      )
      return data
    },
    onSuccess: (_, { status }) => {
      qc.invalidateQueries({ queryKey: ['events', societyId, eventId, 'volunteers'] })
      qc.invalidateQueries({ queryKey: ['participants', societyId, eventId] })
      qc.invalidateQueries({ queryKey: eventKeys.detail(societyId, eventId) })
      qc.invalidateQueries({ queryKey: eventKeys.list(societyId) })
      addToast({
        type: 'success',
        message: `Volunteer request ${status === 'accepted' ? 'accepted' : 'rejected'} successfully.`,
      })
    },
    onError: (err) => {
      const msg = extractErrorMsg(err, 'Failed to update volunteer status.')
      addToast({ type: 'error', message: msg })
    },
  })
}

export function useUpdateVolunteerCount(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (volunteers_required) => {
      const { data } = await axiosInstance.patch(
        `/societies/${societyId}/events/${eventId}/volunteers-count`,
        { volunteers_required: Number(volunteers_required) },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKeys.detail(societyId, eventId) })
      qc.invalidateQueries({ queryKey: eventKeys.list(societyId) })
      qc.invalidateQueries({ queryKey: ['events', societyId, eventId, 'volunteers'] })
      addToast({ type: 'success', message: 'Volunteer count updated successfully.' })
    },
    onError: (err) => {
      const msg = extractErrorMsg(err, 'Failed to update volunteer count.')
      addToast({ type: 'error', message: msg })
    },
  })
}
