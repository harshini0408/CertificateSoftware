import { useRef, useState, useCallback } from 'react'

/**
 * FileUpload
 *
 * A styled drag-and-drop + click-to-browse file upload zone.
 *
 * Props:
 *   onFile       (File) => void      — called with the selected File object
 *   accept       string              — MIME types / extensions (e.g. ".xlsx,.xls")
 *   label        string              — zone heading text
 *   hint         string              — sub-text (e.g. "XLSX up to 10 MB")
 *   maxSizeMB    number              — client-side size guard (default: 10)
 *   disabled     boolean
 *   id           string              — unique id for the hidden input (required for a11y)
 */
export default function FileUpload({
  onFile,
  accept = '*',
  label = 'Drop your file here',
  hint = 'or click to browse',
  maxSizeMB = 10,
  disabled = false,
  id = 'file-upload',
}) {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const [fileName, setFileName] = useState(null)

  const validate = useCallback(
    (file) => {
      if (!file) return 'No file selected.'
      if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
        return `File is too large. Maximum size is ${maxSizeMB} MB.`
      }
      return null
    },
    [maxSizeMB],
  )

  const handle = useCallback(
    (file) => {
      const err = validate(file)
      if (err) {
        setError(err)
        setFileName(null)
        return
      }
      setError(null)
      setFileName(file.name)
      onFile?.(file)
    },
    [validate, onFile],
  )

  // ── Drag events ──────────────────────────────────────────────────────────
  const onDragOver = (e) => {
    e.preventDefault()
    if (!disabled) setDragOver(true)
  }
  const onDragLeave = () => setDragOver(false)
  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    handle(file)
  }

  // ── Input change ─────────────────────────────────────────────────────────
  const onChange = (e) => {
    const file = e.target.files?.[0]
    handle(file)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  const borderClass = dragOver
    ? 'border-navy bg-navy/5'
    : error
    ? 'border-red-400 bg-red-50'
    : fileName
    ? 'border-green-400 bg-green-50'
    : 'border-gray-300 bg-white hover:border-navy/50 hover:bg-navy/3'

  return (
    <div className="w-full">
      {/* Hidden real input */}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
        aria-label={label}
      />

      {/* Drop zone */}
      <label
        htmlFor={id}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`
          flex flex-col items-center justify-center gap-3
          rounded-lg border-2 border-dashed
          cursor-pointer transition-colors duration-150
          px-6 py-10
          ${borderClass}
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        `}
      >
        {/* Upload icon */}
        {!fileName ? (
          <svg
            className={`h-10 w-10 ${dragOver ? 'text-navy' : 'text-gray-300'} transition-colors`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        ) : (
          <svg
            className="h-10 w-10 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}

        <div className="text-center">
          {fileName ? (
            <>
              <p className="text-sm font-semibold text-green-700 truncate max-w-xs">{fileName}</p>
              <p className="text-xs text-gray-500 mt-0.5">Click to replace</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
            </>
          )}
        </div>
      </label>

      {/* Error message */}
      {error && <p className="form-error mt-2" role="alert">{error}</p>}
    </div>
  )
}
