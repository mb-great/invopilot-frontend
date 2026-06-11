import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import { resolvePlanAccess } from '@/lib/billing/tiers';
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';
import { getActiveWorkspaceId } from '@/lib/workspace';
import RecurringClient from './RecurringClient';
import { getRecurringTemplates } from './actions';
import Link from 'next/link';
import LockedFeatureOverlay from '@/components/ui/LockedFeatureOverlay';

export const dynamic = 'force-dynamic';

export default async function RecurringTemplatesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url, tier, subscription_status, subscription_period_end')
    .eq('id', user.id)
    .single();

  const activeWorkspaceId = await getActiveWorkspaceId(user.id);

  // Fetch active workspace owner profile for inherited access
  let ownerProfile: any = profile;
  if (activeWorkspaceId) {
    const { data: wsData } = await supabase.from('workspaces').select('owner_id').eq('id', activeWorkspaceId).single();
    if (wsData && wsData.owner_id !== user.id) {
      const { data: ownerData } = await supabase
        .from('profiles')
        .select('role, tier, subscription_status, subscription_period_end')
        .eq('id', wsData.owner_id)
        .single();
      if (ownerData) {
        ownerProfile = ownerData;
      }
    }
  }

  // Fetch existing invoices to use as templates
  const { data: invoicesData } = await supabase
    .from('invoices')
    .select('id, nickname, form_data, created_at, invoice_number')
    .eq('workspace_id', activeWorkspaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const access = await getWorkspaceAccess(supabase);

  const templates = await getRecurringTemplates();

  const invoices = invoicesData?.map(inv => ({
    id: inv.id,
    nickname: inv.nickname || `Invoice #${inv.invoice_number || 'Unknown'}`,
    form_data: inv.form_data,
    created_at: inv.created_at
  })) || [];

  return (
    <DashboardShell
      userEmail={user.email}
      userName={profile?.full_name}
      avatarUrl={profile?.avatar_url}
      access={access}
    >
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">Recurring Templates</h1>
          <p className="text-ink-500 mt-1">Manage your automated invoice templates.</p>
        </div>
      </div>

      <div className="relative flex-1 min-h-[400px]">
        {!access.plan.canUseRecurring && !access.isAdmin && (
          <LockedFeatureOverlay featureName="Recurring Templates" />
        )}
        <div className={!access.plan.canUseRecurring && !access.isAdmin ? 'opacity-30 pointer-events-none' : ''}>
          <RecurringClient 
            initialTemplates={templates || []} 
            invoices={invoices} 
            maxAllowed={access.effectiveTier === 'pro' ? 20 : Infinity} 
          />
        </div>
      </div>
    </DashboardShell>
  );
}
