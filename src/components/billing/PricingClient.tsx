'use client';

import type React from 'react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  BillingInterval,
  BillingProfile,
  BillingTier,
  PaidBillingTier,
  PLAN_BY_TIER,
  PLANS,
  formatPlanLimit,
  resolvePlanAccess,
} from '@/lib/billing/tiers';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

type Props = {
  profile: BillingProfile | null;
};



export default function PricingClient({ profile }: Props) {
  const router = useRouter();
  const access = useMemo(() => resolvePlanAccess(profile), [profile]);
  const [interval, setInterval] = useState<BillingInterval>('month');
  const [loadingTier, setLoadingTier] = useState<PaidBillingTier | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<PaidBillingTier | null>(null);

  const handleCancelSubscription = async () => {
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to cancel');
      setShowCancelModal(false);
      toast.success(data.message || 'Subscription cancelled');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const checkout = async (tier: PaidBillingTier) => {
    const isActive = access.effectiveTier !== 'free' && !access.isAdmin && !access.isExpired;

    if (isActive) {
      // Show confirmation for any plan change (upgrade, downgrade, interval switch)
      setUpgradeTarget(tier);
      return;
    }
    setLoadingTier(tier);
    await executeCheckout(tier);
  };

  // Determine change type for the confirmation modal
  const getChangeType = (target: PaidBillingTier): 'upgrade' | 'downgrade' | 'switch-interval' => {
    const tierOrder = { starter: 1, pro: 2, business: 3 };
    const currentRank = tierOrder[access.effectiveTier as keyof typeof tierOrder] || 0;
    const targetRank = tierOrder[target] || 0;
    if (targetRank > currentRank) return 'upgrade';
    if (targetRank < currentRank) return 'downgrade';
    return 'switch-interval'; // same tier, different interval
  };

  const executeCheckout = async (tier: PaidBillingTier) => {
    setLoadingTier(tier);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval }),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(result.error || 'Checkout failed');
      }

      if (result.subscription_id) {
        const loadRazorpay = () => new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });

        const isLoaded = await loadRazorpay();
        if (!isLoaded) throw new Error("Failed to load Razorpay SDK. Check your connection.");

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          subscription_id: result.subscription_id,
          name: "InvoPilot",
          description: `${tier.toUpperCase()} Plan`,
          theme: { color: "#E5853D" },
          handler: function (response: any) {
            setTimeout(() => {
              router.refresh();
              setLoadingTier(null);
            }, 3000);
          },
          modal: {
            ondismiss: function() {
              setLoadingTier(null);
            }
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function (response: any) {
          toast.error(`Payment Failed: ${response.error.description}`);
        });
        rzp.open();
      } else if (result.success) {
        toast.success(result.message || 'Plan upgraded successfully!');
        router.refresh();
        setLoadingTier(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Checkout failed');
      setLoadingTier(null);
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmationModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelSubscription}
        title="Cancel Subscription"
        message="Are you sure you want to cancel your subscription? If you cancel now, you will retain access to your current plan until the end of your billing cycle. It will not auto-renew."
        confirmLabel="Confirm Cancellation"
        isDestructive={true}
        requirePassword={false}
      />

      {/* Plan Change Confirmation Modal */}
      {upgradeTarget && (() => {
        const currentPlan = PLAN_BY_TIER[access.effectiveTier];
        const newPlan = PLAN_BY_TIER[upgradeTarget];
        const newPrice = interval === 'month' ? newPlan.monthlyPrice : newPlan.yearlyPrice;
        const changeType = getChangeType(upgradeTarget);
        const isIntervalSwitch = changeType === 'switch-interval';

        const title = changeType === 'upgrade' ? 'Upgrade Plan'
          : changeType === 'downgrade' ? 'Downgrade Plan'
          : 'Switch Billing Cycle';

        const buttonLabel = changeType === 'upgrade' ? 'Confirm Upgrade'
          : changeType === 'downgrade' ? 'Confirm Downgrade'
          : `Switch to ${interval === 'year' ? 'Yearly' : 'Monthly'}`;

        const description = changeType === 'upgrade'
          ? `Razorpay will charge a prorated amount for the remaining billing period. You\u2019ll see the exact amount on the payment page.`
          : changeType === 'downgrade'
          ? `Your plan will change to ${newPlan.name} at the end of your current billing period. No immediate charge.`
          : `Your billing will switch to ${interval === 'year' ? 'yearly' : 'monthly'} billing at ${newPlan.name} pricing. The change takes effect at your next renewal.`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4">
              <h3 className="text-xl font-bold text-ink-900">{title}</h3>
              <div className="rounded-xl border border-ink-200 p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">Current plan</span>
                  <span className="font-bold text-ink-700">{currentPlan.name}</span>
                </div>
                <div className="border-t border-ink-100" />
                <div className="flex justify-between text-sm">
                  <span className="text-ink-500">{isIntervalSwitch ? 'Same plan' : changeType === 'upgrade' ? 'Upgrading to' : 'Downgrading to'}</span>
                  <span className="font-bold text-brand-600">{newPlan.name}</span>
                </div>
                {!isIntervalSwitch && (
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-500">{changeType === 'upgrade' ? 'New price' : 'Price after downgrade'}</span>
                    <span className="font-bold text-ink-900">${newPrice.toFixed(newPrice % 1 !== 0 ? 2 : 0)}/{interval === 'month' ? 'mo' : 'yr'}</span>
                  </div>
                )}
                {isIntervalSwitch && (
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-500">New price</span>
                    <span className="font-bold text-ink-900">${newPrice.toFixed(newPrice % 1 !== 0 ? 2 : 0)}/{interval === 'month' ? 'mo' : 'yr'}</span>
                  </div>
                )}
                <div className="border-t border-ink-100" />
                <p className="text-xs text-ink-400">{description}</p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setUpgradeTarget(null)}
                  className="flex-1 rounded-xl border border-ink-200 px-4 py-3 text-sm font-bold text-ink-600 hover:bg-ink-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const target = upgradeTarget;
                    setUpgradeTarget(null);
                    await executeCheckout(target);
                  }}
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold text-white transition-colors shadow-lg ${
                    changeType === 'downgrade'
                      ? 'bg-ink-900 hover:bg-ink-800 shadow-ink-900/25'
                      : 'bg-brand-500 hover:bg-brand-600 shadow-brand-500/25'
                  }`}
                >
                  {buttonLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">Billing</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
            Choose your <span className="font-serif italic font-normal headline-accent">tier</span>
          </h1>
          <p className="mt-3 max-w-2xl text-base text-ink-500">
            Select a plan to start generating your invoices. Secure payment provided by Razorpay.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-ink-200 bg-white p-1 shadow-sm">
          {(['month', 'year'] as BillingInterval[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setInterval(value)}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                interval === value
                  ? 'bg-ink-900 text-white'
                  : 'text-ink-500 hover:bg-ink-50 hover:text-ink-900'
              }`}
            >
              {value === 'month' ? 'Monthly' : (
                <span className="relative inline-flex items-center">
                  Yearly
                  <span className={`absolute -right-5 -top-3.5 rounded px-1 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-sm ${interval === value ? 'bg-brand-500 text-white' : 'bg-brand-100 text-brand-700'}`}>
                    -20%
                  </span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
        <div>
          Current access: {access.isSuperAdmin ? 'Superadmin bypass' : access.isAdmin ? 'Admin bypass' : PLAN_BY_TIER[access.effectiveTier].name}
          {access.periodEnd && !access.isAdmin ? (
            profile?.cancel_requested_at && !access.isExpired 
              ? ` (Cancelled, access remains until ${access.periodEnd.toLocaleDateString()})` 
              : ` until ${access.periodEnd.toLocaleDateString()}`
          ) : ''}
          {access.isExpired ? ' (expired; using Free limits)' : ''}
        </div>
        
        <div className="flex items-center gap-2">

          {access.effectiveTier !== 'free' && !access.isAdmin && !access.isExpired && !profile?.cancel_requested_at && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors whitespace-nowrap"
            >
              Cancel Subscription
            </button>
          )}
        </div>
      </div>

      {/* BETA: pricing hidden — all features free until September 2026 */}
      {/* Uncomment plan cards below after beta ends */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-8 py-12 text-center">
        <div className="mb-4 rounded-full bg-green-100 p-3">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-black text-ink-900">You have free access to InvoPilot Beta</h2>
        <p className="mt-2 max-w-md text-sm text-ink-500">
          All features are unlocked until September 2026. No limits on invoices, clients, quotes, recurring templates, or team members.
        </p>
        <div className="mt-6 rounded-lg bg-white border border-ink-100 px-6 py-4 text-sm text-ink-700">
          <p className="font-bold text-ink-900">As part of the beta program:</p>
          <p className="mt-1">You agreed to submit one honest public review on G2 within 10 days of approval.</p>
          <a href="https://www.g2.com/products/invopilot/reviews/new" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-bold text-brand-600 hover:text-brand-700">
            Submit your G2 review →
          </a>
        </div>
      </div>

      {/* <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = access.effectiveTier === plan.tier && !access.isAdmin;
          const isFeatured = plan.tier === 'pro';
          const price = interval === 'month' ? plan.monthlyPrice : plan.yearlyPrice;

          return (
            <section
              key={plan.tier}
              className={`flex h-full flex-col rounded-xl border bg-white p-4 shadow-sm ${
                isFeatured ? 'border-brand-500 ring-2 ring-brand-100' : 'border-ink-200'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black uppercase tracking-tight text-ink-900">{plan.name}</h2>
                  {isFeatured && (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[9px] font-black uppercase text-brand-700">
                      Volume seller
                    </span>
                  )}
                </div>
                <p className="min-h-8 text-xs text-ink-500">{plan.tagline}</p>
                <div>
                  <div className="flex items-baseline gap-2">
                    {interval === 'year' && plan.monthlyPrice > 0 && (
                      <span className="text-lg font-bold text-ink-300 line-through decoration-red-500/40">
                        ${(plan.monthlyPrice * 12).toFixed(2)}
                      </span>
                    )}
                    <span className="text-3xl font-black text-ink-900">${price.toFixed(price % 1 !== 0 ? 2 : 0)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-bold text-ink-400">/{interval === 'month' ? 'mo' : 'yr'}</span>
                    {interval === 'year' && plan.monthlyPrice > 0 && (
                      <span className="inline-flex items-center rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-700 ring-1 ring-inset ring-green-600/20">
                        Save 20%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={plan.tier === 'free' || isCurrent || !!loadingTier}
                onClick={() => checkout(plan.tier as PaidBillingTier)}
                className={`mt-4 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-black transition-colors ${
                  plan.tier === 'free' || isCurrent
                    ? 'cursor-default border border-ink-200 bg-ink-50 text-ink-400'
                    : isFeatured
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20 hover:bg-brand-600'
                      : 'bg-ink-900 text-white hover:bg-ink-800'
                }`}
              >
                {loadingTier === plan.tier && <Loader2 className="h-4 w-4 animate-spin" />}
                {isCurrent ? 'Current plan' : plan.tier === 'free' ? 'Free default' : plan.cta}
              </button>

              <div className="mt-4 grid grid-cols-3 gap-1 border-y border-ink-100 py-3 text-[10px] font-bold text-ink-500">
                <div>
                  <span className="block text-ink-400">Invoices</span>
                  {formatPlanLimit(plan.maxInvoices)}
                </div>
                <div>
                  <span className="block text-ink-400">Clients</span>
                  {formatPlanLimit(plan.maxClients)}
                </div>
                <div>
                  <span className="block text-ink-400">Storage</span>
                  {plan.maxStorageBytes >= 1024 * 1024 * 1024 ? `${plan.maxStorageBytes / (1024 * 1024 * 1024)} GB` : `${plan.maxStorageBytes / (1024 * 1024)} MB`}
                </div>
              </div>

              <div className="mt-4 flex-1 space-y-1.5">
                {plan.included.map((feature) => (
                  <div key={feature} className="flex gap-2 text-xs text-ink-700">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                    <span className="leading-snug">{feature}</span>
                  </div>
                ))}
                {plan.excluded.map((feature) => (
                  <div key={feature} className="flex gap-2 text-xs text-ink-400">
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                    <span className="leading-snug">{feature}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div> */}

    </div>
  );
}
