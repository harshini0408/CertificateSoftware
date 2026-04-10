import { NavLink, useParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'

// ── Icon helpers (inline SVGs, no external icon library needed) ───────────────
const icons = {
  dashboard: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  calendar: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  template: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  settings: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  clubs: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  users: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  certificate: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  creditCard: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  scan: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H3m2 0V4m0 4h.01M5 8h.01M5 20H3m2 0v-4m0 4h.01M19 8h2m-2 0V4m0 4h.01" />
    </svg>
  ),
  student: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  ),
}

// ── Nav item component ────────────────────────────────────────────────────────
function NavItem({ to, icon, label, end = false, sidebarOpen }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      className={({ isActive }) =>
        `flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors duration-150 ${
          sidebarOpen ? 'justify-start gap-3 px-3' : 'justify-center px-0'
        } ${
          isActive
            ? 'bg-navy text-white shadow-sm'
            : 'text-gray-600 hover:bg-navy/8 hover:text-navy'
        }`
      }
    >
      {icon}
      {sidebarOpen && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

// ── Role-specific nav configs ─────────────────────────────────────────────────
function useNavItems() {
  const { role, club_id } = useAuthStore()
  const params = useParams()
  const effectiveClubId = club_id ?? params.club_id

  switch (role) {
    case 'super_admin':
      return [
        { to: '/admin',                          icon: icons.dashboard,   label: 'Overview',      end: true },
        { to: '/admin?tab=clubs',                icon: icons.clubs,       label: 'Clubs' },
        { to: '/admin?tab=users',                icon: icons.users,       label: 'Users' },
        { to: '/admin?tab=certificate-mapping',  icon: icons.template,    label: 'Certificate Mapping' },
        { to: '/admin?tab=certificates',         icon: icons.certificate, label: 'Certificates' },
        { to: '/admin?tab=credit-rules',         icon: icons.creditCard,  label: 'Credit Rules' },
      ]

    case 'club_coordinator':
      return [
        { to: `/club/${effectiveClubId}`,                      icon: icons.dashboard, label: 'Dashboard', end: true },
        { to: `/club/${effectiveClubId}?tab=settings`,         icon: icons.settings,  label: 'Settings' },
      ]

    case 'guest':
      return [
        { to: '/guest',         icon: icons.dashboard,   label: 'Home',    end: true },
        { to: '/guest/history', icon: icons.certificate, label: 'History', end: false },
      ]

    case 'dept_coordinator':
      return [
        { to: '/dept',                   icon: icons.dashboard, label: 'Dashboard', end: true },
        { to: '/dept?tab=settings',      icon: icons.settings,  label: 'Settings' },
      ]

    case 'student':
      return [
        { to: '/student', icon: icons.certificate, label: 'My Certificates', end: true },
      ]

    case 'tutor':
      return [
        { to: '/tutor', icon: icons.student, label: 'Dashboard', end: true },
      ]

    default:
      return []
  }

}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen)
  const navItems = useNavItems()

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-14 left-0 z-20 flex h-[calc(100dvh-3.5rem)] flex-col
          border-gray-200 bg-white shadow-card
          transition-all duration-300 ease-in-out
          lg:sticky lg:shadow-none min-h-0
          ${sidebarOpen ? 'w-60 translate-x-0 border-r' : 'w-0 -translate-x-full border-none px-0'}
          lg:translate-x-0 lg:border-r
          ${sidebarOpen ? 'lg:w-60' : 'lg:w-14'}
        `}
      >
        {/* Nav links */}
        <nav className={`flex-1 overflow-y-auto py-4 space-y-1 scrollbar-hide ${sidebarOpen ? 'px-3' : 'px-2'}`}>
          {navItems.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              end={item.end}
              sidebarOpen={sidebarOpen}
            />
          ))}
        </nav>

        {/* Footer brand */}
        {sidebarOpen && (
          <div className="border-t border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-400 leading-tight">
              PSG iTech
              <br />
              <span className="font-medium text-navy/60">Certificate Platform</span>
            </p>
          </div>
        )}
      </aside>
    </>
  )
}
