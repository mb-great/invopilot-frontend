import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/ratelimit';
import { logger } from '@/lib/logger';

const QUEUE_CAP = 100;
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Rate limit — 10/min per IP
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 10, 60_000))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  // 2. One active job per user
  const { data: active } = await supabase
    .from('invoices').select('id')
    .eq('user_id', user.id)
    .in('status', ['queued', 'processing'])
    .maybeSingle();

  if (active)
    return NextResponse.json({ error: 'Invoice already generating' }, { status: 429 });

  // 3. Queue cap
  const { count } = await supabase
    .from('invoices').select('id', { count: 'exact', head: true })
    .eq('status', 'queued');

  if ((count ?? 0) >= QUEUE_CAP)
    return NextResponse.json({ error: 'Server busy. Try again shortly.' }, { status: 503 });

  // 4. Insert into DB
  const body = await request.json();
  const formData = body.formData || {};
  
  // Parse dates safely for indexing
  const issueDate = formData.issueDate ? new Date(formData.issueDate).toISOString().split('T')[0] : null;
  const dueDate = formData.dueDate ? new Date(formData.dueDate).toISOString().split('T')[0] : null;

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      user_id: user.id,
      form_data: formData,
      nickname: body.nickname || null,
      status: 'queued',
      // Phase 12: Extract indexed columns for fast queries
      amount: parseFloat(formData.amount) || 0,
      currency: formData.currency || 'INR',
      client_name: formData.clientName || '',
      client_email: formData.clientEmail || '',
      payment_status: 'draft',
      invoice_number: formData.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      issue_date: issueDate,
      due_date: dueDate,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id').single();

  if (error || !invoice) {
    logger.error('invoice', 'insert_failed', { user_id: user.id, err: error?.message });
    return NextResponse.json({ error: error?.message || 'Database error', details: error }, { status: 500 });
  }

  logger.info('invoice', 'created', { id: invoice.id, user_id: user.id, amt: formData.amount, cur: formData.currency });

  // 5. Send to isolated backend worker
  try {
    await fetch(`${BACKEND_URL}/queue`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-worker-secret': process.env.WORKER_SECRET || ''
      },
      body: JSON.stringify({
        invoiceId: invoice.id,
        formData: body.formData || {}
      })
    });
  } catch (err) {
    console.error('Failed to dispatch job to backend:', err);
    // Even if dispatch fails, it's queued in DB. Admin can retry or cron can sweep.
  }

  return NextResponse.json({ invoiceId: invoice.id }, { status: 202 });
}
