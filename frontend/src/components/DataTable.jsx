import { useState, useMemo } from 'react'
import LoadingSpinner from './LoadingSpinner'

/**
 * DataTable
 *
 * A reusable, sortable, filterable table component.
 *
 * Props:
 *   columns      Array<ColumnDef>   — column definitions (see below)
 *   data         Array<object>      — row data
 *   isLoading    boolean            — shows spinner overlay
 *   emptyMessage string             — message when data is empty
 *   searchable   boolean            — show top-right search input
 *   searchPlaceholder string
 *   actions      ReactNode          — slot for action buttons above the table
 *   rowKey       string | (row) => string  — key extractor (default: 'id')
 *   onRowClick   (row) => void      — optional row click handler
 *   stickyHeader boolean            — freeze header row
 *
 * ColumnDef:
 *   key          string             — data field key
 *   header       string             — column heading
 *   render       (value, row) => ReactNode  — custom cell renderer (optional)
 *   sortable     boolean            — is this column sortable?
 *   width        string             — optional CSS width (e.g. '120px')
 *   align        'left'|'center'|'right'   — text alignment (default: 'left')
 *   searchKey    boolean            — include this column in search (default: true)
 */
export default function DataTable({
  columns = [],
  data = [],
  isLoading = false,
  emptyMessage = 'No data found.',
  searchable = false,
  searchPlaceholder = 'Search…',
  actions,
  rowKey = 'id',
  onRowClick,
  stickyHeader = false,
}) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')   // 'asc' | 'desc'
  const [search, setSearch] = useState('')

  // ── Sorting ─────────────────────────────────────────────────────────────
  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // ── Filtered + sorted rows ───────────────────────────────────────────────
  const processedData = useMemo(() => {
    let rows = [...data]

    // Filter
    if (searchable && search.trim()) {
      const q = search.toLowerCase()
      const searchCols = columns.filter((c) => c.searchKey !== false)
      rows = rows.filter((row) =>
        searchCols.some((col) => {
          const val = row[col.key]
          return val != null && String(val).toLowerCase().includes(q)
        }),
      )
    }

    // Sort
    if (sortKey) {
      rows.sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        if (av == null) return 1
        if (bv == null) return -1
        const cmp =
          typeof av === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }

    return rows
  }, [data, search, searchable, columns, sortKey, sortDir])

  // ── Row key extractor ────────────────────────────────────────────────────
  const getKey = (row, i) =>
    typeof rowKey === 'function' ? rowKey(row) : (row[rowKey] ?? i)

  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }

  const SortIcon = ({ col }) => {
    if (!col.sortable) return null
    const active = sortKey === col.key
    return (
      <span className={`ml-1 inline-flex flex-col leading-none ${active ? 'text-navy' : 'text-gray-300'}`}>
        <svg className={`h-3 w-3 ${active && sortDir === 'asc' ? 'text-navy' : ''}`} viewBox="0 0 10 6" fill="currentColor">
          <path d="M0 6l5-6 5 6z" />
        </svg>
        <svg className={`h-3 w-3 -mt-0.5 ${active && sortDir === 'desc' ? 'text-navy' : ''}`} viewBox="0 0 10 6" fill="currentColor">
          <path d="M0 0l5 6 5-6z" />
        </svg>
      </span>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      {(actions || searchable) && (
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
          {searchable && (
            <div className="relative w-full sm:w-64">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="form-input pl-9 py-1.5"
                aria-label="Search table"
              />
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="relative overflow-x-auto">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
            <LoadingSpinner size="md" label="Loading…" />
          </div>
        )}

        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className={`bg-gray-50 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && toggleSort(col.key)}
                  className={`
                    px-4 py-3 font-semibold text-gray-600 uppercase tracking-wider text-xs
                    ${alignClass[col.align ?? 'left']}
                    ${col.sortable ? 'cursor-pointer select-none hover:text-navy' : ''}
                  `}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {col.header}
                    <SortIcon col={col} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-50 bg-white">
            {processedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-gray-500"
                >
                  {isLoading ? '' : emptyMessage}
                </td>
              </tr>
            ) : (
              processedData.map((row, i) => (
                <tr
                  key={getKey(row, i)}
                  onClick={() => onRowClick?.(row)}
                  className={`
                    transition-colors duration-100
                    ${onRowClick ? 'cursor-pointer hover:bg-navy/4' : 'hover:bg-gray-50/60'}
                  `}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`
                        whitespace-nowrap px-4 py-3 text-gray-700
                        ${alignClass[col.align ?? 'left']}
                      `}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Row count */}
      {!isLoading && data.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2 text-right text-xs text-gray-400">
          {processedData.length !== data.length
            ? `${processedData.length} of ${data.length} rows`
            : `${data.length} row${data.length !== 1 ? 's' : ''}`}
        </div>
      )}
    </div>
  )
}
