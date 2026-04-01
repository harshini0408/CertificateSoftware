import { create } from 'zustand'

// ─── UI Store ────────────────────────────────────────────────────────────────
// Manages transient UI state: sidebar visibility, active modal, and toasts.
// Not persisted — resets to defaults on page load.

const useUiStore = create((set) => ({
  // ── Sidebar ────────────────────────────────────────────────────────────────
  sidebarOpen: true,

  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  // ── Modal ──────────────────────────────────────────────────────────────────
  // activeModal is a string key (e.g. 'new-event', 'confirm-revoke') or null.
  // modalData carries any props the modal needs (ids, messages, callbacks).
  activeModal: null,
  modalData: null,

  setModal: (modalKey, data = null) =>
    set({ activeModal: modalKey, modalData: data }),

  closeModal: () => set({ activeModal: null, modalData: null }),
}))

// ─── Toast Store ─────────────────────────────────────────────────────────────
// Separate slice so toasts can be imported independently by axiosInstance.js
// without pulling in the full UI store (avoids circular-import issues in Vite).

let _toastId = 0

const useToastStore = create((set) => ({
  toasts: [],

  /**
   * Add a toast notification.
   * @param {{ type: 'success'|'error'|'info'|'warning', message: string, duration?: number }} toast
   */
  addToast: ({ type = 'info', message, duration = 4000 }) => {
    const id = ++_toastId
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }))

    // Auto-remove after duration.
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }))
      }, duration)
    }

    return id
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearToasts: () => set({ toasts: [] }),
}))

export { useUiStore, useToastStore }
