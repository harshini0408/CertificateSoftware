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
