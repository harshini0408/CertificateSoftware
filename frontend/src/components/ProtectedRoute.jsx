import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

/**
 * Role-to-home-path mapping.
 * When an authenticated user lands on a route they're not allowed to access,
 * we redirect them to their own dashboard instead of /login.
 */
const roleHomePath = (role, store) => {
  switch (role) {
    case 'super_admin':
      return '/admin'
    case 'principal':
      return '/principal'
    case 'club_coordinator':
      return `/club/${store.club_id}`
    case 'dept_coordinator':
      return '/dept'
    case 'tutor':
      return '/tutor'
    case 'student':
      return '/student'
    case 'guest':
      return `/guest`
    default:
      return '/login'
  }
}

/**
 * ProtectedRoute
 *
 * Wraps a page component and enforces:
 *   1. Authentication — unauthenticated users → /login
 *   2. Role authorisation — wrong role → user's own dashboard
 *
 * Props:
 *   allowedRoles  string[]   Roles that may access this route.
 *   children      ReactNode  The page to render when access is granted.
 */
export default function ProtectedRoute({ allowedRoles = [], children }) {
  const store = useAuthStore()
  const { isAuthenticated, role } = store
  const location = useLocation()

  // 1. Not logged in at all.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // 2. Logged in but wrong role for this route.
  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    const from = encodeURIComponent(location.pathname + (location.search || ''))
    return <Navigate to={`/login?switch=1&from=${from}`} replace />
  }

  return children
}
