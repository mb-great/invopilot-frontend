import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Get the invoice and check ownership
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, status, form_data')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

  // 2. Only allow retry if failed
  if (invoice.status !== 'failed') {
    return NextResponse.json({ error: `Cannot retry invoice with status: ${invoice.status}` }, { status: 400 });
  }

  // 3. Dispatch to backend queue
  try {
    const res = await fetch(`${BACKEND_URL}/retry`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-worker-secret': process.env.WORKER_SECRET || ''
      },
      body: JSON.stringify({
        invoiceId: invoice.id
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Backend queue failed');
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(`Retry error for ${id}:`, err);
    return NextResponse.json({ error: (err instanceof Error ? err.message : '') || 'Retry failed' }, { status: 500 });
  }
}
