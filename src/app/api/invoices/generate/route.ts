import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/ratelimit';
import { logger } from '@/lib/logger';
import { canCreateInvoice, resolvePlanAccess } from '@/lib/billing/tiers';
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';
import { requireBillingProfile } from '@/lib/auth/guards';
import { getActiveWorkspaceId } from '@/lib/workspace';

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



  // 3. Tier gate — lifetime PDF cap + queued/processing reserve.
  const workspaceId = await getActiveWorkspaceId(user.id);
  const { count: reservedPdfCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .in('status', ['queued', 'processing']);

  const access = await getWorkspaceAccess(supabase, workspaceId);
  const ownerProfile = access.profile || profile;
  const lifetimeGenerated = ownerProfile.total_invoices_generated ?? 0;
  
  console.log(`[TIER DEBUG] user=${user.id} role=${ownerProfile.role} lifetime=${lifetimeGenerated} reserved=${reservedPdfCount} tier=${ownerProfile.tier}`);

  let periodGenerated: number | null = null;
  
  if (access.effectiveTier === 'starter' && ownerProfile.subscription_period_start && ownerProfile.subscription_period_end) {
    const { count: periodCount } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('created_at', ownerProfile.subscription_period_start)
      .lte('created_at', ownerProfile.subscription_period_end);
      
    periodGenerated = periodCount ?? 0;
  }

  // Query cumulative storage usage in bytes
  const { data: storageData } = await supabase
    .from('invoices')
    .select('pdf_size')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null);

  const currentStorageBytes = (storageData || []).reduce((sum, inv) => sum + Number(inv.pdf_size || 0), 0);

  const createGate = canCreateInvoice(
    profile, 
    lifetimeGenerated, 
    periodGenerated, 
    reservedPdfCount ?? 0, 
    currentStorageBytes
  );

  if (!createGate.allowed) {
    let errorMsg = `${createGate.access.plan.name} ${createGate.access.effectiveTier === 'free' ? 'lifetime' : 'billing cycle'} PDF limit reached. Upgrade to keep generating invoices.`;
    if (createGate.storageLimitExceeded) {
      errorMsg = `Storage limit reached: You are using ${(currentStorageBytes / (1024 * 1024)).toFixed(1)}MB of your ${(createGate.access.plan.maxStorageBytes / (1024 * 1024)).toFixed(0)}MB limit. Please delete old invoices to free up space.`;
    }
    return NextResponse.json(
      {
        error: errorMsg,
        code: createGate.storageLimitExceeded ? 'STORAGE_LIMIT_REACHED' : 'TIER_LIMIT_REACHED',
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
      workspace_id: workspaceId,
      form_data: formData,
      nickname: body.nickname || null,
      status: 'queued',
      // Phase 12: Extract indexed columns for fast queries
      amount: typeof formData.amount === 'number' ? formData.amount : (parseFloat(formData.amount || body.amount) || 0),
      currency: formData.currency || 'INR',
      client_name: body.clientName || formData.companyName || '',
      client_email: formData.email || formData.companyEmail || '',
      business_profile_name: formData.yourName || formData.yourCompanyName || '',
      type: body.payment_status === 'quote' ? 'quote' : 'invoice',
      payment_status: body.payment_status === 'quote' ? 'draft' : 'unpaid',
      delivery_status: 'unsent',
      pdf_retry_count: 0,
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
    const res = await fetch(`${BACKEND_URL}/queue`, {
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
