import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verify caller is authenticated
    const { data: { user: adminUser } } = await supabase.auth.getUser();
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify caller is admin or superadmin
    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single();

    if (callerProfile?.role !== 'superadmin' && callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — Admins only' }, { status: 403 });
    }

    // 3. Parse request body
    const { email, tier = 'pro', duration = '1_month' } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!['free', 'starter', 'pro', 'business'].includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier. Must be: free, starter, pro, or business' }, { status: 400 });
    }

    // 4. Calculate subscription end date
    let periodEnd = new Date();
    if (duration === '1_month') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else if (duration === '1_year') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd = new Date('2099-12-31');
    }

    // 5. Send Auth Invite via Supabase Admin
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (inviteError || !inviteData.user) {
      return NextResponse.json({ error: inviteError?.message || 'Failed to invite user' }, { status: 500 });
    }

    const invitedUser = inviteData.user;

    // 6. Pre-grant the tier on the profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: invitedUser.id,
        email: email.toLowerCase(),
        tier: tier,
        subscription_status: 'active',
        subscription_period_end: periodEnd.toISOString(),
        subscription_source: 'manual'
      }, { onConflict: 'id' });

    if (profileError) {
      return NextResponse.json({ error: 'User invited but profile pre-grant failed' }, { status: 500 });
    }

    // 7. Audit log transaction
    await supabaseAdmin.from('audit_transactions').insert({
      user_id: invitedUser.id,
      action: 'tier_granted',
      tier: tier,
      admin_id: adminUser.id,
      reason: `Admin invited & manual grant via API`,
      valid_until: periodEnd.toISOString()
    });

    return NextResponse.json({
      data: {
        userId: invitedUser.id,
        email: email,
        tier: tier,
        expiresAt: periodEnd.toISOString(),
      },
      status: 'ok'
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal Server Error' }, { status: 500 });
  }
}
