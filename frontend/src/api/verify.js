import { useQuery } from '@tanstack/react-query'
import axiosInstance from '../utils/axiosInstance'

// ── Query keys ────────────────────────────────────────────────────────────────
export const verifyKeys = {
  cert: (certNumber) => ['verify', certNumber],
}

/**
 * GET /certificates/verify/:cert_number
 *
 * Public endpoint — no auth needed.
 *
 * Returns one of:
 * {
 *   valid: true,
 *   cert_number: string,
 *   participant_name: string,
 *   participant_email: string,
 *   registration_number: string,
 *   event_name: string,
 *   club_name: string,
 *   event_date: string,
 *   cert_type: string,
 *   issued_at: string,
 *   pdf_url?: string,
 *   status: 'generated' | 'emailed' | 'revoked'
 * }
 * OR
 * { valid: false, message: string }
 */
export function useVerifyCert(certNumber) {
  return useQuery({
    queryKey: verifyKeys.cert(certNumber),
    queryFn: async () => {
      const { data } = await axiosInstance.get(
        `/certificates/verify/${encodeURIComponent(certNumber)}`,
      )
      return data
    },
    enabled: typeof certNumber === 'string' && certNumber.trim().length > 0,
    retry: false,              // don't retry on 404
    staleTime: 5 * 60 * 1000, // 5 min — verification result is stable
  })
}
