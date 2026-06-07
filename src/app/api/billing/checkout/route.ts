import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isBillingInterval, isPaidTier, resolvePlanAccess } from '@/lib/billing/tiers';
import { requireBillingProfile } from '@/lib/auth/guards';
import Razorpay from 'razorpay';

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireBillingProfile(supabase);
  if (!auth.user || !auth.profile) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const tier = body.tier;
  const interval = body.interval ?? 'month';

  if (!isPaidTier(tier)) {
    return NextResponse.json({ error: 'Choose Starter, Pro, or Business.' }, { status: 400 });
  }

  if (!isBillingInterval(interval)) {
    return NextResponse.json({ error: 'Invalid billing interval.' }, { status: 400 });
  }

  // Get the Razorpay Plan ID from env based on tier and interval
  // interval is 'month' or 'year', env keys are RAZORPAY_PLAN_STARTER_MONTHLY etc.
  const planKey = `RAZORPAY_PLAN_${tier.toUpperCase()}_${interval.toUpperCase()}LY`;
  const planId = process.env[planKey];

  if (!planId) {
    console.error(`Missing Razorpay Plan ID for env key: ${planKey}`);
    return NextResponse.json({ error: 'Billing plan not configured in environment.' }, { status: 500 });
  }

  const rzp = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });

  const access = resolvePlanAccess(auth.profile);

  try {
    // ── THE SOVEREIGN GUARD: Upgrade vs New Checkout ────────────────────────

    // 1. Upgrade / Downgrade (If user already has an active subscription)
    const isActive = auth.profile.subscription_status === 'active' || auth.profile.subscription_status === 'trialing';
    const isCancelled = !!auth.profile.cancel_requested_at || auth.profile.subscription_status === 'cancelled';
    
    if ((access.effectiveTier !== 'free' || isActive) && auth.profile.razorpay_sub_id && !isCancelled) {
      let isImmediate = true;
      try {
        // Razorpay Native Upgrade API
        // Updating plan_id instantly upgrades them and handles proration automatically.
        await rzp.subscriptions.update(auth.profile.razorpay_sub_id, {
          plan_id: planId,
          schedule_change_at: 'now',
        });
      } catch (updateErr: unknown) {
        const desc = (updateErr as any)?.error?.description || '';
        // If the payment method outright blocks plan ID changes (domestic cards / UPI)
        if (desc.includes('domestic card') || desc.includes('upi') || desc.includes('payment mode is')) {
          return NextResponse.json({
            success: false,
            error: 'RBI regulations for your payment method prevent automatic upgrades. Please cancel your current subscription first, then purchase the new plan.',
          }, { status: 400 });
        }

        // RBI e-mandate rules often prevent immediate ad-hoc billing changes.
        // Fallback to scheduling the change at the end of the current billing cycle.
        try {
          console.warn(`[Razorpay] Immediate upgrade failed for ${auth.profile.razorpay_sub_id}, falling back to cycle_end`, updateErr);
          await rzp.subscriptions.update(auth.profile.razorpay_sub_id, {
            plan_id: planId,
            schedule_change_at: 'cycle_end',
          });
          isImmediate = false;
        } catch (fallbackErr: unknown) {
          const fallbackDesc = (fallbackErr as any)?.error?.description || '';
          if (fallbackDesc.includes('domestic card') || fallbackDesc.includes('upi') || fallbackDesc.includes('payment mode is')) {
            return NextResponse.json({
              success: false,
              error: 'RBI regulations for your payment method prevent automatic plan changes. Please cancel your current subscription first, then purchase the new plan.',
            }, { status: 400 });
          }
          throw fallbackErr;
        }
      }

      return NextResponse.json({
        success: true,
        message: isImmediate 
          ? `Plan successfully upgraded to ${tier}. Your limits have been updated.`
          : `Plan change scheduled. You will be upgraded to ${tier} at the end of your current billing cycle.`,
      });
    }

    // 2. New Subscription Checkout (If user is not active, e.g. cancelled, expired, or never bought)
    // We create a new subscription and return the hosted checkout URL.
    
    // First, ensure they have a Razorpay Customer ID.
    // If we don't have it, Razorpay's subscription creation can create a customer implicitly
    // if we just pass the customer_notify info, but it's cleaner to use notify_info.
    
    // Determine callback URL based on environment
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.FRONTEND_URL || 'http://localhost:3001';

    const subscriptionOptions = {
      plan_id: planId,
      total_count: interval === 'year' ? 100 : 1200, // Yearly max is 100, Monthly max is 1200
      customer_notify: 1 as 1,
      notes: {
        user_id: auth.user.id, // Critical for our webhook processor to identify the user
        email: auth.user.email || '',
      },
      notify_info: {
        notify_email: auth.user.email || '',
      }
    };

    const subscription = await rzp.subscriptions.create(subscriptionOptions);

    if (!subscription.short_url) {
      throw new Error('Razorpay did not return a checkout URL.');
    }

    return NextResponse.json({
      subscription_id: subscription.id,
    });

  } catch (error: unknown) {
    console.error('[Razorpay Checkout Error]:', error);
    return NextResponse.json(
      { error: (error as any).error?.description || (error instanceof Error ? error.message : '') || 'Payment gateway error' },
      { status: 500 }
    );
  }
}
