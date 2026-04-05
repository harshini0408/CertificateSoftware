import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../utils/axiosInstance'
import { useToastStore } from '../store/uiStore'

export const deptKeys = {
  assets: () => ['dept', 'assets-status'],
  certs: () => ['dept', 'certificates'],
  students: (filters) => ['dept', 'students', filters],
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
