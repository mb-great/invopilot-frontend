import DashboardShell from '@/components/layout/DashboardShell';
import PricingClient from '@/components/billing/PricingClient';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';

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

  const access = await getWorkspaceAccess(supabase);

  return (
    <DashboardShell
      userEmail={user.email}
      userName={profile?.full_name}
      avatarUrl={profile?.avatar_url}
      access={access}
    >
      <PricingClient profile={profile} />
    </DashboardShell>
  );
}
