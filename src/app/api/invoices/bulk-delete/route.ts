import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ids, workspaceId } = await request.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Missing or invalid IDs' }, { status: 400 });
  }

  if (ids.length > 100) {
    return NextResponse.json({ error: 'Maximum 100 invoices per request' }, { status: 400 });
  }

  // Resolve workspace_id — required by RLS UPDATE policy on invoices table.
  // If frontend didn't send it, look it up server-side.
  let resolvedWorkspaceId = workspaceId;
  if (!resolvedWorkspaceId) {
    const { getActiveWorkspaceId } = await import('@/lib/workspace');
    resolvedWorkspaceId = await getActiveWorkspaceId(user.id);
  }

  if (!resolvedWorkspaceId) {
    console.error('Bulk delete: could not resolve workspace_id', { userId: user.id });
    return NextResponse.json({ error: 'Could not determine workspace' }, { status: 400 });
  }

  // Soft Delete (ADR-005) — filter by workspace_id to satisfy RLS UPDATE policy
  const { error } = await supabase
    .from('invoices')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
    .eq('workspace_id', resolvedWorkspaceId);

  if (error) {
    console.error('Bulk delete error:', JSON.stringify(error));
    console.error('Bulk delete params:', { ids, workspaceId: resolvedWorkspaceId, userId: user.id });
    return NextResponse.json({ error: 'Delete failed', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: ids.length });
}
