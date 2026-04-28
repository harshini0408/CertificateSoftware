import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'

// ── Query keys ────────────────────────────────────────────────────────────────
export const userKeys = {
  all:    ()           => ['users'],
  list:   (filters)    => ['users', 'list', filters],
  detail: (userId)     => ['users', userId],
  tutorMappingSummary: () => ['users', 'tutor-mapping-summary'],
}

// ── useUsers ──────────────────────────────────────────────────────────────────
/**
 * GET /admin/users with query params
 * @param {{ role?: string, club_id?: string, department?: string,
 *           is_active?: boolean, search?: string }} filters
 */
export function useUsers(filters = {}) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: async () => {
      const params = {}
      if (filters.role) params.role = filters.role
      if (filters.club_id) params.club_id = filters.club_id
      if (filters.department) params.department = filters.department
      if (filters.is_active !== undefined && filters.is_active !== null) {
        params.is_active = filters.is_active
      }
      if (filters.search) params.search = filters.search
      const { data } = await axiosInstance.get('/admin/users', { params })
      return data
    },
  })
}

// ── useUser ───────────────────────────────────────────────────────────────────
/**
 * GET /admin/users/{user_id}
 */
export function useUser(userId) {
  return useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/admin/users/${userId}`)
      return data
    },
    enabled: !!userId,
  })
}

export function useStudentCertificateSearch(query) {
  return useQuery({
    queryKey: ['admin', 'student-certificates', query],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/student-certificates/search', {
        params: { q: query },
      })
      return data
    },
    enabled: !!query,
  })
}

export function useTutorMappingSummary() {
  return useQuery({
    queryKey: userKeys.tutorMappingSummary(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/admin/tutors/mapping-summary')
      return data
    },
  })
}

// ── useCreateUser ─────────────────────────────────────────────────────────────
/**
 * POST /admin/users
 */
export function useCreateUser() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (payload) => axiosInstance.post('/admin/users', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      addToast({ type: 'success', message: 'User created successfully.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to create user.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// ── useUpdateUser ─────────────────────────────────────────────────────────────
/**
 * PATCH /admin/users/{user_id}
 */
export function useUpdateUser() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ userId, ...payload }) =>
      axiosInstance.patch(`/admin/users/${userId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      addToast({ type: 'success', message: 'User updated.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to update user.'
      addToast({ type: 'error', message: msg })
    },
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (userId) => axiosInstance.delete(`/admin/users/${userId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      addToast({ type: 'success', message: 'User deleted successfully.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to delete user.'
      addToast({ type: 'error', message: msg })
    },
  })
}

export function useBulkDeleteUsers() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (userIds) => {
      const ids = Array.isArray(userIds) ? userIds : []
      const results = await Promise.allSettled(
        ids.map((id) => axiosInstance.delete(`/admin/users/${id}`)),
      )

      const success = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - success
      return { success, failed }
    },
    onSuccess: ({ success, failed }) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      if (failed === 0) {
        addToast({ type: 'success', message: `${success} user${success !== 1 ? 's' : ''} deleted successfully.` })
      } else {
        addToast({ type: 'error', message: `${success} deleted, ${failed} failed. Please retry failed items.` })
      }
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to delete selected users.'
      addToast({ type: 'error', message: msg })
    },
  })
}

export function useAssignTutorStudents() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ tutorId, students }) =>
      axiosInstance.post(`/admin/tutors/${tutorId}/students`, { students }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      addToast({ type: 'success', message: 'Tutor students assigned.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to assign tutor students.'
      addToast({ type: 'error', message: msg })
    },
  })
}

export function useBulkImportTutorStudents() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ tutorId, file }) => {
      const formData = new FormData()
      formData.append('file', file)
      return axiosInstance.post(`/admin/tutors/${tutorId}/students/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      addToast({ type: 'success', message: 'Tutor student import completed.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to import tutor students.'
      addToast({ type: 'error', message: msg })
    },
  })
}

export function useBulkImportTutors() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: (file) => {
      const fd = new FormData()
      fd.append('file', file)
      return axiosInstance.post('/admin/users/bulk-import-tutors', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      addToast({
        type: 'success',
        message: `${data.created} tutor${data.created !== 1 ? 's' : ''} imported, ${data.skipped} skipped.`,
      })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to import tutors.'
      addToast({ type: 'error', message: msg })
    },
  })
}

export function useDownloadTutorImportSample() {
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.get('/admin/users/bulk-import-tutors/sample', {
        responseType: 'blob',
      })
      const blob = new Blob([
        response.data,
      ], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'tutor_bulk_import_sample.xlsx'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to download sample file.'
      addToast({ type: 'error', message: msg })
    },
  })
}

export function useReassignTutorStudents() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: ({ fromTutorId, toTutorId }) =>
      axiosInstance.post(`/admin/tutors/${fromTutorId}/reassign`, { new_tutor_id: toTutorId }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      addToast({
        type: 'success',
        message: `${data.moved} student${data.moved !== 1 ? 's' : ''} moved to ${data.to_tutor}.`,
      })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to reassign tutor students.'
      addToast({ type: 'error', message: msg })
    },
  })
}

