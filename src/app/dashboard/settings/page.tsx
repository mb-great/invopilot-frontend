import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import DashboardShell from '@/components/layout/DashboardShell';
import AvatarUpload from '@/components/dashboard/AvatarUpload';
import PasswordSettings from '@/components/dashboard/PasswordSettings';
import ProfileForm from '@/components/dashboard/ProfileForm';
import DeleteAccountSection from '@/components/dashboard/DeleteAccountSection';
import BusinessProfilesSection from '@/components/dashboard/BusinessProfilesSection';
import NotificationSettingsSection from '@/components/dashboard/NotificationSettingsSection';
import { resolvePlanAccess } from '@/lib/billing/tiers';
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
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

  async function updateProfile(formData: FormData) {
    'use server';
    
    const fullName = formData.get('fullName') as string;
    const companyName = formData.get('companyName') as string;
    const gstin = formData.get('gstin') as string;
    const address = formData.get('address') as string;
    const bankName = formData.get('bankName') as string;
    const accountNo = formData.get('accountNo') as string;
    const ifsc = formData.get('ifsc') as string;
    const purchaseRemindersEnabled = formData.get('purchaseRemindersEnabled') === 'on';
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const defaults = {
      ...profile?.defaults,
      gstin,
      address,
      bankName,
      accountNo,
      ifsc
    };

    const { error } = await supabase
      .from('profiles')
      .update({ 
        full_name: fullName,
        company_name: companyName,
        defaults,
        purchase_reminders_enabled: purchaseRemindersEnabled
      })
      .eq('id', user.id);

    if (error) {
      logger.error('settings', 'update_failed', { user_id: user.id, err: error.message });
      console.error('Update error:', error);
      return;
    }

    logger.info('settings', 'updated', { user_id: user.id });
    revalidatePath('/dashboard/settings');
  }

  return (
    <DashboardShell
      userEmail={user.email}
      userName={profile?.full_name}
      avatarUrl={profile?.avatar_url}
      access={access}
    >
      <div className="max-w-4xl">
        <div className="mb-12">
          <h1 className="text-5xl font-bold tracking-tighter mb-4 text-ink-900" style={{ fontFamily: 'var(--font-display)' }}>
            Profile
          </h1>
          <p className="text-ink-500 text-xl">Manage your details, company defaults, and account security.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <section className="glass-card p-8 bg-white border border-ink-100 shadow-sm">
              <div className="mb-10">
                <AvatarUpload userId={user.id} initialUrl={profile?.avatar_url} userName={profile?.full_name} />
              </div>

              <ProfileForm 
                profile={profile} 
                userEmail={user.email || ''} 
                updateAction={updateProfile} 
              />
            </section>

                  <BusinessProfilesSection
                    profile={profile}
                    userId={user.id}
                    maxBusinesses={access.plan.maxBusinesses}
                    canUploadLogo={access.plan.canUploadLogo}
                    activeWorkspace={activeWorkspace}
                  />
                  <NotificationSettingsSection profile={profile} />

            <DeleteAccountSection />
          </div>

          <div className="space-y-8">
            <PasswordSettings userEmail={user.email || ''} />
            
            <div className="glass-card p-6 bg-ink-900 text-white border-none shadow-xl">
              <h4 className="font-bold mb-4 italic font-serif text-brand-400">Quick Setup</h4>
              <p className="text-xs text-ink-300 leading-relaxed">
                Your company defaults will be automatically filled in every new invoice you create. Keep these updated for faster billing.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
