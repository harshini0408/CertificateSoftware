import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import LoadingSpinner from './LoadingSpinner'

/**
 * ConfirmModal
 *
 * A reusable confirmation dialog rendered in a portal.
 *
 * Props:
 *   isOpen       boolean    — controls visibility
 *   onClose      () => void — called on cancel / backdrop click / Escape
 *   onConfirm    () => void — called when the user clicks the confirm button
 *   title        string     — modal heading
 *   message      string | ReactNode — body text
 *   confirmLabel string     — confirm button label (default: "Confirm")
 *   cancelLabel  string     — cancel button label (default: "Cancel")
 *   variant      'danger'|'primary' — confirm button colour (default: 'danger')
 *   isLoading    boolean    — shows spinner on confirm button, disables both buttons
 */
export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
}) {
  const overlayRef = useRef(null)
  const confirmBtnRef = useRef(null)

  // Focus the confirm button when the modal opens (keyboard accessibility)
  useEffect(() => {
    if (isOpen) {
      confirmBtnRef.current?.focus()
    }
  }, [isOpen])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  // Prevent body scroll while modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const confirmBtnClass =
    variant === 'danger' ? 'btn-danger' : 'btn-primary'

  return createPortal(
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === overlayRef.current) onClose()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-md rounded-xl bg-white shadow-modal"
        style={{ animation: 'fadeIn 0.15s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
          <h2
            id="confirm-modal-title"
            className="text-base font-semibold text-foreground"
          >
            {title}
          </h2>
          <button
            aria-label="Close modal"
            onClick={onClose}
            disabled={isLoading}
            className="ml-4 rounded p-1 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {message && (
            <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <button
            id="confirm-modal-cancel"
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </button>
          <button
            id="confirm-modal-confirm"
            ref={confirmBtnRef}
            type="button"
            className={`${confirmBtnClass} min-w-[90px]`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <LoadingSpinner size="sm" label="" />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
