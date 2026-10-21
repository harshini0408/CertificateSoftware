import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'

// ── Query keys ─────────────────────────────────────────────────────────────
export const templateKeys = {
  all:            ()          => ['templates'],
  list:           (societyId) => ['templates', 'list', societyId],
  presets:        ()          => ['templates', 'presets'],
  societyPresets: (societyId) => ['templates', 'societyPresets', societyId],
  clubPresets:    (societyId) => ['templates', 'societyPresets', societyId],
  societyOwned:   ()          => ['templates', 'societyOwned'],
  detail:         (id)        => ['templates', id],
  html:           (id)        => ['templates', 'html', id],
}

// ── useTemplates ───────────────────────────────────────────────────────────
export function useTemplates(societyId) {
  return useQuery({
    queryKey: templateKeys.list(societyId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/societies/${societyId}/templates`)
      return data
    },
    enabled: !!societyId,
  })
}

// ── usePresetTemplates ─────────────────────────────────────────────────────
export function usePresetTemplates() {
  return useQuery({
    queryKey: templateKeys.presets(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/templates/presets')
      return data
    },
  })
}

// ── useSocietyPresets ──────────────────────────────────────────────────────
/**
 * GET /societies/:society_id/templates/presets
 */
export function useSocietyPresets(societyId) {
  return useQuery({
    queryKey: templateKeys.societyPresets(societyId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/societies/${societyId}/templates/presets`)
      return data
    },
    enabled: !!societyId,
  })
}

export const useClubPresets = useSocietyPresets

// ── useTemplate ────────────────────────────────────────────────────────────
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

// ── useCreateTemplate ──────────────────────────────────────────────────────
export function useCreateTemplate(societyId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) =>
      axiosInstance.post(`/societies/${societyId}/templates`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: templateKeys.list(societyId) })
      addToast({ type: 'success', message: 'Template saved successfully.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to save template.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useAssignPreset ────────────────────────────────────────────────────────
export function useAssignPreset(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ preset_id, cert_type }) =>
      axiosInstance.post(
        `/societies/${societyId}/events/${eventId}/templates/assign-preset`,
        { preset_id, cert_type },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', societyId, eventId] })
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

// ── useUpdatePresetSlots ───────────────────────────────────────────────────
export function useUpdatePresetSlots(societyId, eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ cert_type, slot_updates }) =>
      axiosInstance.patch(
        `/societies/${societyId}/events/${eventId}/templates/update-preset-slots`,
        { cert_type, slot_updates },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events', societyId, eventId] })
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

// ─────────────────────────────────────────────────────────────────────────────
// HTML Editor APIs
// ─────────────────────────────────────────────────────────────────────────────

export function useSocietyOwnedTemplates() {
  return useQuery({
    queryKey: templateKeys.societyOwned(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/templates/club')
      return data
    },
  })
}

export const useClubOwnedTemplates = useSocietyOwnedTemplates

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
