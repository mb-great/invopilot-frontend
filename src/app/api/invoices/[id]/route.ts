import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Verify ownership — RLS filters by workspace, explicit user_id for defense-in-depth
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('id, user_id, workspace_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (invoice.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // 2. Soft Delete (ADR-005). Storage cleanup by 90-day cron.
  //    Must include workspace_id in filter — PostgREST/RLS requires it for UPDATE policy.
  const { error: deleteError } = await supabase
    .from('invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('workspace_id', invoice.workspace_id);

  if (deleteError) {
    console.error('Soft delete error:', deleteError);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
