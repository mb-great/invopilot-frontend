import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/layout/DashboardShell';
import ApiKeysSection from '@/components/dashboard/ApiKeysSection';
import ApiDocsSection from '@/components/dashboard/ApiDocsSection';
import { resolvePlanAccess } from '@/lib/billing/tiers';
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';
import { getActiveWorkspaceId } from '@/lib/workspace';

export const metadata = {
  title: 'Developer API | InvoPilot',
};

export default async function ApiPage() {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, role, tier, subscription_status, subscription_period_end')
    .eq('id', user.id)
    .single();

  const activeWorkspaceId = await getActiveWorkspaceId(user.id);
  const access = await getWorkspaceAccess(supabase);

  const hasAccess = access.effectiveTier === 'business' || access.isAdmin;

  return (
    <DashboardShell
      userEmail={user.email}
      userName={profile?.full_name}
      avatarUrl={profile?.avatar_url}
      access={access}
    >
      <div className="max-w-4xl mx-auto px-4 py-8 lg:px-8 space-y-8">
        <div>
          <h1 className="text-3xl font-serif italic text-brand-900 mb-2">Developer API</h1>
          <p className="text-ink-500 text-xl">Integrate InvoPilot securely into your own products and workflows.</p>
        </div>

        <ApiKeysSection workspaceId={activeWorkspaceId} hasAccess={hasAccess} />
        <ApiDocsSection />

      </div>
    </DashboardShell>
  );
}
