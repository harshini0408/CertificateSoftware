import { useQuery } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'

export const principalKeys = {
  stats: () => ['principal', 'stats'],
  rankings: (limit) => ['principal', 'rankings', limit],
  clubs: () => ['principal', 'clubs'],
  clubEvents: (clubId) => ['principal', 'club-events', clubId],
  departments: () => ['principal', 'departments'],
  deptEvents: (departmentName) => ['principal', 'dept-events', departmentName],
  students: (filters) => ['principal', 'students', filters],
  certificates: (studentId) => ['principal', 'student-certificates', studentId],
  eventsOverview: (filters) => ['principal', 'events-overview', filters],
}

export function usePrincipalStats() {
  return useQuery({
    queryKey: principalKeys.stats(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/principal/stats')
      return data
    },
  })
}

export function usePrincipalRankings(limit = 5) {
  return useQuery({
    queryKey: principalKeys.rankings(limit),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/principal/rankings', { params: { limit } })
      return data
    },
  })
}

export function usePrincipalClubs() {
  return useQuery({
    queryKey: principalKeys.clubs(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/principal/clubs')
      return data
    },
  })
}

export function usePrincipalClubEvents(clubId) {
  return useQuery({
    queryKey: principalKeys.clubEvents(clubId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/principal/clubs/${clubId}/events`)
      return data
    },
    enabled: !!clubId,
  })
}

export function usePrincipalDepartments() {
  return useQuery({
    queryKey: principalKeys.departments(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/principal/departments')
      return data
    },
  })
}

export function usePrincipalDeptEvents(departmentName) {
  return useQuery({
    queryKey: principalKeys.deptEvents(departmentName),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/principal/departments/${encodeURIComponent(departmentName)}/events`)
      return data
    },
    enabled: !!departmentName,
  })
}

export function usePrincipalEventsOverview(filters = {}) {
  return useQuery({
    queryKey: principalKeys.eventsOverview(filters),
    queryFn: async () => {
      const params = {}
      if (filters.source_type) params.source_type = filters.source_type
      if (filters.search) params.search = filters.search
      const { data } = await axiosInstance.get('/principal/events-overview', { params })
      return data
    },
  })
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

