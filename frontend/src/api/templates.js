import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../utils/axiosInstance'
import { useToastStore } from '../store/uiStore'

// ── Query keys ────────────────────────────────────────────────────────────────
export const templateKeys = {
  all:    ()         => ['templates'],
  list:   (clubId)   => ['templates', 'list', clubId],
  presets: ()        => ['templates', 'presets'],
  detail: (id)       => ['templates', id],
}

// ── useTemplates ──────────────────────────────────────────────────────────────
/**
 * GET /clubs/:club_id/templates
 * Returns club's custom templates + all preset templates.
 */
export function useTemplates(clubId) {
  return useQuery({
    queryKey: templateKeys.list(clubId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/clubs/${clubId}/templates`)
      return data
    },
    enabled: !!clubId,
  })
}

// ── usePresetTemplates ────────────────────────────────────────────────────────
/**
 * GET /templates/presets
 * Admin-visible list of the 6 built-in preset templates.
 */
export function usePresetTemplates() {
  return useQuery({
    queryKey: templateKeys.presets(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/templates/presets')
      return data
    },
  })
}

// ── useTemplate ───────────────────────────────────────────────────────────────
/**
 * GET /templates/:template_id
 * Fetches a single template's full definition (elements, slots, styles).
 */
export function useTemplate(templateId) {
  return useQuery({
    queryKey: templateKeys.detail(templateId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/templates/${templateId}`)
      return data
    },
    enabled: !!templateId,
  })
}

// ── useCreateTemplate ─────────────────────────────────────────────────────────
/**
 * POST /clubs/:club_id/templates
 * Creates a new custom template.
 *
 * Payload shape:
 * {
 *   name: string,
 *   cert_type: string,
 *   background: { type: 'solid'|'gradient'|'decorated'|'minimalist', colors: string[] },
 *   typography: { font_family: string, font_color: string },
 *   elements: Array<{
 *     kind: 'static'|'dynamic'|'divider',
 *     text?: string,              // static text content
 *     label?: string,             // dynamic field slot name
 *     font_size: number,
 *     font_weight: 'normal'|'semibold'|'bold',
 *     alignment: 'left'|'center'|'right',
 *     position: { x: number, y: number, width: number, height: number }
 *   }>
 * }
 */
export function useCreateTemplate(clubId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) =>
      axiosInstance.post(`/clubs/${clubId}/templates`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.list(clubId) })
      addToast({ type: 'success', message: 'Template saved successfully.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to save template.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useAssignPreset ───────────────────────────────────────────────────────────
/**
 * POST /clubs/:club_id/events/:event_id/templates/assign-preset
 * { preset_id, cert_type }
 * Assigns a preset to the event's template_map for that cert type.
 */
export function useAssignPreset(clubId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ preset_id, cert_type }) =>
      axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/templates/assign-preset`,
        { preset_id, cert_type },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', clubId, eventId] })
      addToast({ type: 'success', message: 'Preset template assigned.' })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to assign preset.',
      })
    },
  })
}
