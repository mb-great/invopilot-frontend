import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireBillingProfile } from '@/lib/auth/guards';
import Razorpay from 'razorpay';

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireBillingProfile(supabase);
  
  if (!auth.user || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Allow through if: active/trialing (normal cancel), OR cancelled-externally (Razorpay-side cancel but DB not yet synced)
  const isEligible =
    auth.profile.subscription_status === 'active' ||
    auth.profile.subscription_status === 'trialing' ||
    (auth.profile.subscription_status === 'cancelled' && !auth.profile.cancel_requested_at);

  if (!isEligible) {
    return NextResponse.json({ error: 'No active subscription to cancel' }, { status: 400 });
  }

  const subId = auth.profile.razorpay_sub_id;
  if (!subId) {
    return NextResponse.json({ error: 'Subscription ID not found' }, { status: 400 });
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: 'Payment gateway not configured.' }, { status: 500 });
  }

  const rzp = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  try {
    // true = cancel at cycle end. Important for refund avoidance.
    await rzp.subscriptions.cancel(subId, true);
    
    // Set our new field
    await supabase.from('profiles')
      .update({ cancel_requested_at: new Date().toISOString() })
      .eq('id', auth.user.id);

    return NextResponse.json({ success: true, message: 'Subscription will cancel at the end of the billing period.' });
  } catch (error: unknown) {
    console.error('[Cancel Error]', error);
    
    // If Razorpay returns a 400 indicating it is already cancelled
    if ((error as any).statusCode === 400 && ((error as any).error?.description?.includes('already cancelled') || (error as any).error?.description?.includes('already canceled') || (error as any).error?.description?.includes('cancelled'))) {
      await supabase.from('profiles')
        .update({ subscription_status: 'cancelled', cancel_requested_at: new Date().toISOString() })
        .eq('id', auth.user.id);
      return NextResponse.json({ success: true, message: 'Subscription successfully synced as cancelled.' });
    }

    return NextResponse.json(
      { error: (error as any).error?.description || (error instanceof Error ? error.message : '') || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
