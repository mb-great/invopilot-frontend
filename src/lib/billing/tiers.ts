export const BILLING_INTERVALS = ['month', 'year'] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const BILLING_TIERS = ['free', 'starter', 'pro', 'business'] as const;
export type BillingTier = (typeof BILLING_TIERS)[number];
export type PaidBillingTier = Exclude<BillingTier, 'free'>;

export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'expired' | 'canceled' | 'cancelled' | 'past_due' | 'halted';
export type SubscriptionSource = 'none' | 'dummy' | 'stripe' /* legacy */ | 'manual' | 'razorpay';

export type BillingProfile = {
  role?: string | null;
  tier?: string | null;
  subscription_status?: string | null;
  subscription_source?: string | null;
  subscription_interval?: string | null;
  subscription_period_start?: string | null;
  subscription_period_end?: string | null;
  total_invoices_generated?: number | null;
  razorpay_sub_id?: string | null;
  cancel_requested_at?: string | null;
  over_limit_since?: string | null;
  notification_preferences?: any;
};

type PlanLimit = number | 'unlimited';

export type PlanDefinition = {
  tier: BillingTier;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  tagline: string;
  cta: string;
  maxInvoices: PlanLimit;
  maxClients: PlanLimit;
  maxBusinesses: PlanLimit;
  maxTeamMembers: PlanLimit;
  maxStorageBytes: number;
  canUseQuotes: boolean;
  canUploadLogo: boolean;
  canExportCsv: boolean;
  canUseUpiQr: boolean;
  canUseRecurring: boolean;
  canSavePaymentMethods: boolean;
  included: string[];
  excluded: string[];
};

export const PLANS: PlanDefinition[] = [
  {
    tier: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    tagline: 'Try the core invoice workflow.',
    cta: 'Current free plan',
    maxInvoices: 5,
    maxClients: 5,
    maxBusinesses: 1,
    maxTeamMembers: 1,
    maxStorageBytes: 50 * 1024 * 1024, // 50 MB
    canUseQuotes: false,
    canUploadLogo: false,
    canExportCsv: false,
    canUseUpiQr: false,
    canUseRecurring: false,
    canSavePaymentMethods: true,
    included: [
      'All 6 generators + 35+ templates',
      'PDF download (no watermark)',
      'Multi-currency + GST support',
      'Save up to 5 invoices',
      'Basic invoice history',
      '5 clients max',
      '50 MB PDF storage',
    ],
    excluded: [
      'Dashboard & charts',
      'Payment links',
      'Reminders',
      'CSV/Excel export',
      'Quote → Invoice',
      'Custom logo',
      'Multi-business',
    ],
  },
  {
    tier: 'starter',
    name: 'Starter',
    monthlyPrice: 4.99,
    yearlyPrice: 47.90,
    tagline: 'For freelancers just getting started.',
    cta: 'Start Starter',
    maxInvoices: 50,
    maxClients: 20,
    maxBusinesses: 1,
    maxTeamMembers: 1,
    maxStorageBytes: 500 * 1024 * 1024, // 500 MB
    canUseQuotes: false,
    canUploadLogo: false,
    canExportCsv: false,
    canUseUpiQr: false,
    canUseRecurring: false,
    canSavePaymentMethods: true,
    included: [
      'Everything in Free',
      'Save up to 50 invoices / billing cycle',
      'Up to 20 clients',
      'Basic dashboard + revenue charts',
      'Client payment health score',
      'Email invoice to client',
      'Invoice status tracking (draft/sent/paid/overdue)',
      '1 business profile with autofill',
      '500 MB PDF storage',
    ],
    excluded: [
      'Payment links (Razorpay)',
      'Auto payment reminders',
      'UPI QR on invoice PDF',
      'CSV/Excel export',
      'Quote → Invoice',
      'Custom logo on PDF',
      'Multi-business',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    monthlyPrice: 9.99,
    yearlyPrice: 95.90,
    tagline: 'Your volume seller. This is where most users should land.',
    cta: 'Start Pro',
    maxInvoices: 'unlimited',
    maxClients: 'unlimited',
    maxBusinesses: 3,
    maxTeamMembers: 1,
    maxStorageBytes: 5 * 1024 * 1024 * 1024, // 5 GB
    canUseQuotes: true,
    canUploadLogo: true,
    canExportCsv: true,
    canUseUpiQr: true,
    canUseRecurring: true,
    canSavePaymentMethods: true,
    included: [
      'Everything in Starter',
      'Unlimited invoices & clients',
      'Full revenue dashboard + charts',
      'Razorpay payment link on invoices',
      'UPI QR code on invoice PDF',
      'Auto payment reminders (email)',
      'Quote → Invoice in 1 click',
      'Client payment portal (public link)',
      'CSV / Excel export',
      'Custom logo + branding on invoice',
      'Multi-business (up to 3)',
      'Send invoice email with payment link',
      '5 GB PDF storage',
    ],
    excluded: [],
  },
  {
    tier: 'business',
    name: 'Business',
    monthlyPrice: 19.99,
    yearlyPrice: 191.90,
    tagline: 'For small agencies and teams.',
    cta: 'Start Business',
    maxInvoices: 'unlimited',
    maxClients: 'unlimited',
    maxBusinesses: 10,
    maxTeamMembers: 5,
    maxStorageBytes: 20 * 1024 * 1024 * 1024, // 20 GB
    canUseQuotes: true,
    canUploadLogo: true,
    canExportCsv: true,
    canUseUpiQr: true,
    canUseRecurring: true,
    canSavePaymentMethods: true,
    included: [
      'Everything in Pro',
      'Up to 5 team members (coming soon)',
      'Multi-business (up to 10)',
      'White-label invoice PDFs',
      'Annual GST export report',
      'API access (coming soon)',
      'Priority support',
      '20 GB PDF storage',
    ],
    excluded: [],
  },
];

export const PLAN_BY_TIER = Object.fromEntries(
  PLANS.map((plan) => [plan.tier, plan])
) as Record<BillingTier, PlanDefinition>;

export function isBillingTier(value: unknown): value is BillingTier {
  return typeof value === 'string' && BILLING_TIERS.includes(value as BillingTier);
}

export function isPaidTier(value: unknown): value is PaidBillingTier {
  return isBillingTier(value) && value !== 'free';
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return typeof value === 'string' && BILLING_INTERVALS.includes(value as BillingInterval);
}

export function isPlanUnlimited(limit: PlanLimit) {
  return limit === 'unlimited';
}

export function formatPlanLimit(limit: PlanLimit) {
  return isPlanUnlimited(limit) ? 'Unlimited' : String(limit);
}

export function resolvePlanAccess(profile?: BillingProfile | null, now = new Date()) {
  const system_role = profile?.role ?? 'user';
  const rawTier = profile?.tier ?? 'free';
  const tier = isBillingTier(rawTier) ? rawTier : 'free';
  const status = (profile?.subscription_status ?? 'none') as SubscriptionStatus;
  const periodEnd = profile?.subscription_period_end ? new Date(profile.subscription_period_end) : null;
  const isAdmin = system_role === 'admin' || system_role === 'superadmin';
  const isSuperAdmin = system_role === 'superadmin';
  const hasActivePaidPeriod =
    tier !== 'free' &&
    (status === 'active' || status === 'trialing') &&
    !!periodEnd &&
    periodEnd.getTime() >= now.getTime();

  const effectiveTier: BillingTier = isAdmin ? 'business' : hasActivePaidPeriod ? tier : 'free';

  return {
    profile,
    tier,
    effectiveTier,
    plan: PLAN_BY_TIER[effectiveTier],
    isAdmin,
    isSuperAdmin,
    isActive: isAdmin || effectiveTier !== 'free',
    isExpired: tier !== 'free' && !hasActivePaidPeriod && !isAdmin,
    periodEnd,
  };
}

export function canCreateInvoice(
  profile: BillingProfile | null, 
  lifetimeGenerated: number, 
  periodGenerated: number | null, 
  reservedPdfCount = 0,
  currentStorageBytes = 0
) {
  const access = resolvePlanAccess(profile);
  const limit = access.plan.maxInvoices;
  const storageLimit = access.plan.maxStorageBytes;
  
  // Guard: Ensure strict separation of lifetime vs period quotas
  let baseCount = 0;
  
  if (access.effectiveTier === 'free') {
    // Free tier strictly consumes the lifetime reserve
    baseCount = Math.max(0, lifetimeGenerated);
  } else {
    // Paid tiers strictly consume the active billing period reserve
    if (periodGenerated === null) {
      console.warn(`[Billing Guard] Paid tier '${access.effectiveTier}' invoked with null periodGenerated. Defaulting to 0 to prevent lifetime leakage.`);
    }
    
    if (periodGenerated !== null && typeof periodGenerated !== 'number') {
      throw new Error(`[Billing Guard] Critical failure: Invalid periodGenerated type for paid tier.`);
    }

    baseCount = Math.max(0, periodGenerated ?? 0);
  }
    
  const used = baseCount + Math.max(0, reservedPdfCount);

  if (access.isAdmin) {
    return { allowed: true, access, remaining: null as number | null, used, storageLimitExceeded: false };
  }

  // Check storage limit
  const storageLimitExceeded = currentStorageBytes >= storageLimit;

  if (isPlanUnlimited(limit)) {
    return {
      allowed: !storageLimitExceeded,
      access,
      remaining: null as number | null,
      used,
      storageLimitExceeded
    };
  }

  const remaining = Math.max(limit - used, 0);
  return {
    allowed: used < limit && !storageLimitExceeded,
    access,
    remaining,
    used,
    storageLimitExceeded
  };
}
