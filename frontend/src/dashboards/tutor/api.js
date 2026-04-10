import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'

export function useTutorProfile() {
  return useQuery({
    queryKey: ['tutor', 'me'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/tutor/me')
      return data
    },
  })
}

export function useTutorStudents() {
  return useQuery({
    queryKey: ['tutor', 'students'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/tutor/students')
      return data
    },
  })
}

export function useTutorStudentDetail(studentEmail, enabled = true) {
  return useQuery({
    queryKey: ['tutor', 'students', studentEmail],
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/tutor/students/${encodeURIComponent(studentEmail)}`)
      return data
    },
    enabled: !!studentEmail && enabled,
  })
}

export function useTutorCreditRules() {
  return useQuery({
    queryKey: ['tutor', 'credit-rules'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/tutor/credit-rules')
      return data
    },
  })
}

export function useTutorManualCertificate() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await axiosInstance.post('/tutor/certificates/manual', payload)
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['tutor', 'students'] })
      if (data?.student_email) {
        qc.invalidateQueries({ queryKey: ['tutor', 'students', data.student_email] })
      }
      addToast({ type: 'success', message: 'Manual certificate entry added and credits updated.' })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to add manual certificate entry.' })
    },
  })
}
