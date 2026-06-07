import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  const { action, duration, tier: grantTier } = await request.json();

  const supabase = await createClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify admin status
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', adminUser.id)
    .single();

  if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify target is not superadmin (unless caller is superadmin)
  const { data: targetProfileAuth } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', targetUserId)
    .single();

  if (targetProfileAuth?.role === 'superadmin' && adminProfile?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden — cannot modify superadmin' }, { status: 403 });
  }

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (action === 'grant') {
    const validTiers = ['starter', 'pro', 'business'];
    const selectedTier = validTiers.includes(grantTier) ? grantTier : 'business';

    let periodEnd = new Date();
    if (duration === '1_month') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else if (duration === '1_year') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd = new Date('2099-12-31');
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        tier: selectedTier,
        subscription_status: 'active',
        subscription_period_end: periodEnd.toISOString(),
        subscription_source: 'manual'
      })
      .eq('id', targetUserId);
      
    if (error) return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });

  } else if (action === 'strip') {
    // Soft downgrade — keeps payment history fields intact
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        tier: 'free',
        subscription_status: 'canceled',
        subscription_source: 'manual'
      })
      .eq('id', targetUserId);
      
    if (error) return NextResponse.json({ error: 'Failed to strip subscription' }, { status: 500 });

  } else if (action === 'nuke') {
    // Hard reset — wipes ALL subscription and payment provider fields
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        tier: 'free',
        subscription_status: 'none',
        subscription_source: 'none',
        subscription_interval: null,
        subscription_period_start: null,
        subscription_period_end: null,
        subscription_updated_at: null,
        cancel_at_period_end: false,
        cancel_requested_at: null,
        retry_count: 0,
        last_synced_at: null,
        // Razorpay fields
        razorpay_sub_id: null,
        razorpay_plan_id: null,
        razorpay_customer_id: null,
        razorpay_short_url: null,
        // Stripe fields (kept for future, cleared on nuke)
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_price_id: null,
      })
      .eq('id', targetUserId);

    if (error) return NextResponse.json({ error: 'Failed to nuke subscription' }, { status: 500 });

  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
