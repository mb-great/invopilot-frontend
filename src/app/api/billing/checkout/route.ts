import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isBillingInterval, isPaidTier, resolvePlanAccess } from '@/lib/billing/tiers';
import { requireBillingProfile } from '@/lib/auth/guards';
import Razorpay from 'razorpay';

export async function POST(request: Request) {
  try {
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

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: 'Payment gateway not configured.' }, { status: 500 });
    }

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

    const isActive = auth.profile.subscription_status === 'active' || auth.profile.subscription_status === 'trialing';
    const isCancelled = !!auth.profile.cancel_requested_at || auth.profile.subscription_status === 'cancelled';

    if ((access.effectiveTier !== 'free' || isActive) && auth.profile.razorpay_sub_id && !isCancelled) {
      let isImmediate = true;
      try {
        await rzp.subscriptions.update(auth.profile.razorpay_sub_id, {
          plan_id: planId,
          schedule_change_at: 'now',
        });
      } catch (updateErr: unknown) {
        const desc = (updateErr as any)?.error?.description || '';
        if (desc.includes('domestic card') || desc.includes('upi') || desc.includes('payment mode is')) {
          return NextResponse.json({
            success: false,
            error: 'RBI regulations for your payment method prevent automatic upgrades. Please cancel your current subscription first, then purchase the new plan.',
          }, { status: 400 });
        }

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

    const subscriptionOptions = {
      plan_id: planId,
      total_count: interval === 'year' ? 100 : 1200,
      customer_notify: 1 as 1,
      notes: {
        user_id: auth.user.id,
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
    console.error('[Checkout Error]:', error);
    return NextResponse.json(
      { error: (error as any)?.error?.description || (error instanceof Error ? error.message : 'Payment gateway error') },
      { status: 500 }
    );
  }
}
