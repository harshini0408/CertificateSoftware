import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'

// ── Query keys ────────────────────────────────────────────────────────────────
export const creditKeys = {
  mine:           ()      => ['credits', 'me'],
  myHistory:      ()      => ['credits', 'me', 'history'],
  myCertificates: ()      => ['credits', 'me', 'certificates'],
  rules:          ()      => ['credits', 'rules'],
  manualSubmissions: ()   => ['credits', 'manual-submissions'],
}

export const clubMembershipKeys = {
  myMemberships: () => ['clubs', 'me', 'memberships'],
  availableClubs: () => ['clubs', 'available'],
}

// ── Credit weights (mirrors backend config) ───────────────────────────────────
export const CREDIT_WEIGHTS = {
  participant: 1,
  volunteer:   2,
  mentor:      3,
  judge:       3,
  technical_talk: 2,
  workshop: 3,
  coordinator: 4,
  winner_3rd:  4,
  winner_2nd:  5,
  winner_1st:  6,
  appreciation: 1,
}

/**
 * GET /students/me/credits
 */
export function useMyCredits() {
  return useQuery({
    queryKey: creditKeys.mine(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/students/me/credits')
      return data
    },
  })
}

/**
 * GET /students/me/credits/history
 */
export function useMyCreditsHistory() {
  return useQuery({
    queryKey: creditKeys.myHistory(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/students/me/credits/history')
      return data
    },
  })
}

/**
 * GET /students/me/certificates
 */
export function useMyCertificates() {
  return useQuery({
    queryKey: creditKeys.myCertificates(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/students/me/certificates')
      return data
    },
  })
}

/**
 * GET /students/me
 */
export function useMyProfile() {
  return useQuery({
    queryKey: ['student', 'me', 'profile'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/students/me')
      return data
    },
  })
}

export function useStudentCreditRules() {
  return useQuery({
    queryKey: creditKeys.rules(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/students/me/credit-rules')
      return data
    },
  })
}

export function useMyManualCreditSubmissions() {
  return useQuery({
    queryKey: creditKeys.manualSubmissions(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/students/me/manual-credit-submissions')
      return data
    },
  })
}

export function useCreateManualCreditSubmission() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async ({ cert_type, event_date, certificate_image }) => {
      const formData = new FormData()
      formData.append('cert_type', cert_type)
      formData.append('event_date', event_date)
      formData.append('certificate_image', certificate_image)

      const { data } = await axiosInstance.post('/students/me/manual-credit-submissions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: creditKeys.manualSubmissions() })
      addToast({ type: 'success', message: 'Submitted for tutor verification.' })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to submit certificate.',
      })
    },
  })
}

/**
 * GET /clubs — list available clubs (for student to apply to)
 */
export function useAvailableClubs() {
  return useQuery({
    queryKey: clubMembershipKeys.availableClubs(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/clubs')
      return data
    },
  })
}

/**
 * GET /students/me/clubs — list my club memberships
 */
export function useMyClubMemberships() {
  return useQuery({
    queryKey: clubMembershipKeys.myMemberships(),
    queryFn: async () => {
      const { data } = await axiosInstance.get('/students/me/clubs')
      return data
    },
  })
}

/**
 * POST /students/me/clubs/apply — apply to a club
 */
export function useApplyForClub() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (club_id) => {
      const { data } = await axiosInstance.post('/students/me/clubs/apply', { club_id })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clubMembershipKeys.myMemberships() })
      addToast({ type: 'success', message: 'Application submitted! Awaiting coordinator approval.' })
    },
    onError: (err) => {
      addToast({
        type: 'error',
        message: err?.response?.data?.detail || 'Failed to apply for club.',
      })
    },
  })
}

/**
 * GET /student/upcoming-events — published club events for this week
 */
export function useStudentUpcomingEvents() {
  return useQuery({
    queryKey: ['student', 'upcoming-events'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/student/upcoming-events')
      return data
    },
  })
}

/**
 * POST /student/events/:eventId/register
 */
export function useRegisterForEvent() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async ({ eventId, type = 'participant' }) => {
      const { data } = await axiosInstance.post(`/student/events/${eventId}/register?type=${type}`)
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['student', 'upcoming-events'] })
      addToast({ type: 'success', message: data?.message || 'Registered for event successfully!' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to register for event.'
      addToast({ type: 'error', message: msg })
    },
  })
}

/**
 * POST /student/events/:eventId/cancel-registration
 */
export function useCancelEventRegistration() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async (eventId) => {
      const { data } = await axiosInstance.post(`/student/events/${eventId}/cancel-registration`)
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['student', 'upcoming-events'] })
      addToast({ type: 'success', message: data?.message || 'Event registration cancelled.' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to cancel registration.'
      addToast({ type: 'error', message: msg })
    },
  })
}

/**
 * POST /student/events/:eventId/validate-qr
 * Validates a QR scan within 20 seconds.
 * Returns { valid, event_id, token } — token used for the unique attendance URL.
 */
export function useValidateAttendanceQR() {
  return useMutation({
    mutationFn: async ({ eventId, qr_payload }) => {
      const { data } = await axiosInstance.post(
        `/student/events/${eventId}/validate-qr`,
        { qr_payload },
      )
      return data // { valid, event_id, token }
    },
    // Error handling done in the component for richer inline UX
  })
}

/**
 * GET /student/events/:eventId/attendance/:token
 * Fetches event + session info after a successful QR scan.
 * No time limit — used on the unique attendance page.
 */
export function useAttendanceSession(eventId, token) {
  return useQuery({
    queryKey: ['student', 'attendance-session', eventId, token],
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/student/events/${eventId}/attendance/${token}`,
      )
      return data // { event_name, club_name, event_date, venue, student_name, student_email }
    },
    enabled: !!eventId && !!token,
    retry: false,
  })
}

/**
 * POST /student/events/:eventId/attendance/:token/submit
 * Final attendance + feedback submission.  No time limit.
 */
export function useSubmitAttendance() {
  const qc = useQueryClient()
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async ({ eventId, token, feedback }) => {
      const { data } = await axiosInstance.post(
        `/student/events/${eventId}/attendance/${token}/submit`,
        { feedback: feedback || null },
      )
      return data // { success, message, event_name, marked_at }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['student', 'upcoming-events'] })
      addToast({ type: 'success', message: data?.message || 'Attendance marked!' })
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to submit attendance.'
      addToast({ type: 'error', message: msg })
    },
  })
}

// Legacy alias kept for any internal usage during refactor — can be removed after testing
export { useSubmitAttendance as useMarkAttendance }
