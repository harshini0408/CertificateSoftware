import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'

// ── Query keys ────────────────────────────────────────────────────────────────
export const templateKeys = {
  all:          ()       => ['templates'],
  list:         (clubId) => ['templates', 'list', clubId],
  presets:      ()       => ['templates', 'presets'],
  clubPresets:  (clubId) => ['templates', 'clubPresets', clubId],
  clubOwned:    ()       => ['templates', 'clubOwned'],
  detail:       (id)     => ['templates', id],
  html:         (id)     => ['templates', 'html', id],
}

// ── useTemplates ──────────────────────────────────────────────────────────────

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
export function usePresetTemplates() {
  return useQuery({
    queryKey: templateKeys.presets(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/templates/presets')
      return data
    },
  })
}

// ── useClubPresets ────────────────────────────────────────────────────────────
/**
 * GET /clubs/:club_id/templates/presets
 * Returns all 6 global presets + any club-specific copies (source_preset_id set).
 */
export function useClubPresets(clubId) {
  return useQuery({
    queryKey: templateKeys.clubPresets(clubId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/clubs/${clubId}/templates/presets`)
      return data
    },
    enabled: !!clubId,
  })
}

// ── useTemplate ───────────────────────────────────────────────────────────────
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

// ── useUpdatePresetSlots ──────────────────────────────────────────────────────
export function useUpdatePresetSlots(clubId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ cert_type, slot_updates }) =>
      axiosInstance.patch(
        `/clubs/${clubId}/events/${eventId}/templates/preset-slots`,
        { cert_type, slot_updates },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', clubId, eventId] })
      qc.invalidateQueries({ queryKey: templateKeys.all() })
      addToast({ type: 'success', message: 'Slot sizes saved.' })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to save slot sizes.',
      })
    },
  })
}


// ══════════════════════════════════════════════════════════════════════════════
// HTML Editor APIs
// ══════════════════════════════════════════════════════════════════════════════

// ── useClubOwnedTemplates ───────────────────────────────────────────────────
export function useClubOwnedTemplates() {
  return useQuery({
    queryKey: templateKeys.clubOwned(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/templates/club')
      return data
    },
  })
}

// ── useForkTemplate ─────────────────────────────────────────────────────────
export function useForkTemplate() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (templateId) => axiosInstance.post(`/templates/${templateId}/fork`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.all() })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to fork template.',
      })
    },
  })
}

// ── useTemplateHtml ─────────────────────────────────────────────────────────
export function useTemplateHtml(templateId) {
  return useQuery({
    queryKey: templateKeys.html(templateId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/templates/${templateId}/html`)
      return data
    },
    enabled: !!templateId,
  })
}

// ── useUpdateTemplateHtml ───────────────────────────────────────────────────
export function useUpdateTemplateHtml(templateId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) => axiosInstance.patch(`/templates/${templateId}/html`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.detail(templateId) })
      qc.invalidateQueries({ queryKey: templateKeys.html(templateId) })
      addToast({ type: 'success', message: 'Template saved.' })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to save template.',
      })
    },
  })
}
