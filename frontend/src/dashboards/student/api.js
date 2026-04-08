import { useQuery } from '@tanstack/react-query'
import axiosInstance from '../../utils/axiosInstance'

// ── Query keys ────────────────────────────────────────────────────────────────
export const creditKeys = {
  mine:           ()      => ['credits', 'me'],
  myHistory:      ()      => ['credits', 'me', 'history'],
  myCertificates: ()      => ['credits', 'me', 'certificates'],
}

// ── Credit weights (mirrors backend config) ───────────────────────────────────
export const CREDIT_WEIGHTS = {
  participant: 1,
  volunteer:   2,
  mentor:      3,
  judge:       3,
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
