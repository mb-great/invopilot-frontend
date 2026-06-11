import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import { resolvePlanAccess } from '@/lib/billing/tiers';
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import MembersClient from '@/components/dashboard/MembersClient';
import LockedFeatureOverlay from '@/components/ui/LockedFeatureOverlay';

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Determine active workspace from cookie
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const activeWorkspaceId = cookieStore.get('invopilot_active_workspace')?.value;

  let activeWorkspace = null;
  let userWorkspaceRole = 'owner';

  if (activeWorkspaceId) {
    const { data: wsData } = await supabase
      .from('workspaces')
      .select('*, workspace_members!inner(role, status)')
      .eq('id', activeWorkspaceId)
      .eq('workspace_members.user_id', user.id)
      .eq('workspace_members.status', 'accepted')
      .single();
    
    if (wsData) {
      userWorkspaceRole = wsData.workspace_members[0].role;
      activeWorkspace = wsData;
    }
  }

  // Fallback to personal workspace
  if (!activeWorkspace) {
    const { data: defaultWs } = await supabase
      .from('workspaces')
      .select('*, workspace_members!inner(role, status)')
      .eq('workspace_members.user_id', user.id)
      .eq('workspace_members.status', 'accepted')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    
    if (defaultWs) {
      userWorkspaceRole = defaultWs.workspace_members[0].role;
      activeWorkspace = defaultWs;
    }
  }

  if (!activeWorkspace) {
    redirect('/dashboard');
  }

  // Determine Tier of the WORKSPACE OWNER
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('role, tier, subscription_status, subscription_period_end')
    .eq('id', activeWorkspace.owner_id)
    .single();

  const access = await getWorkspaceAccess(supabase);
  const isBusinessOrAdmin = access.effectiveTier === 'business' || access.isAdmin;

  // Fetch all members for this workspace
  const { data: members } = await supabase
    .from('workspace_members')
    .select('id, user_id, invited_email, role, status, created_at, profiles(full_name, avatar_url, email)')
    .eq('workspace_id', activeWorkspace.id);

  // Fetch recent activity (invoices created by members)
  const { data: recentInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, nickname, created_at, amount, currency, profiles(full_name, email, avatar_url)')
    .eq('workspace_id', activeWorkspace.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <DashboardShell
      userEmail={user.email}
      userName={profile?.full_name}
      avatarUrl={profile?.avatar_url}
      access={access}
    >
      <div className="max-w-6xl w-full mx-auto pb-12">
        <div className="mb-12 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 gap-4 md:gap-0">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-ink-900 flex items-center gap-3">
              Team <span className="headline-accent italic font-serif font-normal">members</span>
            </h1>
            <p className="text-ink-500 text-lg mt-2 font-medium">
              Manage who has access to {activeWorkspace.name}
            </p>
          </div>
        </div>

        <MembersClient 
          workspaceId={activeWorkspace.id} 
          workspaceName={activeWorkspace.name}
          userRole={userWorkspaceRole}
          members={(members as any) || []}
          recentInvoices={(recentInvoices as any) || []}
          isBusinessTier={isBusinessOrAdmin}
        />
      </div>
    </DashboardShell>
  );
}
