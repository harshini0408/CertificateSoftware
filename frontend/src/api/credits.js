import { useQuery } from '@tanstack/react-query'
import axiosInstance from '../utils/axiosInstance'

// ── Query keys ────────────────────────────────────────────────────────────────
export const creditKeys = {
  mine:        ()           => ['credits', 'me'],
  myHistory:   ()           => ['credits', 'me', 'history'],
  student:     (id)         => ['credits', 'student', id],
}

// ── Credit weights (mirrors backend config) ───────────────────────────────────
// Kept here so the frontend can display them without an extra API call.
export const CREDIT_WEIGHTS = {
  participant: 1,
  volunteer:   2,
  mentor:      3,
  judge:       3,
  coordinator: 4,
  winner_3rd:  4,
  winner_2nd:  5,
  winner_1st:  6,
}

/**
 * GET /students/me/credits
 *
 * Returns:
 * {
 *   total_credits: number,
 *   breakdown: Array<{
 *     cert_type: string,
 *     count: number,
 *     credits: number
 *   }>
 * }
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
 *
 * Returns paginated list of credit events:
 * Array<{
 *   _id: string,
 *   cert_type: string,
 *   credits: number,
 *   event_name: string,
 *   club_name: string,
 *   earned_at: string
 * }>
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
 *
 * Returns the student's own certificate records.
 * Array<{
 *   _id: string,
 *   cert_number: string,
 *   cert_type: string,
 *   event_name: string,
 *   club_name: string,
 *   issued_at: string,
 *   status: string,
 *   pdf_url?: string
 * }>
 */
export function useMyCertificates() {
  return useQuery({
    queryKey: ['student', 'me', 'certificates'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/students/me/certificates')
      return data
    },
  })
}

/**
 * GET /students/me
 * Student's own profile.
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

// ── Coordinator / admin use ───────────────────────────────────────────────────

/**
 * GET /students/:student_id/credits
 * Dept coordinator or admin view of a student's credits.
 */
export function useStudentCredits(studentId) {
  return useQuery({
    queryKey: creditKeys.student(studentId),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/students/${studentId}/credits`)
      return data
    },
    enabled: !!studentId,
  })
}

/**
 * GET /coordinator/stats
 * Summary stats scoped to the coordinator's clubs.
 */
export function useCoordinatorStats() {
  return useQuery({
    queryKey: ['coordinator', 'stats'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/coordinator/stats')
      return data
    },
  })
}

/**
 * GET /coordinator/events
 * All events across clubs in coordinator scope.
 */
export function useCoordinatorEvents() {
  return useQuery({
    queryKey: ['coordinator', 'events'],
    queryFn: async () => {
      const { data } = await axiosInstance.get('/coordinator/events')
      return data
    },
  })
}
