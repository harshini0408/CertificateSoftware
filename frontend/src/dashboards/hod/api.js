import { useQuery } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'

export const hodKeys = {
  me: () => ['hod', 'me'],
  students: (filters) => ['hod', 'students', filters],
  certificates: (studentId) => ['hod', 'student-certificates', studentId],
}

export function useHodProfile() {
  return useQuery({
    queryKey: hodKeys.me(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/hod/me')
      return data
    },
  })
}

export function useHodStudents(filters = {}) {
  return useQuery({
    queryKey: hodKeys.students(filters),
    queryFn: async () => {
      const params = {}
      if (filters.batch) params.batch = filters.batch
      if (filters.section) params.section = filters.section
      if (filters.search) params.search = filters.search
      const { data } = await axiosInstance.get('/hod/students', { params })
      return data
    },
  })
}

export function useHodStudentCertificates(studentId) {
  return useQuery({
    queryKey: hodKeys.certificates(studentId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/hod/students/${studentId}/certificates`)
      return data
    },
    enabled: !!studentId,
  })
}
