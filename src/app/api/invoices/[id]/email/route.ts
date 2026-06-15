import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getBackendUrl } from '@/lib/url';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    
    // Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { toEmail } = body;

    if (!toEmail) {
      return NextResponse.json({ error: 'toEmail is required' }, { status: 400 });
    }

    // Verify invoice ownership — must exist and not be soft-deleted
    const { data: invoice, error: fetchError } = await supabase
      .from('invoices')
      .select('id, workspace_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const backendUrl = getBackendUrl();

    // Call internal backend to perform the email sending
    const response = await fetch(`${backendUrl}/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': process.env.WORKER_SECRET || '',
      },
      body: JSON.stringify({
        invoiceId: id,
        toEmail
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('Failed to send email:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to send email' }, 
      { status: 500 }
    );
  }
}
