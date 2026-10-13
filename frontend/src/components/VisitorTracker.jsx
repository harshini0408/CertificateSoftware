import { useEffect } from 'react'
import axiosInstance from '../utils/axiosInstance'

const SESSION_KEY = 'site_visit_tracked'
const LAST_VISIT_KEY = 'last_site_visit_time'
const SESSION_GAP_MS = 30 * 60 * 1000 // 30 minutes inactivity threshold for returning visitors

/**
 * Global Visitor Tracker
 * Tracks unique site visitors across all pages (login, dashboards, verification, authors)
 * without inflating counts on internal navigation or page refreshes.
 */
export default function VisitorTracker() {
  useEffect(() => {
    const trackVisit = async () => {
      try {
        const hasSessionTracked = sessionStorage.getItem(SESSION_KEY)
        const lastVisitTime = localStorage.getItem(LAST_VISIT_KEY)
        const now = Date.now()

        // Count as a new visit if:
        // 1. Not yet tracked in this browser session, OR
        // 2. More than 30 minutes have elapsed since the previous visit
        const isNewVisit =
          !hasSessionTracked ||
          !lastVisitTime ||
          now - Number(lastVisitTime) > SESSION_GAP_MS

        if (isNewVisit) {
          sessionStorage.setItem(SESSION_KEY, '1')
          localStorage.setItem(LAST_VISIT_KEY, String(now))
          await axiosInstance.post('/api/visitor-count')
        }
      } catch {
        // Non-blocking fail-safe
      }
    }

    trackVisit()
  }, [])

  return null
}
