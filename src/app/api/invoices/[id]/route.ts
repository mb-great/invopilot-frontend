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

  // 1. Verify ownership and get PDF path
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('pdf_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !invoice) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // 2. Remove from Storage (prevent bloat)
  if (invoice.pdf_url) {
    await supabase.storage.from('invoices').remove([invoice.pdf_url]);
  }

  // 3. Hard Delete from DB
  const { error: deleteError } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (deleteError) {
    console.error('Hard delete error:', deleteError);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
