import { useQuery, useMutation } from '@tanstack/react-query'
import axiosInstance from '../utils/axiosInstance'

// ── Query keys ────────────────────────────────────────────────────────────────
export const registerKeys = {
  session: (token) => ['register', token],
}

/**
 * GET /register/:token
 *
 * Public endpoint — no auth needed.
 * Validates the QR token and returns the registration form definition.
 *
 * Returns:
 * {
 *   event_name: string,
 *   club_name: string,
 *   event_date: string,
 *   custom_fields: Array<{ name: string, label: string, required?: boolean }>,
 *   expires_at: string,
 *   is_expired: boolean
 * }
 */
export function useRegisterSession(token) {
  return useQuery({
    queryKey: registerKeys.session(token),
    queryFn: async () => {
      const { data } = await axiosInstance.get(`/register/${token}`)
      return data
    },
    enabled: typeof token === 'string' && token.trim().length > 0,
    retry: false,
    staleTime: 30_000,   // re-check expiry every 30 s
    refetchInterval: 30_000,
  })
}

/**
 * POST /register/:token
 *
 * Public endpoint — no auth needed.
 * Submits the self-registration form.
 *
 * Payload: { email, registration_number, ...custom_fields }
 *
 * Returns:
 * { success: true, participant_name: string, event_name: string }
 */
export function useSubmitRegistration(token) {
  return useMutation({
    mutationFn: (payload) =>
      axiosInstance.post(`/register/${token}`, payload),
  })
}
