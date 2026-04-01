/**
 * StatCard
 *
 * Dashboard metric card: icon + label + large number + optional trend indicator.
 *
 * Props:
 *   label      string          — metric name (e.g. "Total Events")
 *   value      string | number — the key number to display
 *   icon       ReactNode       — SVG icon element
 *   trend      number          — optional % change (positive = green, negative = red)
 *   trendLabel string          — context text (e.g. "vs last month")
 *   accent     'navy'|'gold'|'green'|'red'|'blue'  — icon background accent
 *   isLoading  boolean         — shows a skeleton shimmer
 */

const accentMap = {
  navy:  { bg: 'bg-navy/10',       icon: 'text-navy' },
  gold:  { bg: 'bg-gold/10',        icon: 'text-gold' },
  green: { bg: 'bg-green-100',     icon: 'text-green-600' },
  red:   { bg: 'bg-red-100',       icon: 'text-red-600' },
  blue:  { bg: 'bg-blue-100',      icon: 'text-blue-600' },
  teal:  { bg: 'bg-teal-100',      icon: 'text-teal-600' },
}

function Skeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <div className="h-3 w-24 rounded bg-gray-200" />
          <div className="h-7 w-16 rounded bg-gray-200" />
          <div className="h-3 w-32 rounded bg-gray-200" />
        </div>
        <div className="h-11 w-11 rounded-lg bg-gray-200 shrink-0" />
      </div>
    </div>
  )
}

export default function StatCard({
  label = 'Metric',
  value = 0,
  icon,
  trend,
  trendLabel,
  accent = 'navy',
  isLoading = false,
}) {
  if (isLoading) return <Skeleton />

  const { bg, icon: iconColor } = accentMap[accent] ?? accentMap.navy

  const trendPositive = trend > 0
  const trendNeutral  = trend === 0 || trend == null

  return (
    <div className="card p-5 flex items-start justify-between gap-4">
      {/* Text side */}
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
          {label}
        </p>
        <p className="mt-1 text-3xl font-bold text-foreground tabular-nums">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>

        {/* Trend */}
        {!trendNeutral && (
          <div className="mt-1.5 flex items-center gap-1">
            <span
              className={`text-xs font-semibold ${
                trendPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trendPositive ? '▲' : '▼'} {Math.abs(trend)}%
            </span>
            {trendLabel && (
              <span className="text-xs text-gray-400">{trendLabel}</span>
            )}
          </div>
        )}
      </div>

      {/* Icon side */}
      {icon && (
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${bg}`}>
          <span className={`${iconColor}`}>{icon}</span>
        </div>
      )}
    </div>
  )
}
