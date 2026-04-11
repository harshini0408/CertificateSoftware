import { useMe } from '../dashboards/auth/api'


export default function AuthSessionSync() {
  // Sync persisted auth store with the authoritative cookie session on app load.
  useMe()
  return null
}
