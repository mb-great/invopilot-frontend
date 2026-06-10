import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolvePlanAccess } from '@/lib/billing/tiers';
import { requireBillingProfile } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';

/**
 * POST /api/invoices/convert
 * Converts a quote into a draft invoice (1-click).
 * Clones form_data into a new row with status='draft', marks original as 'converted'.
 * Gated by canUseQuotes (Pro+ only).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireBillingProfile(supabase);
  if (!auth.user || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user, profile } = auth;

  // Tier gate
  const access = resolvePlanAccess(profile);
  if (!access.plan.canUseQuotes) {
    return NextResponse.json(
      { error: 'Quote conversion requires Pro or Business plan.' },
      { status: 403 }
    );
  }

  // Parse body
  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const quoteId = body.id;
  if (!quoteId) {
    return NextResponse.json({ error: 'Missing quote id' }, { status: 400 });
  }

  const { data: quote, error: fetchErr } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', quoteId)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchErr || !quote) {
    return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
  }

  if (quote.payment_status === 'converted') {
    return NextResponse.json({ error: 'This quote has already been converted' }, { status: 409 });
  }

  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', quote.workspace_id);

  const nextNum = (count ?? 0) + 1;
  const newInvoiceNumber = `INV-${new Date().getFullYear()}-${String(nextNum).padStart(5, '0')}`;

  // Clone form_data, update invoice number
  const clonedFormData = {
    ...(quote.form_data || {}),
    invoiceNumber: newInvoiceNumber,
  };

  // Insert new draft invoice
  const { data: newInvoice, error: insertErr } = await supabase
    .from('invoices')
    .insert({
      user_id: user.id,
      workspace_id: quote.workspace_id,
      form_data: clonedFormData,
      status: 'queued',
      payment_status: 'draft',
      nickname: quote.nickname ? `${quote.nickname} (from quote)` : 'Converted Quote',
      amount: quote.amount,
      currency: quote.currency,
      invoice_number: newInvoiceNumber,
    })
    .select('id')
    .single();

  if (insertErr) {
    return NextResponse.json({ error: 'Failed to create invoice: ' + insertErr.message }, { status: 500 });
  }

  // Mark original as converted
  const { error: updateErr } = await supabase
    .from('invoices')
    .update({ payment_status: 'converted' })
    .eq('id', quoteId);

  if (updateErr) {
    // Rollback the insert if the update fails to ensure atomicity
    await supabase.from('invoices').delete().eq('id', newInvoice.id);
    return NextResponse.json({ error: 'Failed to convert quote: ' + updateErr.message }, { status: 500 });
  }

  // Notify backend queue to generate PDF
  try {
    const backendUrl = BACKEND_URL.replace('localhost', '127.0.0.1'); // Fix Node 18+ IPv6 fetch issue
    const res = await fetch(`${backendUrl}/queue`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-worker-secret': process.env.WORKER_SECRET || ''
      },
      body: JSON.stringify({
        invoiceId: newInvoice.id,
        formData: clonedFormData
      })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[API] Failed to dispatch job to backend during quote conversion. Status: ${res.status}. Body: ${errText}`);
    } else {
      console.log(`[API] Job successfully dispatched to backend for converted invoice ${newInvoice.id}`);
    }
  } catch (err) {
    console.error('[API] Fetch exception when dispatching job to backend during quote conversion:', err);
  }

  return NextResponse.json({
    data: { id: newInvoice.id, invoiceNumber: newInvoiceNumber },
    status: 200,
  });
}
