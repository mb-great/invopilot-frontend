import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/ratelimit';
import { logger } from '@/lib/logger';
import { canCreateInvoice, resolvePlanAccess } from '@/lib/billing/tiers';
import { requireBillingProfile } from '@/lib/auth/guards';

const QUEUE_CAP = 100;
const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireBillingProfile(supabase);
  if (!auth.user || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { user, profile } = auth;

  // 1. Rate limit — 10/min per IP
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  if (process.env.NODE_ENV !== 'development' && !rateLimit(ip, 10, 60_000))
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  // 2. One active job per user
  const { data: active } = await supabase
    .from('invoices').select('id')
    .eq('user_id', user.id)
    .in('status', ['queued', 'processing'])
    .maybeSingle();

  if (active)
    return NextResponse.json({ error: 'Invoice already generating' }, { status: 429 });

  // 3. Tier gate — lifetime PDF cap + queued/processing reserve.
  const { count: reservedPdfCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .in('status', ['queued', 'processing']);

  const lifetimeGenerated = profile.total_invoices_generated ?? 0;
  
  console.log(`[TIER DEBUG] user=${user.id} role=${profile.role} lifetime=${lifetimeGenerated} reserved=${reservedPdfCount} tier=${profile.tier}`);

  // Count invoices in current billing period (for paid tiers)
  const access = resolvePlanAccess(profile);
  let periodGenerated: number | null = null;
  
  if (access.effectiveTier === 'starter' && profile.subscription_period_start && profile.subscription_period_end) {
    const { count: periodCount } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', profile.subscription_period_start)
      .lte('created_at', profile.subscription_period_end);
      
    periodGenerated = periodCount ?? 0;
  }

  const createGate = canCreateInvoice(profile, lifetimeGenerated, periodGenerated, reservedPdfCount ?? 0);
  if (!createGate.allowed) {
    return NextResponse.json(
      {
        error: `${createGate.access.plan.name} ${createGate.access.effectiveTier === 'free' ? 'lifetime' : 'billing cycle'} PDF limit reached. Upgrade to keep generating invoices.`,
        code: 'TIER_LIMIT_REACHED',
        tier: createGate.access.effectiveTier,
        limit: createGate.access.plan.maxInvoices,
        used: createGate.used,
      },
      { status: 402 }
    );
  }

  // 3.4. Quote Feature Gate Check
  const body = await request.json();
  if (body.payment_status === 'quote' && !access.plan.canUseQuotes && !access.isAdmin) {
    return NextResponse.json(
      { error: 'Quotes require Pro or Business subscription.', code: 'PREMIUM_FEATURE_LOCKED' },
      { status: 403 }
    );
  }

  // 3.5. UPI QR Feature Gate Check
  const formData = body.formData || {};
  if (formData.upiId && !access.plan.canUseUpiQr && !access.isAdmin) {
    return NextResponse.json(
      { error: 'UPI QR feature requires Pro or Business subscription.', code: 'PREMIUM_FEATURE_LOCKED' },
      { status: 403 }
    );
  }

  // 4. Queue cap
  const { count } = await supabase
    .from('invoices').select('id', { count: 'exact', head: true })
    .eq('status', 'queued');

  if ((count ?? 0) >= QUEUE_CAP)
    return NextResponse.json({ error: 'Server busy. Try again shortly.' }, { status: 503 });

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
      business_profile_name: formData.yourCompanyName || formData.yourName || '',
      payment_status: body.payment_status === 'quote' ? 'quote' : 'draft',
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

  // 6. Send to isolated backend worker
  try {
    const backendUrl = BACKEND_URL.replace('localhost', '127.0.0.1'); // Fix Node 18+ IPv6 fetch issue
    const res = await fetch(`${backendUrl}/queue`, {
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
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[API] Failed to dispatch job to backend. Status: ${res.status}. Body: ${errText}`);
    } else {
      console.log(`[API] Job successfully dispatched to backend for invoice ${invoice.id}`);
    }
  } catch (err) {
    console.error('[API] Fetch exception when dispatching job to backend:', err);
    // Even if dispatch fails, it's queued in DB. Admin can retry or cron can sweep.
  }

  return NextResponse.json({ invoiceId: invoice.id }, { status: 202 });
}
