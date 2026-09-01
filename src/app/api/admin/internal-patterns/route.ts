import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Add a pattern to analytics_internal_pattern (migration 091) from the
 * tracking dashboard's plus-icon UI. Deliberately uses the caller's own
 * Supabase session (via `createClient` / cookies), NOT the service-role
 * key — the table's `internal_pattern_admin_all` RLS policy (admin/
 * superadmin only) is what actually authorizes the insert. The role check
 * below is defence in depth, matching the other /api/admin/* routes; it is
 * not the security boundary.
 */

/**
 * Accepts the same shapes already seeded in migration 092:
 *   - full email pattern:  %@example.com, name@example.com
 *   - bare prefix/suffix:  test%, %temp   (no @, must end/start with %)
 * Rejects anything else, and rejects a pattern made only of wildcards
 * (`%`, `_`) since that would silently exclude every visitor.
 */
function validatePattern(raw: unknown): { pattern: string } | { error: string } {
  if (typeof raw !== 'string') {
    return { error: 'Pattern must be a string.' }
  }
  const pattern = raw.trim()
  if (!pattern) {
    return { error: 'Pattern cannot be empty.' }
  }
  if (pattern.length > 200) {
    return { error: 'Pattern must be 200 characters or fewer.' }
  }
  if (!/^[a-zA-Z0-9%_.@+-]+$/.test(pattern)) {
    return { error: 'Only letters, numbers, and . _ % @ + - are allowed.' }
  }
  if (/^[%_]+$/.test(pattern)) {
    return { error: 'Pattern cannot be only wildcards — it would match everyone.' }
  }
  if (pattern.includes('@')) {
    if (!/^[a-zA-Z0-9%_.+-]*@[a-zA-Z0-9%_.-]+\.[a-zA-Z%]{2,}$/.test(pattern)) {
      return {
        error: 'Looks like an email pattern but is not shaped like one, e.g. %@example.com or name@example.com.',
      }
    }
  } else if (!/^[a-zA-Z0-9._+-]+%$/.test(pattern) && !/^%[a-zA-Z0-9._+-]+$/.test(pattern)) {
    return {
      error: 'Without an @, the pattern must be a prefix or suffix ending in %, e.g. test% or %temp.',
    }
  }
  return { pattern }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { pattern?: unknown; note?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const result = validatePattern(body?.pattern)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const note =
    typeof body?.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 200) : null

  // Caller's own session — RLS's internal_pattern_admin_all policy is the
  // actual gate here, not this route handler.
  const { data, error } = await supabase
    .from('analytics_internal_pattern')
    .insert({ pattern: result.pattern, note })
    .select('pattern, note, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That pattern already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to add pattern.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

/**
 * Remove a pattern. Same authorization story as POST: the caller's own
 * session, with RLS's internal_pattern_admin_all as the real gate.
 *
 * Removing a pattern is not destructive to analytics data — the exclusion is
 * computed at read time by internal_anon_ids(), so the events that pattern was
 * hiding simply reappear in every card on the next page load. Nothing is
 * deleted from analytics_events.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { pattern?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (typeof body?.pattern !== 'string' || !body.pattern.trim()) {
    return NextResponse.json({ error: 'Pattern is required.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('analytics_internal_pattern')
    .delete()
    .eq('pattern', body.pattern.trim())

  if (error) {
    return NextResponse.json({ error: 'Failed to remove pattern.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
