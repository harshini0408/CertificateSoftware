import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useToastStore } from '../store/uiStore'

// ── Type → visual config ──────────────────────────────────────────────────────
const toastConfig = {
  success: {
    bar: 'bg-green-500',
    icon: (
      <svg className="h-5 w-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  error: {
    bar: 'bg-red-500',
    icon: (
      <svg className="h-5 w-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  warning: {
    bar: 'bg-amber-400',
    icon: (
      <svg className="h-5 w-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  info: {
    bar: 'bg-navy',
    icon: (
      <svg className="h-5 w-5 text-navy shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
}

// ── Single toast item ─────────────────────────────────────────────────────────
function Toast({ id, type = 'info', message, duration = 4000 }) {
  const removeToast = useToastStore((s) => s.removeToast)
  const cfg = toastConfig[type] ?? toastConfig.info

  // Accessibility: announce to screen readers
  useEffect(() => {
    if (duration <= 0) return
    const timer = setTimeout(() => removeToast(id), duration)
    return () => clearTimeout(timer)
  }, [id, duration, removeToast])

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="
        relative flex w-full max-w-sm items-start gap-3
        overflow-hidden rounded-lg bg-white shadow-modal
        border border-gray-100
        animate-[slideIn_0.2s_ease-out]
      "
      style={{
        animationName: 'slideIn',
      }}
    >
      {/* Coloured left bar */}
      <div className={`absolute left-0 top-0 h-full w-1 ${cfg.bar}`} />

      {/* Content */}
      <div className="flex flex-1 items-start gap-3 px-4 py-3 pl-5">
        {cfg.icon}
        <p className="flex-1 text-sm text-foreground leading-snug">
          {typeof message === 'string'
            ? message
            : Array.isArray(message)
              ? message.map((m) => m?.msg ?? JSON.stringify(m)).join(' | ')
              : JSON.stringify(message)}
        </p>
      </div>

      {/* Close button */}
      <button
        aria-label="Dismiss notification"
        onClick={() => removeToast(id)}
        className="mr-2 mt-2.5 rounded p-1 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Toast container (portal) ─────────────────────────────────────────────────
export default function ToastProvider() {
  const toasts = useToastStore((s) => s.toasts)

  return createPortal(
    <div
      id="toast-container"
      aria-label="Notifications"
      className="
        fixed bottom-5 right-5 z-50
        flex flex-col gap-2
        w-full max-w-sm
        pointer-events-none
      "
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast {...t} />
        </div>
      ))}
    </div>,
    document.body,
  )
}
