import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type PaymentStatus = 'draft' | 'unpaid' | 'paid' | 'overdue' | 'cancelled';

type UpdateInvoiceBody = {
  payment_status?: unknown;
  share_expires_at?: string | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('invoices')
    .select('status, error_msg, pdf_url, share_slug, share_expires_at')
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as UpdateInvoiceBody;
  const { payment_status } = body;

  const updateData: any = {};

  if (payment_status !== undefined) {
    const allowedStatuses: PaymentStatus[] = ['draft', 'unpaid', 'paid', 'overdue', 'cancelled'];
    if (typeof payment_status === 'string' && allowedStatuses.includes(payment_status as PaymentStatus)) {
      updateData.payment_status = payment_status;
      if (payment_status === 'paid') {
        updateData.paid_at = new Date().toISOString();
      } else {
        updateData.paid_at = null;
        // If unmarking paid, move back to draft to avoid automatic 'sent' status
        if (payment_status === 'draft') {
          updateData.payment_status = 'draft';
        }
      }
    }
  }

  // Remove share_expires_at update logic - links are now permanent

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', id)
    .select('id, payment_status, share_expires_at, paid_at')
    .single();

  if (error) {
    console.error('Update status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
  }

