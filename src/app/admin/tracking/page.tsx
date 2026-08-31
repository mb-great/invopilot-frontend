import { createClient } from '@/lib/supabase/server'
import { pct as pctClamped, ratioLabel, isLowSample } from '@/lib/tracking/stats'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/layout/DashboardShell'
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess'
import Link from 'next/link'
import { ArrowLeft, TrendingDown, Users2, Globe } from 'lucide-react'
import { countryName, countryFlag } from '@/lib/tracking/countries'
import { visitorsToCsv, visitorsToJson, funnelToCsv, dropoffToCsv, exportFilename } from '@/lib/tracking/csv'
import TrackingExportButton from '@/components/admin/TrackingExportButton'

/**
 * Admin → Funnel Tracking. Spec: docs/ANALYTICS_FUNNEL_TRACKING.md (ADR-032).
 *
 * Own route rather than a section on /admin, so the aggregate queries only run
 * when someone actually opens this page (axes verdict 4/5).
 *
 * Both RPCs are SECURITY DEFINER and admin-gated in SQL, so a non-admin gets
 * empty results even if they reach this URL — the redirect below is defence in depth.
 */

type FunnelStat = { event: string; people: number; events: number }
type CountryRow = { country: string; people: number; events: number }
type DropoffRow = {
  last_event: string
  last_step: string | null
  viewport_bucket: string
  country: string
  people: number
}
type VisitorRow = {
  visitor: string
  converted: boolean
  events: number
  first_seen: string
  last_seen: string
  last_event: string
  last_step: string | null
  last_field: string | null
  device: string
  country: string
  journey: string
  /** Full count in the window, identical on every row — see migration 089. */
  total: number
}

/** Funnel order. Anything not listed still renders, just after these. */
const FUNNEL_ORDER = [
  'wp_landing_viewed',
  'generator_started',
  'builder_step_viewed',
  'invoice_ready_viewed',
  'send_clicked',
  'signup_started',
  'signup_completed',
]

const LABELS: Record<string, string> = {
  wp_landing_viewed: 'Landed on invopilot.com',
  generator_started: 'Started building an invoice',
  builder_step_viewed: 'Moved through builder steps',
  invoice_ready_viewed: 'Reached "invoice ready"',
  send_clicked: 'Clicked Send & get paid',
  download_clicked: 'Clicked Download PDF only',
  signup_started: 'Started Google sign-in',
  signup_completed: 'Finished signing up',
  session_end: 'Left mid-session',
}

export default async function AdminTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const access = await getWorkspaceAccess(supabase)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
    redirect('/dashboard')
  }

  const resolved = (await searchParams) || {}
  const days = typeof resolved.days === 'string' ? parseInt(resolved.days, 10) || 30 : 30

  // Page size is capped at 50 in the RPC too — the SQL is the authority, this
  // constant only has to agree with it.
  const PAGE_SIZE = 50
  const pageParam = typeof resolved.page === 'string' ? parseInt(resolved.page, 10) : 1
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

  const [
    { data: statsData },
    { data: toolStatsData },
    { data: directStatsData },
    { data: dropoffData },
    { data: visitorData },
    { data: countryData },
  ] = await Promise.all([
    supabase.rpc('get_funnel_stats', { p_days: days }),
    // T4 (audit Part 2): the single funnel above mixed tool users with direct
    // signups, so it's split into two — see migration 093.
    supabase.rpc('get_tool_funnel_stats', { p_days: days }),
    supabase.rpc('get_direct_signup_funnel_stats', { p_days: days }),
    supabase.rpc('get_funnel_dropoff', { p_days: days }),
    supabase.rpc('get_funnel_visitors', {
      p_days: days,
      p_limit: PAGE_SIZE,
      p_offset: (page - 1) * PAGE_SIZE,
    }),
    supabase.rpc('get_funnel_countries', { p_days: days }),
  ])

  const stats: FunnelStat[] = (statsData || []) as FunnelStat[]
  const toolStats: FunnelStat[] = (toolStatsData || []) as FunnelStat[]
  const directStats: FunnelStat[] = (directStatsData || []) as FunnelStat[]
  const dropoff: DropoffRow[] = (dropoffData || []) as DropoffRow[]
  const visitors: VisitorRow[] = (visitorData || []) as VisitorRow[]
  const countries: CountryRow[] = (countryData || []) as CountryRow[]

  // `total` is the same on every row (window function), so row 0 carries it.
  // Zero rows means either an empty window or a page past the end — both render
  // as "no visitors on this page" rather than a broken count.
  const visitorTotal = visitors.length > 0 ? Number(visitors[0].total) : 0
  const pageCount = Math.max(1, Math.ceil(visitorTotal / PAGE_SIZE))
  const firstOnPage = visitorTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const lastOnPage = (page - 1) * PAGE_SIZE + visitors.length
  const pageHref = (n: number) => `/admin/tracking?days=${days}&page=${n}`

  const byEvent = new Map(stats.map((s) => [s.event, s]))
  const ordered = [
    ...FUNNEL_ORDER.filter((e) => byEvent.has(e)),
    ...stats.map((s) => s.event).filter((e) => !FUNNEL_ORDER.includes(e)),
  ]

  // Denominator = the widest step actually recorded, so percentages stay honest
  // even before the WordPress tag is live and landing events exist.
  const top = ordered.length ? Number(byEvent.get(ordered[0])?.people ?? 0) : 0
  // Clamped in lib/tracking/stats — a funnel step is a subset of the one above
  // it, so a ratio over 100% means an event mis-fired, not that we did well.
  const pctOf = (n: number) => pctClamped(n, top) ?? 0

  const sends = Number(byEvent.get('send_clicked')?.people ?? 0)
  const downloads = Number(byEvent.get('download_clicked')?.people ?? 0)
  const signups = Number(byEvent.get('signup_completed')?.people ?? 0)
  const started = Number(byEvent.get('signup_started')?.people ?? 0)
  const totalPeople = dropoff.reduce((a, r) => a + Number(r.people), 0)

  // T4 (audit Part 2): the funnel above mixed tool users with direct signups,
  // which is why "Finished signing up" could sit below "Started Google
  // sign-in" in the list yet show a higher count — they weren't the same
  // journey. Split into two funnels (migration 093): tool funnel is scoped to
  // anon_ids that reached invoice_ready_viewed, direct-signup funnel to
  // anon_ids that started/finished signup without ever doing so — disjoint by
  // construction, so the two step lists below are never comparing different
  // populations under one label again.
  const orderFunnel = (rows: FunnelStat[]) => {
    const byEv = new Map(rows.map((s) => [s.event, s]))
    const ord = [
      ...FUNNEL_ORDER.filter((e) => byEv.has(e)),
      ...rows.map((s) => s.event).filter((e) => !FUNNEL_ORDER.includes(e)),
    ]
    const topN = ord.length ? Number(byEv.get(ord[0])?.people ?? 0) : 0
    const pct = (n: number) => pctClamped(n, topN) ?? 0
    return { byEv, ord, topN, pct }
  }

  const toolFunnel = orderFunnel(toolStats)
  const directFunnel = orderFunnel(directStats)

  // T8 (audit Part 5): exports are a browser-side Blob of the rows already
  // loaded above — those rows already reflect both active filters (`days`
  // and, for Visitors, `page`), so serialising them as-is is what makes the
  // export match the screen, with no second query to keep in sync.
  const labelFor = (event: string) => LABELS[event] || event
  const toFunnelCsvRows = (f: ReturnType<typeof orderFunnel>) =>
    f.ord.map((ev) => {
      const people = Number(f.byEv.get(ev)!.people)
      return { event: ev, people, percent: f.pct(people) }
    })

  const visitorsCsv = visitorsToCsv(visitors, labelFor)
  const visitorsJson = visitorsToJson(visitors)
  const toolFunnelCsv = funnelToCsv(toFunnelCsvRows(toolFunnel), labelFor)
  const directFunnelCsv = funnelToCsv(toFunnelCsvRows(directFunnel), labelFor)
  const dropoffCsv = dropoffToCsv(dropoff, labelFor)

  const visitorsCsvFilename = exportFilename('visitors', days, page)
  const visitorsJsonFilename = visitorsCsvFilename.replace(/\.csv$/, '.json')
  const toolFunnelCsvFilename = exportFilename('funnel_tool', days)
  const directFunnelCsvFilename = exportFilename('funnel_direct', days)
  const dropoffCsvFilename = exportFilename('dropoff', days)

  // Ranked bars, not a pie: country traffic is a long tail — one dominant market
  // plus a fan of sub-1% slivers that no angle comparison can separate (ADR-033).
  const countryTotal = countries.reduce((a, c) => a + Number(c.people), 0)
  const countryMax = countries.reduce((a, c) => Math.max(a, Number(c.people)), 0)
  const knownCountries = countries.filter((c) => c.country !== 'ZZ').length
  const countryPct = (n: number) =>
    countryTotal > 0 ? Math.round((n / countryTotal) * 1000) / 10 : 0

  // Cap the rendered bars. The RPC returns every country it saw, and a tail of
  // one-visitor rows is real data but not readable as 200 bars — it gets rolled
  // into a single line so the total still reconciles and nothing is hidden.
  const COUNTRY_ROWS = 15
  const topCountries = countries.slice(0, COUNTRY_ROWS)
  const restCountries = countries.slice(COUNTRY_ROWS)
  const restPeople = restCountries.reduce((a, c) => a + Number(c.people), 0)

  const RANGES = [7, 30, 90]

  return (
    <DashboardShell
      userEmail={user.email}
      userName={profile?.full_name}
      avatarUrl={profile?.avatar_url}
      access={access}
    >
      <div className="mb-8">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-ink-500 hover:text-ink-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>
        <h1 className="text-4xl font-bold mb-3 tracking-tight text-ink-900" style={{ fontFamily: 'var(--font-display)' }}>
          Funnel Tracking
        </h1>
        <p className="text-ink-500 text-lg">
          Where people drop off between landing on the site and finishing signup — including everyone who never signs up.
        </p>
      </div>

      <div className="flex gap-2 mb-8">
        {RANGES.map((d) => (
          <Link
            key={d}
            href={`/admin/tracking?days=${d}`}
            className={`px-4 py-2 rounded-lg text-sm border transition-colors ${
              days === d
                ? 'bg-ink-900 text-white border-ink-900'
                : 'bg-white text-ink-600 border-ink-200 hover:border-ink-400'
            }`}
          >
            Last {d} days
          </Link>
        ))}
      </div>

      {totalPeople === 0 ? (
        <div className="rounded-xl border border-ink-200 bg-white p-10 text-center">
          <p className="text-ink-900 font-semibold mb-1">No events recorded yet</p>
          <p className="text-ink-500 text-sm">
            The table exists and the API is live, but no client is sending events for this window yet.
          </p>
        </div>
      ) : (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <div className="rounded-xl border border-ink-200 bg-white p-5">
              <div className="flex items-center gap-2 text-ink-500 text-xs uppercase tracking-wide mb-2">
                <Users2 className="w-4 h-4" /> People seen
              </div>
              <div className="text-3xl font-bold text-ink-900">{totalPeople}</div>
              <p className="text-xs text-ink-400 mt-1">
                Distinct browsers in range, including people who never reached a tracked
                funnel step below.
              </p>
              {top > 0 && ordered.length > 0 && (
                <p className="text-xs text-ink-400 mt-1">
                  The funnel starts lower, at {top} — only people who reached its first
                  step, &ldquo;{LABELS[ordered[0]] || ordered[0]}&rdquo;.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-ink-200 bg-white p-5">
              <div className="text-ink-500 text-xs uppercase tracking-wide mb-2">Send vs Download</div>
              <div className="text-3xl font-bold text-ink-900">
                {sends} <span className="text-ink-300 font-normal">/</span> {downloads}
              </div>
              <p className="text-xs text-ink-400 mt-1">
                Of people who finished an invoice, how many clicked &ldquo;Send &amp; get
                paid&rdquo; instead of &ldquo;Download PDF only.&rdquo;
              </p>
              <p className="text-xs text-ink-400 mt-1">
                {sends + downloads > 0
                  ? `${ratioLabel(sends, sends + downloads)} chose Send${isLowSample(sends + downloads) ? ' · low sample' : ''}`
                  : 'no choices recorded yet'}
              </p>
            </div>
            <div className="rounded-xl border border-ink-200 bg-white p-5">
              <div className="text-ink-500 text-xs uppercase tracking-wide mb-2">Auth survival</div>
              <div className="text-3xl font-bold text-ink-900">
                {ratioLabel(signups, started)}
              </div>
              <p className="text-xs text-ink-400 mt-1">
                Of people who started Google sign-in, how many finished creating an account.
              </p>
              <p className="text-xs text-ink-400 mt-1">
                {signups > started
                  ? `${signups} of ${started} — signup_started under-fires through the OAuth redirect, so this will read "check data" until that's fixed`
                  : `${signups} of ${started} finished sign-in`}
              </p>
            </div>
          </div>

          {/* Tool funnel — people who came to build an invoice. Scoped to
              anon_ids that reached invoice_ready_viewed (migration 093, T4). */}
          <div className="rounded-xl border border-ink-200 bg-white p-6 mb-8">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-lg font-semibold text-ink-900">Tool funnel</h2>
              <TrackingExportButton content={toolFunnelCsv} filename={toolFunnelCsvFilename} />
            </div>
            <p className="text-sm text-ink-500 mb-5">
              Visitors who reached &ldquo;invoice ready&rdquo; — started an invoice, moved through
              the builder, then (maybe) sent or downloaded it and signed up. People who never
              touched the tool are not in this funnel; see &ldquo;Direct signup funnel&rdquo; below.
            </p>
            {toolFunnel.ord.length === 0 ? (
              <p className="text-sm text-ink-400">No tool-funnel visitors in this window.</p>
            ) : (
              <div className="space-y-3">
                {toolFunnel.ord.map((ev) => {
                  const s = toolFunnel.byEv.get(ev)!
                  const people = Number(s.people)
                  const width = Math.max(toolFunnel.pct(people), 2)
                  return (
                    <div key={ev}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-ink-700">{LABELS[ev] || ev}</span>
                        <span className="text-ink-500 tabular-nums">
                          {people}{' '}
                          {toolFunnel.topN > 0 && (
                            <span className="text-ink-400">· {toolFunnel.pct(people)}%</span>
                          )}
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-ink-100 overflow-hidden">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Direct-signup funnel — people who landed on beta login and signed
              up without touching the tool (migration 093, T4). */}
          <div className="rounded-xl border border-ink-200 bg-white p-6 mb-8">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-lg font-semibold text-ink-900">Direct signup funnel</h2>
              <TrackingExportButton content={directFunnelCsv} filename={directFunnelCsvFilename} />
            </div>
            <p className="text-sm text-ink-500 mb-5">
              Visitors who started or finished signup without ever reaching &ldquo;invoice
              ready.&rdquo; Kept separate from the tool funnel above so neither one hides the
              other&apos;s true conversion rate.
            </p>
            {directFunnel.ord.length === 0 ? (
              <p className="text-sm text-ink-400">No direct-signup visitors in this window.</p>
            ) : (
              <div className="space-y-3">
                {directFunnel.ord.map((ev) => {
                  const s = directFunnel.byEv.get(ev)!
                  const people = Number(s.people)
                  const width = Math.max(directFunnel.pct(people), 2)
                  return (
                    <div key={ev}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-ink-700">{LABELS[ev] || ev}</span>
                        <span className="text-ink-500 tabular-nums">
                          {people}{' '}
                          {directFunnel.topN > 0 && (
                            <span className="text-ink-400">· {directFunnel.pct(people)}%</span>
                          )}
                        </span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-ink-100 overflow-hidden">
                        <div className="h-full rounded-full bg-brand-500" style={{ width: `${width}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Traffic by country — ranked bars.
              Deliberately NOT a pie: this distribution is one dominant market plus a
              long tail of sub-1% countries, and slice angles are unreadable down there.
              Bars reuse the Funnel section's visual grammar and stay legible at 30 rows. */}
          <div className="rounded-xl border border-ink-200 bg-white p-6 mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-5 h-5 text-ink-400" />
              <h2 className="text-lg font-semibold text-ink-900">Traffic by country</h2>
            </div>
            <p className="text-sm text-ink-500 mb-5">
              Where visitors connected from, by browser. Country is resolved server-side from
              the visitor&apos;s IP using an offline lookup table — the IP itself is read in
              memory and never stored, only the two-letter country code.
            </p>

            {countryTotal === 0 ? (
              <p className="text-sm text-ink-400">No country data for this window.</p>
            ) : (
              <>
                <div className="space-y-3">
                  {topCountries.map((c) => {
                    const people = Number(c.people)
                    const unknown = c.country === 'ZZ'
                    // Bars scale to the LARGEST country, not the total. Against the total,
                    // one dominant market flattens every other row into an invisible stub.
                    const width = countryMax > 0 ? Math.max((people / countryMax) * 100, 1.5) : 0
                    return (
                      <div key={c.country}>
                        <div className="flex justify-between text-sm mb-1.5 gap-4">
                          <span className={unknown ? 'text-ink-400' : 'text-ink-700'}>
                            <span className="mr-2">{countryFlag(c.country)}</span>
                            {countryName(c.country)}
                          </span>
                          <span className="text-ink-500 tabular-nums whitespace-nowrap">
                            {people} <span className="text-ink-400">· {countryPct(people)}%</span>
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-ink-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${unknown ? 'bg-ink-300' : 'bg-brand-500'}`}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {restCountries.length > 0 && (
                  <div className="flex justify-between text-sm text-ink-400 mt-3 pt-3 border-t border-ink-100">
                    <span>+ {restCountries.length} more</span>
                    <span className="tabular-nums">
                      {restPeople} <span>· {countryPct(restPeople)}%</span>
                    </span>
                  </div>
                )}
                <p className="text-xs text-ink-400 mt-5">
                  {knownCountries} {knownCountries === 1 ? 'country' : 'countries'} identified
                  {restCountries.length > 0 && `, top ${COUNTRY_ROWS} shown`}.
                  Bar length is relative to the largest country; the percentage is of all visitors.
                  &ldquo;Unknown&rdquo; means the event happened before country lookup went live —
                  since the IP was never stored, those historical rows can&apos;t be backfilled.
                </p>
              </>
            )}
          </div>

          {/* Drop-off map — the replay substitute */}
          <div className="rounded-xl border border-ink-200 bg-white p-6">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-ink-400" />
                <h2 className="text-lg font-semibold text-ink-900">Where people stopped</h2>
              </div>
              <TrackingExportButton content={dropoffCsv} filename={dropoffCsvFilename} />
            </div>
            <p className="text-sm text-ink-500 mb-5">
              The last thing each person did. Mobile-heavy rows on one step usually mean a layout
              problem there; a country stacked on one step usually means that market hits something
              the others don&apos;t — sign-in, currency or tax defaults.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-ink-500 border-b border-ink-200">
                    <th className="pb-2 font-medium">Last action</th>
                    <th className="pb-2 font-medium">Step</th>
                    <th className="pb-2 font-medium">Device</th>
                    <th className="pb-2 font-medium">Country</th>
                    <th className="pb-2 font-medium text-right">People</th>
                  </tr>
                </thead>
                <tbody>
                  {dropoff.map((r, i) => (
                    <tr key={i} className="border-b border-ink-100 last:border-0">
                      <td className="py-2.5 text-ink-800">{LABELS[r.last_event] || r.last_event}</td>
                      <td className="py-2.5 text-ink-500">{r.last_step || '—'}</td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            r.viewport_bucket === 'mobile'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-ink-100 text-ink-600'
                          }`}
                        >
                          {r.viewport_bucket}
                        </span>
                      </td>
                      <td className="py-2.5 whitespace-nowrap">
                        <span className={r.country === 'ZZ' ? 'text-ink-400' : 'text-ink-700'}>
                          <span className="mr-1.5">{countryFlag(r.country)}</span>
                          {countryName(r.country)}
                        </span>
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-ink-900">{r.people}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {(visitors.length > 0 || page > 1) && (
        <div className="rounded-xl border border-ink-200 bg-white p-6 mt-8">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h2 className="text-lg font-semibold text-ink-900">Visitors</h2>
            <div className="flex items-center gap-2">
              <TrackingExportButton content={visitorsCsv} filename={visitorsCsvFilename} />
              <TrackingExportButton
                content={visitorsJson}
                filename={visitorsJsonFilename}
                mimeType="application/json;charset=utf-8"
                label="Export JSON"
              />
            </div>
          </div>
          <p className="text-sm text-ink-500 mb-5">
            One row per browser. Anonymous until they sign up — then the row resolves to their email
            and keeps the journey they took <em>before</em> they had an account.
          </p>
          <p className="text-xs text-ink-400 mb-5">
            Converted rows carry a real email — treat these exports as personal data: keep them
            private, don&apos;t post them publicly, and share carefully.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[840px]">
              <thead>
                <tr className="text-left text-ink-500 border-b border-ink-200">
                  <th className="pb-2 font-medium">Visitor</th>
                  <th className="pb-2 font-medium">Device</th>
                  <th className="pb-2 font-medium">Country</th>
                  <th className="pb-2 font-medium">Stopped at</th>
                  <th className="pb-2 font-medium">Field</th>
                  <th className="pb-2 font-medium text-right">Events</th>
                  <th className="pb-2 font-medium text-right">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((v, i) => (
                  <tr key={i} className="border-b border-ink-100 last:border-0 align-top">
                    <td className="py-2.5">
                      <span className={v.converted ? 'text-ink-900 font-medium' : 'text-ink-500 font-mono text-xs'}>
                        {v.visitor}
                      </span>
                      {v.converted && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] uppercase tracking-wide">
                          converted
                        </span>
                      )}
                      <div className="text-[11px] text-ink-400 mt-1 max-w-[380px] truncate" title={v.journey}>
                        {v.journey.replace(/ -> /g, ' → ')}
                      </div>
                    </td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        v.device === 'mobile' ? 'bg-amber-100 text-amber-800' : 'bg-ink-100 text-ink-600'
                      }`}>
                        {v.device}
                      </span>
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      <span
                        className={v.country === 'ZZ' ? 'text-ink-400' : 'text-ink-700'}
                        title={countryName(v.country)}
                      >
                        <span className="mr-1.5">{countryFlag(v.country)}</span>
                        {countryName(v.country)}
                      </span>
                    </td>
                    <td className="py-2.5 text-ink-700">
                      {LABELS[v.last_event] || v.last_event}
                      {v.last_step && <span className="text-ink-400"> · step {v.last_step}</span>}
                    </td>
                    <td className="py-2.5 text-ink-500">{v.last_field || '—'}</td>
                    <td className="py-2.5 text-right tabular-nums text-ink-900">{v.events}</td>
                    <td className="py-2.5 text-right text-ink-400 text-xs whitespace-nowrap">
                      {new Date(v.last_seen).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-ink-100">
            <p className="text-xs text-ink-500 tabular-nums">
              {visitorTotal === 0 ? (
                'No visitors on this page.'
              ) : (
                <>
                  Showing <span className="text-ink-800 font-medium">{firstOnPage}–{lastOnPage}</span>{' '}
                  of <span className="text-ink-800 font-medium">{visitorTotal}</span>{' '}
                  {visitorTotal === 1 ? 'visitor' : 'visitors'}
                  <span className="text-ink-400"> · page {page} of {pageCount}</span>
                </>
              )}
            </p>

            {/* A page past the end returns nothing, so pageCount collapses to 1 and
                the normal nav disappears — without this the only way back is
                editing the URL. */}
            {visitorTotal === 0 && page > 1 && (
              <Link href={pageHref(1)} className="px-2.5 py-1 rounded-md border border-ink-200 text-xs text-ink-700 hover:bg-ink-50">
                Back to first page
              </Link>
            )}

            {pageCount > 1 && (
              <nav className="flex items-center gap-1.5" aria-label="Visitors pagination">
                {page > 1 ? (
                  <Link href={pageHref(page - 1)} className="px-2.5 py-1 rounded-md border border-ink-200 text-xs text-ink-700 hover:bg-ink-50">
                    Previous
                  </Link>
                ) : (
                  <span className="px-2.5 py-1 rounded-md border border-ink-100 text-xs text-ink-300">Previous</span>
                )}
                {page < pageCount ? (
                  <Link href={pageHref(page + 1)} className="px-2.5 py-1 rounded-md border border-ink-200 text-xs text-ink-700 hover:bg-ink-50">
                    Next
                  </Link>
                ) : (
                  <span className="px-2.5 py-1 rounded-md border border-ink-100 text-xs text-ink-300">Next</span>
                )}
                {page !== pageCount && (
                  <Link href={pageHref(pageCount)} className="px-2.5 py-1 rounded-md text-xs text-ink-500 hover:text-ink-800">
                    Last
                  </Link>
                )}
              </nav>
            )}
          </div>

          <p className="text-xs text-ink-400 mt-4">
            Anonymous ids are truncated to their first 8 characters — we store no name, email or IP
            against them until the person chooses to sign up. Country is a two-letter code resolved
            server-side from the visitor IP and is the only location we keep; the IP itself is read
            in memory and never written down.
          </p>
        </div>
      )}

      <p className="text-xs text-ink-400 mt-8">
        Percentages are relative to the widest recorded step. Treat anything under ~200 people at the
        top of the funnel as directional only — small numbers lie.
      </p>
    </DashboardShell>
  )
}
