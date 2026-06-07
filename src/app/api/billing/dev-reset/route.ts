import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireBillingProfile } from '@/lib/auth/guards';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export async function POST() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
  }

  const supabase = await createClient();
  const auth = await requireBillingProfile(supabase);
  
  if (!auth.user || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await adminSupabase.from('profiles')
      .update({ 
        tier: 'free',
        subscription_status: 'none',
        subscription_source: 'none',
        subscription_period_start: null,
        subscription_period_end: null,
        razorpay_sub_id: null,
        cancel_requested_at: null
      })
      .eq('id', auth.user.id);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Tier hard reset to free.' });
  } catch (error: unknown) {
    console.error('[Dev Reset Error]', error);
    return NextResponse.json(
      { error: 'Failed to reset tier: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}
