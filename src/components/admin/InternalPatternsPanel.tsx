'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'

type Pattern = { pattern: string; note: string | null; created_at: string }

/**
 * "Plus icon" add-pattern UI for analytics_internal_pattern. Lists the
 * patterns already excluding traffic (migration 091), and a plus button that
 * reveals a small form. Submits to /api/admin/internal-patterns, which
 * inserts using the caller's own session so the table's
 * internal_pattern_admin_all RLS policy is what actually authorizes the
 * write — this component never touches the service-role key.
 *
 * On success, router.refresh() re-runs the server component so the new
 * pattern shows up in the list here AND changes what get_internal_anon_ids()
 * excludes on the next render (headline counts, excluded-count label, etc.)
 * without a full page reload.
 */
export default function InternalPatternsPanel({ patterns }: { patterns: Pattern[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pattern, setPattern] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  /** Removing a pattern is not destructive: the exclusion is computed at read
   *  time, so those events simply reappear on the next load. */
  const handleRemove = async (target: string) => {
    if (removing) return
    setRemoving(target)
    setError(null)
    try {
      const res = await fetch('/api/admin/internal-patterns', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: target }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error || 'Failed to remove pattern.')
        return
      }
      router.refresh()
    } catch {
      setError('Network error — try again.')
    } finally {
      setRemoving(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/internal-patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern, note: note.trim() || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'Failed to add pattern.')
        return
      }
      setPattern('')
      setNote('')
      setOpen(false)
      router.refresh()
    } catch {
      setError('Network error — try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {patterns.map((p) => (
          <span
            key={p.pattern}
            className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-md bg-ink-100 text-ink-700 text-xs font-mono"
            title={p.note || undefined}
          >
            {p.pattern}
            <button
              type="button"
              onClick={() => handleRemove(p.pattern)}
              disabled={removing === p.pattern}
              aria-label={`Remove ${p.pattern}`}
              title={`Stop excluding ${p.pattern}`}
              className="inline-flex items-center justify-center h-4 w-4 rounded text-ink-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
            >
              <span aria-hidden className="text-sm leading-none">&times;</span>
            </button>
          </span>
        ))}
        {patterns.length === 0 && (
          <span className="text-xs text-ink-400">No test-email patterns yet.</span>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center justify-center h-6 w-6 rounded-md border border-ink-200 text-ink-500 hover:border-ink-400 hover:text-ink-800 transition-colors"
          aria-label={open ? 'Cancel adding a pattern' : 'Add a test-email pattern'}
          title={open ? 'Cancel' : 'Add a test-email pattern'}
        >
          {open ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-start gap-2">
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="%@example.com or test%"
            maxLength={200}
            autoFocus
            className="px-2.5 py-1.5 rounded-md border border-ink-200 text-sm font-mono w-56 focus:outline-none focus:ring-1 focus:ring-ink-900"
          />
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="note (optional)"
            maxLength={200}
            className="px-2.5 py-1.5 rounded-md border border-ink-200 text-sm w-40 focus:outline-none focus:ring-1 focus:ring-ink-900"
          />
          <button
            type="submit"
            disabled={submitting || !pattern.trim()}
            className="px-3 py-1.5 rounded-md bg-ink-900 text-white text-sm disabled:opacity-50"
          >
            {submitting ? 'Adding…' : 'Add'}
          </button>
          {error && <p className="text-xs text-red-600 basis-full">{error}</p>}
        </form>
      )}
    </div>
  )
}
