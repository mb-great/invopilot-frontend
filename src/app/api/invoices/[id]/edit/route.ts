import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, form_data, type, payment_status, nickname, invoice_number')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  if (invoice.type !== 'quote' || invoice.payment_status !== 'draft') {
    return NextResponse.json({ error: 'Only draft quotes can be edited' }, { status: 400 });
  }

  return NextResponse.json({ data: invoice });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { formData, nickname } = body;

  if (!formData) {
    return NextResponse.json({ error: 'formData required' }, { status: 400 });
  }

  // Verify it's a draft quote
  const { data: existing, error: fetchError } = await supabase
    .from('invoices')
    .select('id, type, payment_status, pdf_url')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  if (existing.type !== 'quote' || existing.payment_status !== 'draft') {
    return NextResponse.json({ error: 'Only draft quotes can be edited' }, { status: 400 });
  }

  // Delete old PDF blob if it exists
  if (existing.pdf_url) {
    const { error: storageErr } = await supabaseAdmin.storage.from('invoices').remove([existing.pdf_url]);
    if (storageErr) console.error('Failed to remove old PDF:', storageErr.message);
  }

  // Update form_data and re-queue for PDF generation
  const { error: updateError } = await supabase
    .from('invoices')
    .update({
      form_data: formData,
      nickname: nickname || undefined,
      status: 'queued',
      pdf_url: null,
      pdf_size: null,
      pdf_retry_count: 0,
      error_msg: null,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Trigger PDF generation via backend retry endpoint
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';
  try {
    await fetch(`${backendUrl}/retry`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-worker-secret': process.env.WORKER_SECRET || ''
      },
      body: JSON.stringify({ invoiceId: id }),
    });
  } catch (err) {
    console.error('Failed to trigger PDF generation:', err);
  }

  return NextResponse.json({ data: { id, status: 'queued' } });
}
