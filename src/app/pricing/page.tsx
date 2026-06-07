import DashboardShell from '@/components/layout/DashboardShell';
import PricingClient from '@/components/billing/PricingClient';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url, tier, subscription_status, subscription_source, subscription_interval, subscription_period_end')
    .eq('id', user.id)
    .single();

  return (
    <DashboardShell
      userEmail={user.email}
      userName={profile?.full_name}
      avatarUrl={profile?.avatar_url}
      isAdmin={profile?.role === 'admin' || profile?.role === 'superadmin'}
      tier={profile?.tier}
      subscriptionStatus={profile?.subscription_status}
      subscriptionPeriodEnd={profile?.subscription_period_end}
    >
      <PricingClient profile={profile} />
    </DashboardShell>
  );
}
