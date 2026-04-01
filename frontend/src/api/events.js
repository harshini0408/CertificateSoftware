import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../utils/axiosInstance'
import { useToastStore } from '../store/uiStore'

// ── Query keys ────────────────────────────────────────────────────────────────
export const eventKeys = {
  all:    ()                       => ['events'],
  list:   (clubId)                 => ['events', 'list', clubId],
  detail: (clubId, eventId)        => ['events', clubId, eventId],
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
 * { name, description, event_date, template_map? }
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
      const msg = err?.response?.data?.detail || 'Failed to create event.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useUpdateEvent ────────────────────────────────────────────────────────────
/**
 * PATCH /clubs/:club_id/events/:event_id
 * Partial update: name, description, event_date, status, template_map
 */
export function useUpdateEvent(clubId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) =>
      axiosInstance.patch(`/clubs/${clubId}/events/${eventId}`, payload),

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKeys.detail(clubId, eventId) })
      qc.invalidateQueries({ queryKey: eventKeys.list(clubId) })
      addToast({ type: 'success', message: 'Event updated.' })
    },

    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to update event.'
      addToast({ type: 'error', message: msg })
    },
  })
}
