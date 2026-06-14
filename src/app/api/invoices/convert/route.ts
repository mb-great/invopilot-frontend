import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';
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

  // Tier gate (checking against workspace owner)
  const access = await getWorkspaceAccess(supabase, quote.workspace_id);
  if (!access.plan.canUseQuotes && !access.isAdmin) {
    return NextResponse.json(
      { error: 'Quote conversion requires Pro or Business plan.' },
      { status: 403 }
    );
  }



  if (quote.payment_status === 'unpaid' || quote.payment_status === 'paid' || quote.payment_status === 'overdue') {
    return NextResponse.json({ error: 'This quote has already been converted' }, { status: 409 });
  }

  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', quote.workspace_id);

  const nextNum = (count ?? 0) + 1;
  const newInvoiceNumber = `INV-${new Date().getFullYear()}-${String(nextNum).padStart(5, '0')}`;

  // Update form_data and invoice number
  const updatedFormData = {
    ...(quote.form_data || {}),
    invoiceNumber: newInvoiceNumber,
  };

  // Mutate existing row
  const { error: updateErr } = await supabase
    .from('invoices')
    .update({
      form_data: updatedFormData,
      status: 'queued',
      payment_status: 'unpaid',
      invoice_number: newInvoiceNumber,
      nickname: quote.nickname ? `${quote.nickname} (Converted)` : 'Converted Quote'
    })
    .eq('id', quoteId);

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to convert quote: ' + updateErr.message }, { status: 500 });
  }

  // Notify backend queue to regenerate PDF for the SAME ID
  let dispatchFailed = false;
  try {
    const backendUrl = BACKEND_URL.replace('localhost', '127.0.0.1'); // Fix Node 18+ IPv6 fetch issue
    const res = await fetch(`${backendUrl}/queue`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-worker-secret': process.env.WORKER_SECRET || ''
      },
      body: JSON.stringify({
        invoiceId: quoteId,
        formData: updatedFormData
      })
    });
    
    if (!res.ok) {
      dispatchFailed = true;
      const errText = await res.text();
      console.error(`[API] Failed to dispatch job to backend during quote conversion. Status: ${res.status}. Body: ${errText}`);
    } else {
      console.log(`[API] Job successfully dispatched to backend for converted invoice ${quoteId}`);
    }
  } catch (err) {
    dispatchFailed = true;
    console.error('[API] Fetch exception when dispatching job to backend during quote conversion:', err);
  }

  // Rollback if dispatch fails so the user doesn't lose their quote forever
  if (dispatchFailed) {
    await supabase.from('invoices').update({
      form_data: quote.form_data,
      status: quote.status,
      payment_status: quote.payment_status,
      invoice_number: quote.invoice_number,
      nickname: quote.nickname
    }).eq('id', quoteId);

    return NextResponse.json({ error: 'Worker dispatch failed. Quote conversion rolled back.' }, { status: 500 });
  }

  return NextResponse.json({
    data: { id: quoteId, invoiceNumber: newInvoiceNumber },
    status: 200,
  });
}
