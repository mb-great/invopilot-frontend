import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/layout/DashboardShell'
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess'
import Link from 'next/link'
import { ArrowLeft, TrendingDown, Users2, Globe } from 'lucide-react'
import { countryName, countryFlag } from '@/lib/tracking/countries'

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

  const [{ data: statsData }, { data: dropoffData }, { data: visitorData }, { data: countryData }] =
    await Promise.all([
      supabase.rpc('get_funnel_stats', { p_days: days }),
      supabase.rpc('get_funnel_dropoff', { p_days: days }),
      supabase.rpc('get_funnel_visitors', { p_days: days, p_limit: 100 }),
      supabase.rpc('get_funnel_countries', { p_days: days }),
    ])

  const stats: FunnelStat[] = (statsData || []) as FunnelStat[]
  const dropoff: DropoffRow[] = (dropoffData || []) as DropoffRow[]
  const visitors: VisitorRow[] = (visitorData || []) as VisitorRow[]
  const countries: CountryRow[] = (countryData || []) as CountryRow[]

  const byEvent = new Map(stats.map((s) => [s.event, s]))
  const ordered = [
    ...FUNNEL_ORDER.filter((e) => byEvent.has(e)),
    ...stats.map((s) => s.event).filter((e) => !FUNNEL_ORDER.includes(e)),
  ]

  // Denominator = the widest step actually recorded, so percentages stay honest
  // even before the WordPress tag is live and landing events exist.
  const top = ordered.length ? Number(byEvent.get(ordered[0])?.people ?? 0) : 0
  const pct = (n: number) => (top > 0 ? Math.round((n / top) * 1000) / 10 : 0)

  const sends = Number(byEvent.get('send_clicked')?.people ?? 0)
  const downloads = Number(byEvent.get('download_clicked')?.people ?? 0)
  const signups = Number(byEvent.get('signup_completed')?.people ?? 0)
  const started = Number(byEvent.get('signup_started')?.people ?? 0)
  const totalPeople = dropoff.reduce((a, r) => a + Number(r.people), 0)

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
              <p className="text-xs text-ink-400 mt-1">distinct browsers in range</p>
            </div>
            <div className="rounded-xl border border-ink-200 bg-white p-5">
              <div className="text-ink-500 text-xs uppercase tracking-wide mb-2">Send vs Download</div>
              <div className="text-3xl font-bold text-ink-900">
                {sends} <span className="text-ink-300 font-normal">/</span> {downloads}
              </div>
              <p className="text-xs text-ink-400 mt-1">
                {sends + downloads > 0
                  ? `${Math.round((sends / (sends + downloads)) * 100)}% chose Send`
                  : 'no choices recorded yet'}
              </p>
            </div>
            <div className="rounded-xl border border-ink-200 bg-white p-5">
              <div className="text-ink-500 text-xs uppercase tracking-wide mb-2">Auth survival</div>
              <div className="text-3xl font-bold text-ink-900">
                {started > 0 ? `${Math.round((signups / started) * 100)}%` : '—'}
              </div>
              <p className="text-xs text-ink-400 mt-1">{signups} of {started} finished sign-in</p>
            </div>
          </div>

          {/* Funnel */}
          <div className="rounded-xl border border-ink-200 bg-white p-6 mb-8">
            <h2 className="text-lg font-semibold text-ink-900 mb-5">Funnel</h2>
            <div className="space-y-3">
              {ordered.map((ev) => {
                const s = byEvent.get(ev)!
                const people = Number(s.people)
                const width = Math.max(pct(people), 2)
                return (
                  <div key={ev}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="text-ink-700">{LABELS[ev] || ev}</span>
                      <span className="text-ink-500 tabular-nums">
                        {people} {top > 0 && <span className="text-ink-400">· {pct(people)}%</span>}
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-ink-100 overflow-hidden">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
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
              Where visitors connected from, by browser. Country comes from the network edge —
              we never store an IP address, city or location.
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
                  &ldquo;Unknown&rdquo; means the request did not reach us through the edge — expect
                  it to dominate until Cloudflare fronts every domain.
                </p>
              </>
            )}
          </div>

          {/* Drop-off map — the replay substitute */}
          <div className="rounded-xl border border-ink-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-ink-400" />
              <h2 className="text-lg font-semibold text-ink-900">Where people stopped</h2>
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

      {visitors.length > 0 && (
        <div className="rounded-xl border border-ink-200 bg-white p-6 mt-8">
          <h2 className="text-lg font-semibold text-ink-900 mb-2">Visitors</h2>
          <p className="text-sm text-ink-500 mb-5">
            One row per browser. Anonymous until they sign up — then the row resolves to their email
            and keeps the journey they took <em>before</em> they had an account.
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
          <p className="text-xs text-ink-400 mt-4">
            Showing up to 100 most recent. Anonymous ids are truncated — we store no name, email or
            IP against them until the person chooses to sign up. Country is a two-letter code
            resolved at the edge and is the only location we keep; the IP it came from is never
            written down.
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
