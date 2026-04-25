import { useQuery } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'

export const principalKeys = {
  students: (filters) => ['principal', 'students', filters],
  certificates: (studentId) => ['principal', 'student-certificates', studentId],
}

export function usePrincipalStudents(filters = {}) {
  return useQuery({
    queryKey: principalKeys.students(filters),
    queryFn: async () => {
      const params = {}
      if (filters.department) params.department = filters.department
      if (filters.batch) params.batch = filters.batch
      if (filters.className) params.class = filters.className
      if (filters.search) params.search = filters.search
      const { data } = await axiosInstance.get('/principal/students', { params })
      return data
    },
  })
}

export function usePrincipalStudentCertificates(studentId) {
  return useQuery({
    queryKey: principalKeys.certificates(studentId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/principal/students/${studentId}/certificates`)
      return data
    },
    enabled: !!studentId,
  })
}
