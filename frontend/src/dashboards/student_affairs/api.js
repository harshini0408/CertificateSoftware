import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'

// ── Query keys ────────────────────────────────────────────────────────────────
export const affairsKeys = {
  stats:          () => ['affairs', 'stats'],
  clubEvents:     (filters) => ['affairs', 'club-events', filters],
  clubEventDetail:(id) => ['affairs', 'club-events', id],
  deptEvents:     (filters) => ['affairs', 'dept-events', filters],
  deptEventDetail:(id) => ['affairs', 'dept-events', id],
  departments:    () => ['affairs', 'departments'],
  rankings:       (limit) => ['affairs', 'rankings', limit],
  upcoming:       (filters) => ['affairs', 'upcoming', filters],
}


// ── Stats ─────────────────────────────────────────────────────────────────────
export function useAffairsStats() {
  return useQuery({
    queryKey: affairsKeys.stats(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/affairs/stats')
      return data
    },
  })
}


// ── Club Events (with filters) ───────────────────────────────────────────────
export function useAffairsClubEvents(filters = {}) {
  return useQuery({
    queryKey: affairsKeys.clubEvents(filters),
    queryFn: async () => {
      const params = {}
      if (filters.start_date) params.start_date = filters.start_date
      if (filters.end_date) params.end_date = filters.end_date
      if (filters.club_id) params.club_id = filters.club_id
      if (filters.category) params.category = filters.category
      if (filters.report_status) params.report_status = filters.report_status
      const { data } = await axiosInstance.get('/affairs/club-events', { params })
      return data
    },
  })
}


// ── Club Event Detail ────────────────────────────────────────────────────────
export function useAffairsClubEventDetail(eventId) {
  return useQuery({
    queryKey: affairsKeys.clubEventDetail(eventId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/affairs/club-events/${eventId}`)
      return data
    },
    enabled: !!eventId,
  })
}


// ── Dept Events ──────────────────────────────────────────────────────────────
export function useAffairsDeptEvents(filters = {}) {
  return useQuery({
    queryKey: affairsKeys.deptEvents(filters),
    queryFn: async () => {
      const params = {}
      if (filters.department) params.department = filters.department
      if (filters.semester) params.semester = filters.semester
      if (filters.start_date) params.start_date = filters.start_date
      if (filters.end_date) params.end_date = filters.end_date
      const { data } = await axiosInstance.get('/affairs/dept-events', { params })
      return data
    },
  })
}


// ── Dept Event Detail ────────────────────────────────────────────────────────
export function useAffairsDeptEventDetail(eventId) {
  return useQuery({
    queryKey: affairsKeys.deptEventDetail(eventId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/affairs/dept-events/${eventId}`)
      return data
    },
    enabled: !!eventId,
  })
}


// ── Departments List ─────────────────────────────────────────────────────────
export function useAffairsDepartments() {
  return useQuery({
    queryKey: affairsKeys.departments(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/affairs/departments')
      return data
    },
  })
}


// ── Rankings ──────────────────────────────────────────────────────────────────
export function useAffairsRankings(limit = 3) {
  return useQuery({
    queryKey: affairsKeys.rankings(limit),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/affairs/rankings', { params: { limit } })
      return data
    },
  })
}


// ── Upcoming Events ──────────────────────────────────────────────────────────
export function useAffairsUpcomingEvents(filters = {}) {
  return useQuery({
    queryKey: affairsKeys.upcoming(filters),
    queryFn: async () => {
      const params = {}
      if (filters.club_id) params.club_id = filters.club_id
      if (filters.category) params.category = filters.category
      const { data } = await axiosInstance.get('/affairs/upcoming-events', { params })
      return data
    },
  })
}


// ── Report Review (Accept/Reject) ────────────────────────────────────────────
export function useReviewReport(eventId) {
  const qc = useQueryClient()
  const addToast = useToastStore.getState().addToast

  return useMutation({
    mutationFn: async ({ action, rejection_reason }) => {
      const { data } = await axiosInstance.post(
        `/affairs/club-events/${eventId}/report/review`,
        { action, rejection_reason },
      )
      return data
    },
    onSuccess: (data) => {
      addToast({ type: 'success', message: `Report ${data.report_status}` })
      qc.invalidateQueries({ queryKey: ['affairs'] })
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to review report' })
    },
  })
}
