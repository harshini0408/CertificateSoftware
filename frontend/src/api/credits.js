import { useQuery } from '@tanstack/react-query'
import axiosInstance from '../utils/axiosInstance'

// ── Query keys ────────────────────────────────────────────────────────────────
export const creditKeys = {
  mine:           ()      => ['credits', 'me'],
  myHistory:      ()      => ['credits', 'me', 'history'],
  myCertificates: ()      => ['credits', 'me', 'certificates'],
  student:        (id)    => ['credits', 'student', id],
  studentDetail:  (regNo) => ['dept', 'students', regNo],
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
 * GET /dept/students/:registration_number
 *
 * Fetches a single student's full credit history for the dept coordinator.
 * Only fetched when the row is expanded (pass enabled: isExpanded).
 */
export function useDeptStudentDetail(regNo) {
  return useQuery({
    queryKey: creditKeys.studentDetail(regNo),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/dept/students/${regNo}`)
      return data
    },
    enabled: !!regNo,
  })
}
