'use client'

/**
 * Client-side download trigger for the tracking dashboard exports (T8, audit
 * Part 5). The page that renders this is a server component and can't attach
 * an onClick, so the CSV/JSON content is computed server-side (pure functions
 * in src/lib/tracking/csv.ts) and handed to this component as a finished
 * string — this component's only job is the Blob + temporary-link download.
 */
export default function TrackingExportButton({
  content,
  filename,
  mimeType,
  label = 'Export CSV',
}: {
  content: string
  filename: string
  mimeType?: string
  label?: string
}) {
  const handleClick = () => {
    const blob = new Blob([content], { type: mimeType || 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="px-2.5 py-1 rounded-md border border-ink-200 text-xs text-ink-700 hover:bg-ink-50 whitespace-nowrap"
    >
      {label}
    </button>
  )
}
