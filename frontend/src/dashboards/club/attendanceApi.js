import { useMutation } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'
import { useToastStore } from '../../store/uiStore'

/**
 * POST /clubs/:clubId/events/:eventId/generate-qr
 * Returns { payload, issued_at, expires_in }
 */
export function useGenerateAttendanceQR(clubId, eventId) {
  const addToast = useToastStore((s) => s.addToast)

  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosInstance.post(
        `/clubs/${clubId}/events/${eventId}/generate-qr`,
      )
      return data
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.detail || 'Failed to generate QR code.'
      addToast({ type: 'error', message: msg })
    },
  })
}
