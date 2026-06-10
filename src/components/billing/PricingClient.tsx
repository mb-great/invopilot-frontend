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

  const handleCancelSubscription = async () => {
    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel');
      setShowCancelModal(false);
      toast.success(data.message || 'Subscription cancelled');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const checkout = async (tier: PaidBillingTier) => {
    setLoadingTier(tier);

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval }),
      });
      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Checkout failed');
      }

      if (result.subscription_id) {
        // Load Razorpay script dynamically
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
          theme: { color: "#E5853D" }, // brand-600
          handler: function (response: any) {
            // On success, wait 3 seconds for webhook to update DB, then refresh page
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
    <div className="space-y-8">
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
              {value === 'month' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
        <div>
          Current access: {access.isAdmin ? 'Admin bypass' : PLAN_BY_TIER[access.effectiveTier].name}
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

      <div className="grid gap-5 xl:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = access.effectiveTier === plan.tier && !access.isAdmin;
          const isFeatured = plan.tier === 'pro';
          const price = interval === 'month' ? plan.monthlyPrice : plan.yearlyPrice;

          return (
            <section
              key={plan.tier}
              className={`flex min-h-[640px] flex-col rounded-xl border bg-white p-5 shadow-sm ${
                isFeatured ? 'border-brand-500 ring-2 ring-brand-100' : 'border-ink-200'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black uppercase tracking-tight text-ink-900">{plan.name}</h2>
                  {isFeatured && (
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-[10px] font-black uppercase text-brand-700">
                      Volume seller
                    </span>
                  )}
                </div>
                <p className="min-h-10 text-sm text-ink-500">{plan.tagline}</p>
                <div>
                  <span className="text-4xl font-black text-ink-900">${price}</span>
                  <span className="ml-1 text-sm font-bold text-ink-400">/{interval === 'month' ? 'mo' : 'yr'}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={plan.tier === 'free' || isCurrent || !!loadingTier}
                onClick={() => checkout(plan.tier as PaidBillingTier)}
                className={`mt-5 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition-colors ${
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

              <div className="mt-5 grid grid-cols-3 gap-2 border-y border-ink-100 py-4 text-xs font-bold text-ink-500">
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

              <div className="mt-5 flex-1 space-y-2">
                {plan.included.map((feature) => (
                  <div key={feature} className="flex gap-2 text-sm text-ink-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span>{feature}</span>
                  </div>
                ))}
                {plan.excluded.map((feature) => (
                  <div key={feature} className="flex gap-2 text-sm text-ink-400">
                    <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

    </div>
  );
}
