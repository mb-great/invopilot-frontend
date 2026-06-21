import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';
import { requireBillingProfile } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';

/**
 * POST /api/invoices/convert
 * Converts a quote into a draft invoice (1-click).
 * Inserts a brand new row with type='invoice' and payment_status='unpaid', 
 * marks original quote as payment_status='converted'.
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



  if (quote.type !== 'quote' || quote.payment_status === 'converted') {
    return NextResponse.json({ error: 'This quote has already been converted or is not a quote' }, { status: 409 });
  }

  // Get next invoice number — use MAX to avoid duplicates from deleted invoices
  const { data: maxRow } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('workspace_id', quote.workspace_id)
    .not('invoice_number', 'is', null)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastNum = maxRow?.invoice_number
    ? parseInt(maxRow.invoice_number.replace(/\D/g, ''), 10) || 0
    : 0;
  const nextNum = lastNum + 1;
  const newInvoiceNumber = `INV-${new Date().getFullYear()}-${String(nextNum).padStart(5, '0')}`;

  // Update form_data and invoice number for the NEW invoice
  const updatedFormData = {
    ...(quote.form_data || {}),
    invoiceNumber: newInvoiceNumber,
  };

  // Insert NEW Invoice Row
  const { data: newInvoice, error: insertErr } = await supabase
    .from('invoices')
    .insert({
      user_id: user.id,
      workspace_id: quote.workspace_id,
      form_data: updatedFormData,
      nickname: quote.nickname, // keep original clean nickname
      status: 'queued',
      amount: quote.amount,
      currency: quote.currency,
      client_name: quote.client_name,
      client_email: quote.client_email,
      business_profile_name: quote.business_profile_name,
      type: 'invoice',
      payment_status: 'unpaid',
      delivery_status: 'unsent',
      pdf_retry_count: 0,
      invoice_number: newInvoiceNumber,
      issue_date: quote.issue_date,
      due_date: quote.due_date,
      expires_at: quote.expires_at,
    })
    .select('id').single();

  if (insertErr || !newInvoice) {
    return NextResponse.json({ error: 'Failed to create invoice: ' + insertErr?.message }, { status: 500 });
  }

  // Mark original Quote as converted
  await supabase
    .from('invoices')
    .update({ payment_status: 'converted' })
    .eq('id', quoteId);

  // Notify backend queue to generate PDF for the NEW INVOICE
  let dispatchFailed = false;
  try {
    const backendUrl = BACKEND_URL.replace('localhost', '127.0.0.1');
    const res = await fetch(`${backendUrl}/queue`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-worker-secret': process.env.WORKER_SECRET || ''
      },
      body: JSON.stringify({
        invoiceId: newInvoice.id,
        formData: updatedFormData
      })
    });
    
    if (!res.ok) {
      dispatchFailed = true;
      const errText = await res.text();
      console.error(`[API] Failed to dispatch job to backend for converted invoice ${newInvoice.id}. Status: ${res.status}. Body: ${errText}`);
    } else {
      console.log(`[API] Job successfully dispatched to backend for converted invoice ${newInvoice.id}`);
    }
  } catch (err) {
    dispatchFailed = true;
    console.error('[API] Fetch exception when dispatching job to backend during quote conversion:', err);
  }

  // Rollback if dispatch fails (soft-delete per ADR-005)
  if (dispatchFailed) {
    await supabase.from('invoices').update({ deleted_at: new Date().toISOString() }).eq('id', newInvoice.id);
    await supabase.from('invoices').update({ payment_status: 'draft' }).eq('id', quoteId);
    return NextResponse.json({ error: 'Worker dispatch failed. Quote conversion rolled back.' }, { status: 500 });
  }

  return NextResponse.json({
    data: { id: newInvoice.id, invoiceNumber: newInvoiceNumber },
    status: 200,
  });
}
