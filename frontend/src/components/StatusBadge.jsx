/**
 * StatusBadge
 *
 * Renders a coloured pill badge for any status string used across the platform.
 *
 * Props:
 *   status   string   — the status value (case-insensitive)
 *   size     'sm'|'md' — controls text/padding size (default: 'md')
 */

const statusMap = {
  // Certificate statuses
  pending:    { label: 'Pending',    cls: 'bg-amber-50  text-amber-700  ring-amber-200' },
  generated:  { label: 'Generated',  cls: 'bg-blue-50   text-blue-700   ring-blue-200' },
  emailed:    { label: 'Emailed',    cls: 'bg-green-50  text-green-700  ring-green-200' },
  failed:     { label: 'Failed',     cls: 'bg-red-50    text-red-700    ring-red-200' },
  revoked:    { label: 'Revoked',    cls: 'bg-gray-100  text-gray-600   ring-gray-200' },

  // Event statuses
  draft:      { label: 'Draft',      cls: 'bg-gray-100  text-gray-600   ring-gray-200' },
  closed:     { label: 'Closed',     cls: 'bg-blue-50   text-blue-700   ring-blue-200' },

  // User / club statuses
  verified:   { label: 'Verified',   cls: 'bg-green-50  text-green-700  ring-green-200' },
  unverified: { label: 'Unverified', cls: 'bg-amber-50  text-amber-700  ring-amber-200' },
  suspended:  { label: 'Suspended',  cls: 'bg-red-50    text-red-700    ring-red-200' },
}

export default function StatusBadge({ status = '', size = 'md' }) {
  const key = status.toLowerCase().trim()
  if (key === 'active' || key === 'inactive') {
    return null
  }
  const config = statusMap[key] ?? {
    label: status,
    cls: 'bg-gray-100 text-gray-600 ring-gray-200',
  }

  const sizeClass =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : 'px-2.5 py-0.5 text-xs font-medium'

  return (
    <span
      className={`inline-flex items-center rounded-full ring-1 ring-inset leading-5 font-medium ${sizeClass} ${config.cls}`}
    >
      {config.label}
    </span>
  )
}
