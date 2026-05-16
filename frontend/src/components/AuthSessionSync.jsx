import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useMe } from '../dashboards/auth/api'


export default function AuthSessionSync() {
  const location = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const shouldSync = location.pathname !== '/login' || isAuthenticated

  // Sync persisted auth store with the authoritative cookie session on app load.
  useMe({ enabled: shouldSync })
  return null
}
