/**
 * LoadingSpinner
 *
 * Props:
 *   size     'sm' | 'md' | 'lg'   — controls the spinner diameter
 *   fullPage boolean               — centers in the full viewport
 *   label    string                — optional accessible label / message
 */
export default function LoadingSpinner({
  size = 'md',
  fullPage = false,
  label = 'Loading…',
}) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-2',
    lg: 'h-12 w-12 border-[3px]',
  }

  const spinner = (
    <div
      role="status"
      aria-label={label}
      className="flex flex-col items-center gap-3"
    >
      <span
        className={`
          block rounded-full
          border-navy/20 border-t-navy
          animate-spin
          ${sizeClasses[size] ?? sizeClasses.md}
        `}
      />
      {label && (
        <span className="text-sm text-gray-500">{label}</span>
      )}
    </div>
  )

  if (fullPage) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        {spinner}
      </div>
    )
  }

  return spinner
}
