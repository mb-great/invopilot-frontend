import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/layout/DashboardShell'
export const dynamic = 'force-dynamic';
import Link from 'next/link'
import InvoiceTable from '@/components/dashboard/InvoiceTable'
import EmptyState from '@/components/dashboard/EmptyState'
import StatCards from '@/components/dashboard/StatCards'
import RightSidebar from '@/components/dashboard/RightSidebar'
import BusinessProfileDropdown from '@/components/dashboard/BusinessProfileDropdown'
import { cookies } from 'next/headers'
import RevenueChart from '@/components/dashboard/RevenueChart'
import StatusDonut from '@/components/dashboard/StatusDonut'
import HelpPopover from '@/components/ui/HelpPopover'
import { resolvePlanAccess } from '@/lib/billing/tiers';
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';
import { Lock, Sparkles } from 'lucide-react'
import ReviewReminderBanner from '@/components/dashboard/ReviewReminderBanner'
import { BetaOnboardingCard } from '@/components/dashboard/BetaOnboardingCard'
import { getBackendUrl } from '@/lib/url';
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Await searchParams since Next.js 15
  const searchParamsAwaited = await searchParams
  const businessFilter = typeof searchParamsAwaited?.business === 'string' ? searchParamsAwaited.business : null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url, tier, subscription_status, subscription_period_end, cancel_requested_at, defaults, subscription_source, review_status, review_deadline, review_submitted_at')
    .eq('id', user.id)
    .single()

  let currentDefaults = profile?.defaults || {};

  // Process deferred claim token if it exists (for new users who just finished onboarding)
  if (currentDefaults.pending_claim_token) {
    try {
      const backendUrl = getBackendUrl();
      const claimRes = await fetch(`${backendUrl}/api/funnel/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Worker-Secret': process.env.WORKER_SECRET || '',
        },
        body: JSON.stringify({ token: currentDefaults.pending_claim_token, userId: user.id }),
      });

      const claimData = await claimRes.json();
      if (claimRes.ok && !claimData.deferred && claimData.invoiceId) {
        // Successfully claimed! Remove token and set pending_send_invoice_id
        currentDefaults = {
          ...currentDefaults,
          pending_claim_token: null,
          pending_send_invoice_id: claimData.invoiceId,
          beta_onboarding_completed: false,
        };
        await supabase
          .from('profiles')
          .update({ defaults: currentDefaults })
          .eq('id', user.id);
      }
    } catch (err) {
      console.error('Failed to process deferred claim:', err);
    }
  }

  // Await cookies since Next.js 15
  const cookieStore = await cookies();
  const activeWorkspaceCookie = cookieStore.get('invopilot_active_workspace')?.value;

  // Fetch all workspaces user is a member of (accepted and pending)
  const { data: allMemberships } = await supabase
    .from('workspace_members')
    .select('id, role, status, workspaces(id, name, owner_id, businesses)')
    .eq('user_id', user.id);

  const memberships = allMemberships?.filter(m => m.status === 'accepted') || [];
  const pendingInvites = allMemberships?.filter(m => m.status === 'pending') || [];

  const workspacesData = memberships
    .map((m: any) => m.workspaces)
    .filter(Boolean);

  // Fetch profiles for the owners to correctly format workspace names
  const ownerIds = [...new Set(workspacesData.map((w: any) => w.owner_id))];
  const { data: ownersProfiles } = await supabase
    .from('profiles')
    .select('id, full_name, company_name')
    .in('id', ownerIds);

  const workspaces = workspacesData.map((ws: any) => {
    const ownerProfile = ownersProfiles?.find((p: any) => p.id === ws.owner_id);
    let displayName = ws.name;
    
    if (ws.owner_id === user.id) {
      // It's the user's own workspace
      displayName = 'Personal Workspace';
    } else if (ownerProfile) {
      // It's an invited workspace
      displayName = ownerProfile.company_name || (ownerProfile.full_name ? `${ownerProfile.full_name}'s Workspace` : ws.name);
    }
    
    return { ...ws, displayName };
  });

  // Get active workspace and its owner
  const activeWorkspaceId = cookieStore.get('invopilot_active_workspace')?.value;
  let activeWorkspace = workspaces.find((w: any) => w.id === activeWorkspaceId);
  
  if (!activeWorkspace && workspaces.length > 0) {
    activeWorkspace = workspaces.find((w: any) => w.owner_id === user.id) || workspaces[0];
  }

  let ownerProfile: any = profile;
  if (activeWorkspace && activeWorkspace.owner_id !== user.id) {
    const { data } = await supabase
      .from('profiles')
      .select('role, tier, subscription_status, subscription_period_end')
      .eq('id', activeWorkspace.owner_id)
      .single();
    if (data) {
      ownerProfile = { ...profile, ...data };
    }
  }

  const access = await getWorkspaceAccess(supabase);

  const businesses = (activeWorkspace?.businesses || []).filter((b: any) => !b.deletedAt);
  const isMultiBusinessLocked = !access.plan.canUseQuotes && !access.isAdmin; // using Quotes access as proxy for Pro tier

  // Fetch recent invoices AND quotes
  let query = supabase
    .from('invoices')
    .select('id, amount, currency, payment_status, created_at, nickname, invoice_number, share_slug, status, pdf_url, type, form_data->>dueDate')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (activeWorkspace) {
    query = query.eq('workspace_id', activeWorkspace.id);
  } else {
    query = query.eq('user_id', user.id);
  }

  if (businessFilter && !isMultiBusinessLocked) {
    query = query.eq('business_profile_name', businessFilter)
  }

  const { data: recentInvoicesData } = await query
  const recentInvoices = (recentInvoicesData || []) as any[]

  // Calculate global storage used via RPC (Safe for 250MB heap)
  let currentStorageBytes = 0;
  if (activeWorkspace) {
    const { data } = await supabase.rpc('get_workspace_storage_used', { target_workspace_id: activeWorkspace.id });
    currentStorageBytes = Number(data || 0);
  } else {
    const { data } = await supabase.rpc('get_user_storage_used', { target_user_id: user.id });
    currentStorageBytes = Number(data || 0);
  }

  // Fetch metrics data via RPC (aggregated in Postgres to protect Node Heap)
  let stats;
  if (activeWorkspace) {
    const { data: statsData } = await supabase.rpc('get_workspace_dashboard_stats', { workspace_id_param: activeWorkspace.id })
    stats = statsData || { top_currencies: [], other_currencies: [], total_invoice_count: 0 }
  } else {
    const { data: statsData } = await supabase.rpc('get_dashboard_stats', { user_id_param: user.id })
    stats = statsData || { top_currencies: [], other_currencies: [], total_invoice_count: 0 }
  }

  const availableCurrencies = [
    ...stats.top_currencies.map((c: any) => c.currency),
    ...stats.other_currencies.map((c: any) => c.currency)
  ]

  const initialMeta = {
    total: stats.total_invoice_count,
    page: 1,
    limit: 10,
    totalPages: Math.ceil(stats.total_invoice_count / 10)
  };

  return (
    <DashboardShell
      userEmail={user.email}
      userName={profile?.full_name}
      avatarUrl={profile?.avatar_url}
      access={access}
    >
      <div className="flex flex-col space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 gap-4 md:gap-0">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-ink-900 flex items-center gap-3">
              Your <span className="headline-accent italic font-serif font-normal">dashboard</span>
              <HelpPopover 
                title="Dashboard Overview"
                content="This dashboard shows your revenue metrics across all invoices. You can filter the data by selecting a specific business profile from the dropdown on the right."
              />
              {access.effectiveTier === 'free' && (
                <div className="relative group inline-block">
                  <span className="cursor-help text-brand-500 hover:text-brand-600 transition-colors flex items-center gap-1.5 text-sm font-semibold bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-100">
                    <Lock className="w-3.5 h-3.5" />
                    Unlock Charts
                  </span>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block w-72 p-3 bg-white rounded-xl shadow-2xl border border-ink-150 z-50 text-xs text-ink-600 animate-in fade-in zoom-in-95 duration-200">
                    <div className="font-bold text-ink-900 mb-1 flex items-center gap-1.5 normal-case">
                      <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                      Revenue Analytics
                    </div>
                    <p className="mb-2.5 text-ink-500 font-normal normal-case">Upgrade to Starter or Pro to view dynamic revenue charts.</p>
                    <img 
                      src="/chart-preview.jpeg" 
                      alt="Chart Preview" 
                      className="w-full h-auto rounded-lg border border-ink-100 object-cover shadow-sm"
                    />
                    <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-ink-150 transform rotate-45"></div>
                  </div>
                </div>
              )}
            </h1>
            <p className="text-ink-500 mt-2 text-lg">Snapshot of your invoicing — outstanding, paid, and what&apos;s due next.</p>
          </div>
          <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <BusinessProfileDropdown 
              businesses={businesses} 
              isLocked={isMultiBusinessLocked} 
              profile={profile}
              userId={user.id}
              maxBusinesses={access.plan.maxBusinesses}
              canUploadLogo={access.plan.canUploadLogo || access.isAdmin}
              activeWorkspace={activeWorkspace}
            />
            <Link href="/invoices/new" className="btn-brand shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 px-6 py-2.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              New invoice
            </Link>
          </div>
        </div>

        {/* Beta Review Reminder */}
        {profile?.subscription_source === 'manual' && (
          <ReviewReminderBanner
            reviewStatus={profile.review_status}
            reviewDeadline={profile.review_deadline}
            reviewSubmittedAt={profile.review_submitted_at}
            userId={user.id}
          />
        )}

        {/* Beta Funnel v2 Onboarding Card */}
        <BetaOnboardingCard 
          claimToken={typeof searchParamsAwaited?.claim === 'string' ? searchParamsAwaited.claim : null}
          pendingInvoiceId={currentDefaults?.pending_send_invoice_id}
        />

        {/* Metric Cards */}
        <div className="shrink-0">
          <StatCards 
            topCurrencies={stats.top_currencies} 
            otherCurrencies={stats.other_currencies}
            businessFilter={businessFilter}
            activeWorkspaceId={activeWorkspace?.id}
          />
        </div>

        {/* Charts Section */}
        {access.effectiveTier !== 'free' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
            <div className="lg:col-span-2">
              <RevenueChart activeWorkspaceId={activeWorkspace?.id} targetCurrency={stats.top_currencies?.[0]?.currency || 'USD'} profile={profile} businessFilter={businessFilter} refreshKey={Date.now()} />
            </div>
            <div className="lg:col-span-1">
              <StatusDonut activeWorkspaceId={activeWorkspace?.id} businessFilter={businessFilter} />
            </div>
          </div>
        )}

        {/* Main Content Sections */}
        <div className="grid lg:grid-cols-3 gap-8 pb-4">
          <div className="lg:col-span-2 flex flex-col min-w-0">
            <div id="invoices-table" className="glass-card flex flex-col min-w-0">
              <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between shrink-0">
                <h2 className="font-bold text-ink-800 tracking-tight">Recent Invoices</h2>
                <Link href="/invoices" className="text-sm font-bold text-brand-600 hover:text-brand-700">View all</Link>
              </div>
              <div className="flex-1 overflow-hidden p-2">
                {recentInvoices && recentInvoices.length > 0 ? (
                  <InvoiceTable 
                    invoices={recentInvoices} 
                    initialMeta={initialMeta}
                    showHeader={false} 
                    availableCurrencies={availableCurrencies}
                    canExportCsv={access.plan.canExportCsv || access.isAdmin}
                    activeWorkspaceId={activeWorkspace?.id}
                    businessFilter={businessFilter}
                  />
                ) : (
                  <EmptyState />
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 flex flex-col">
            <RightSidebar 
              profile={ownerProfile} 
              stats={stats} 
              recentInvoices={recentInvoices.slice(0, 5)} 
              currentStorageBytes={currentStorageBytes} 
            />
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
