import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import DashboardShell from '@/components/layout/DashboardShell';
import PaymentMethodsClient from '@/components/dashboard/PaymentMethodsClient';
import { resolvePlanAccess } from '@/lib/billing/tiers';
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';

export const dynamic = 'force-dynamic';

export default async function PaymentMethodsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url, tier, subscription_status, subscription_period_end')
    .eq('id', user.id)
    .single();

  const cookieStore = await cookies();
  const activeWorkspaceId = cookieStore.get('invopilot_active_workspace')?.value;
  let activeWorkspace = null;

  if (activeWorkspaceId) {
    const { data: wsData } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', activeWorkspaceId)
      .single();
    if (wsData) activeWorkspace = wsData;
  }

  if (!activeWorkspace) {
    const { data: defaultWs } = await supabase
      .from('workspace_members')
      .select('workspaces(*)')
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (defaultWs?.workspaces) {
      activeWorkspace = Array.isArray(defaultWs.workspaces) ? defaultWs.workspaces[0] : defaultWs.workspaces;
    }
  }

  const access = await getWorkspaceAccess(supabase);
  const businesses = activeWorkspace?.businesses || [];

  return (
    <DashboardShell
      userEmail={user.email}
      userName={profile?.full_name}
      avatarUrl={profile?.avatar_url}
      access={access}
    >
      <PaymentMethodsClient
        businesses={businesses}
        workspaceId={activeWorkspace?.id}
        userId={user.id}
      />
    </DashboardShell>
  );
}
