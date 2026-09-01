'use client'

import { useRouter } from 'next/navigation'

/**
 * Checkbox for the `p_include_internal` toggle added in migration 095. The
 * dashboard page is a Server Component (it can't attach an onChange), so
 * this is a tiny client island — same pattern as TrackingExportButton — that
 * navigates to the pre-computed `href` (days/country preserved, `internal`
 * flipped) on change.
 */
export default function IncludeInternalToggle({
  checked,
  href,
}: {
  checked: boolean
  href: string
}) {
  const router = useRouter()

  return (
    <label className="inline-flex items-center gap-2 text-sm text-ink-600 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => router.push(href)}
        className="h-4 w-4 rounded border-ink-300 text-ink-900 focus:ring-ink-900 focus:ring-offset-0"
      />
      Include test accounts
    </label>
  )
}
