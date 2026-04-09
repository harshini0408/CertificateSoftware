import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'

export const deptKeys = {
  dashboard: () => ['dept', 'dashboard'],
  events: () => ['dept', 'events'],
  deptAssets: () => ['dept', 'assets'],
  eventTemplate: (eventId) => ['dept', 'event-template', eventId],
  eventMapping: (eventId) => ['dept', 'event-mapping', eventId],
  assets: () => ['dept', 'assets-status'],
  certs: () => ['dept', 'certificates'],
  students: (filters) => ['dept', 'students', filters],
}

export function useDeptDashboard() {
  return useQuery({
    queryKey: deptKeys.dashboard(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/dept/dashboard')
      return data
    },
  })
}

export function useDeptEvents() {
  return useQuery({
    queryKey: deptKeys.events(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/dept/events')
      return data
    },
  })
}

export function useCreateDeptEvent() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/dept/events', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deptKeys.events() })
      qc.invalidateQueries({ queryKey: deptKeys.dashboard() })
      addToast({ type: 'success', message: 'Event created successfully.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to create event.' })
    },
  })
}

export function useDeptAssets() {
  return useQuery({
    queryKey: deptKeys.deptAssets(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/dept/assets')
      return data
    },
  })
}

export function useUpdateDeptAssets() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)
  const setRequiresProfileSetup = useAuthStore((s) => s.setRequiresProfileSetup)

  return useMutation({
    mutationFn: async ({ logoFile, signatureFile }) => {
      const formData = new FormData()
      if (logoFile) formData.append('logo', logoFile)
      if (signatureFile) formData.append('signature', signatureFile)
      const { data } = await axiosInstance.post('/dept/assets', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deptKeys.deptAssets() })
      qc.invalidateQueries({ queryKey: deptKeys.dashboard() })
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      setRequiresProfileSetup(false)
      addToast({ type: 'success', message: 'Logo/signature updated.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to update assets.' })
    },
  })
}

export function useDeptEventTemplate(eventId) {
  return useQuery({
    queryKey: deptKeys.eventTemplate(eventId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/dept/events/${eventId}/template`)
      return data
    },
    enabled: !!eventId,
  })
}

export function useUploadDeptEventTemplate(eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (file) => {
      const formData = new FormData()
      formData.append('template_file', file)
      const { data } = await axiosInstance.post(`/dept/events/${eventId}/template`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deptKeys.eventTemplate(eventId) })
      addToast({ type: 'success', message: 'Event template uploaded.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to upload template.' })
    },
  })
}

export async function extractDeptExcelHeaders(eventId, file) {
  const formData = new FormData()
  formData.append('excel_file', file)
  const { data } = await axiosInstance.post(`/dept/events/${eventId}/excel/headers`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export function useDeptEventMapping(eventId) {
  return useQuery({
    queryKey: deptKeys.eventMapping(eventId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/dept/events/${eventId}/mapping`)
      return data
    },
    enabled: !!eventId,
  })
}

export function useSaveDeptEventMapping(eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post(`/dept/events/${eventId}/mapping`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: deptKeys.eventMapping(eventId) })
      addToast({ type: 'success', message: 'Field mapping saved.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to save mapping.' })
    },
  })
}

export function useGenerateDeptEventCertificates(eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (excelFile) => {
      const formData = new FormData()
      formData.append('excel_file', excelFile)
      const { data } = await axiosInstance.post(`/dept/events/${eventId}/certificates/generate`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: deptKeys.events() })
      qc.invalidateQueries({ queryKey: deptKeys.dashboard() })
      qc.invalidateQueries({ queryKey: deptKeys.certs() })
      addToast({ type: 'success', message: data?.message || 'Certificates generated.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to generate certificates.' })
    },
  })
}

export function useDeptAssetStatus() {
  return useQuery({
    queryKey: deptKeys.assets(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/dept/certificates/assets-status')
      return data
    },
  })
}

export function useDeptGenerateCertificates() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (formData) => {
      const { data } = await axiosInstance.post('/dept/certificates/generate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['dept', 'certificates'] })
      addToast({ type: 'success', message: data?.message || 'Certificates generated successfully.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to generate certificates.' })
    },
  })
}

export function useDeptCertificates() {
  return useQuery({
    queryKey: deptKeys.certs(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/dept/certificates', {
        params: { limit: 100 },
      })
      return data
    },
  })
}

export function useDeptStudents(filters = {}) {
  return useQuery({
    queryKey: deptKeys.students(filters),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/dept/students', {
        params: {
          ...(filters.batch ? { batch: filters.batch } : {}),
          ...(filters.sort_by ? { sort_by: filters.sort_by } : {}),
          ...(filters.order ? { order: filters.order } : {}),
        },
      })
      return data
    },
  })
}

// Position configuration APIs
export function useUploadCertificateTemplate() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (templateFile) => {
      const formData = new FormData()
      formData.append('template_file', templateFile)
      const { data } = await axiosInstance.post('/dept/certificates/template/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: deptKeys.assets() })
      addToast({ type: 'success', message: 'Certificate template uploaded successfully.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to upload template.' })
    },
  })
}

export function useConfigureFieldPositions() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (positions) => {
      const { data } = await axiosInstance.post('/dept/certificates/field-positions', positions)
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: deptKeys.assets() })
      addToast({ type: 'success', message: 'Field positions configured successfully.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to configure positions.' })
    },
  })
}

export function useGetFieldPositions() {
  return useQuery({
    queryKey: ['dept', 'field-positions'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/dept/certificates/field-positions')
      return data
    },
  })
}

export async function downloadAllDeptCertificates() {
  const response = await axiosInstance.get('/dept/certificates/download-all', {
    responseType: 'blob',
  })
  return response.data
}

export async function downloadDeptCertificatesZip(certNumbers) {
  const response = await axiosInstance.post(
    '/dept/certificates/download-zip',
    { cert_numbers: certNumbers },
    { responseType: 'blob' },
  )
  return response.data
}
