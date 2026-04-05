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
