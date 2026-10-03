import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useMe } from '../dashboards/auth/api'


export default function AuthSessionSync() {
  const location = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const requiresPasswordChange = useAuthStore((s) => s.requires_password_change)

  // First-time users have not received session cookies yet. Their password-change
  // modal authenticates with the supplied credentials, so /auth/me would only
  // return 401 and erase that in-progress state.
  const shouldSync = location.pathname !== '/login' || (isAuthenticated && !requiresPasswordChange)

  // Sync persisted auth store with the authoritative cookie session on app load.
  useMe({ enabled: shouldSync })
  return null
}
