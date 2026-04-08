import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * authStore
 *
 * Persisted to sessionStorage so the user stays logged in on page refresh
 * within the same browser session, but is automatically cleared when the
 * tab is closed.
 *
 * Shape:
 *   user          – display name returned by /auth/login
 *   role          – 'super_admin' | 'club_coordinator' | 'dept_coordinator'
 *                   | 'student' | 'guest'
 *   club_id       – present for club_coordinator (unused for guest)
 *   event_id      – unused for guest flow (deprecated)
 *   department    – present for dept_coordinator role
 *   isAuthenticated – derived boolean
 */
const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      role: null,
      club_id: null,
      event_id: null,
      department: null,
      requires_profile_setup: false,
      isAuthenticated: false,

      /**
       * Populate the store after a successful /auth/login response.
       * @param {{ user: string, role: string, club_id?: string,
       *            event_id?: string, department?: string }} payload
       */
      setAuth: (payload) =>
        set({
          user: payload.name ?? payload.user,
          role: payload.role,
          club_id: payload.club_id ?? null,
          event_id: payload.event_id ?? null,
          department: payload.department ?? null,
          requires_profile_setup: payload.requires_profile_setup ?? false,
          isAuthenticated: true,
        }),

      /** Called on logout or when the refresh token is exhausted. */
      clearAuth: () =>
        set({
          user: null,
          role: null,
          club_id: null,
          event_id: null,
          department: null,
          requires_profile_setup: false,
          isAuthenticated: false,
        }),

      setRequiresProfileSetup: (required) =>
        set({ requires_profile_setup: !!required }),
    }),
    {
      name: 'psg-auth',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)

export { useAuthStore }
