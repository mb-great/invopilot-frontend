import type { User } from '@supabase/supabase-js';
import type { BillingProfile } from '@/lib/billing/tiers';

export type BillingGuardProfile = BillingProfile & {
  id: string;
  email: string | null;
  full_name?: string | null;
  total_invoices_generated?: number | null;
  purchase_reminders_enabled?: boolean | null;
  purchase_reminder_unsubscribe_token?: string | null;
};

type ProfileQuery = {
  eq: (column: string, value: string) => ProfileQuery;
  single: () => Promise<{ data: BillingGuardProfile | null; error: { message: string } | null }>;
};

type SupabaseBillingGuardClient = {
  auth: {
    getUser: () => Promise<{ data: { user: User | null } }>;
  };
  from: (table: 'profiles') => {
    select: (columns: string) => ProfileQuery;
  };
};

export async function requireBillingProfile(supabase: unknown) {
  const client = supabase as SupabaseBillingGuardClient;
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    return { user: null, profile: null, error: 'Unauthorized', status: 401 };
  }

  const { data: profile, error } = await client
    .from('profiles')
    .select(`
      id,
      email,
      full_name,
      role,
      tier,
      subscription_status,
      subscription_source,
      subscription_interval,
      subscription_period_start,
      subscription_period_end,
      total_invoices_generated,
      purchase_reminders_enabled,
      purchase_reminder_unsubscribe_token,
      razorpay_sub_id
    `)
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return { user, profile: null, error: error?.message || 'Profile not found', status: 403 };
  }

  return { user, profile, error: null, status: 200 };
}
