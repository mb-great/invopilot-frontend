import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardShell from '@/components/layout/DashboardShell'
import InvoiceTable from '@/components/dashboard/InvoiceTable'
import EmptyState from '@/components/dashboard/EmptyState'
import { resolvePlanAccess } from '@/lib/billing/tiers';
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';
import { getActiveWorkspaceId } from '@/lib/workspace'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url, total_invoices_generated, tier, subscription_status, subscription_period_end')
    .eq('id', user.id)
    .single()

  const activeWorkspaceId = await getActiveWorkspaceId(user.id);

  // Fetch active workspace owner profile for inherited access
  let ownerProfile: any = profile;
  if (activeWorkspaceId) {
    const { data: wsData } = await supabase.from('workspaces').select('owner_id').eq('id', activeWorkspaceId).single();
    if (wsData && wsData.owner_id !== user.id) {
      const { data: ownerData } = await supabase
        .from('profiles')
        .select('role, tier, subscription_status, subscription_period_end, total_invoices_generated')
        .eq('id', wsData.owner_id)
        .single();
      if (ownerData) {
        ownerProfile = ownerData;
      }
    }
  }

  // Get actual count of non-deleted invoices (NOT lifetime counter which includes deleted)
  const { count: actualInvoiceCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', activeWorkspaceId)
    .in('payment_status', ['draft', 'unpaid', 'paid', 'overdue'])
    .is('deleted_at', null)

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, profiles(full_name, avatar_url, email)')
    .eq('workspace_id', activeWorkspaceId)
    .in('payment_status', ['draft', 'unpaid', 'paid', 'overdue'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(0, 9)

  // Use RPC to get all currencies used in this workspace instead of user_currency_metrics
  const { data: statsData } = await supabase.rpc('get_workspace_dashboard_stats', { workspace_id_param: activeWorkspaceId });
  const stats = statsData || { top_currencies: [], other_currencies: [] };
  const availableCurrencies = [
    ...stats.top_currencies.map((c: any) => c.currency),
    ...stats.other_currencies.map((c: any) => c.currency)
  ]
  const access = await getWorkspaceAccess(supabase);
  
  const totalCount = actualInvoiceCount ?? 0;
  const initialMeta = {
    total: totalCount,
    page: 1,
    limit: 10,
    totalPages: Math.ceil(totalCount / 10)
  };

  return (
    <DashboardShell
      userEmail={user.email}
      userName={profile?.full_name}
      avatarUrl={profile?.avatar_url}
      access={access}
    >
      <div className="flex flex-col h-full space-y-6 md:space-y-8 min-h-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 gap-4 md:gap-0 px-1">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink-900">Invoices</h1>
            <p className="text-ink-500 mt-1">Manage and track all your generated invoices.</p>
          </div>
          <Link 
            href="/invoices/new"
            className="bg-brand-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            New Invoice
          </Link>
        </div>

        <div className="glass-card flex-1 flex flex-col overflow-hidden min-h-0 mb-4">
          <div className="flex-1 overflow-auto p-2">
            {invoices && invoices.length > 0 ? (
              <InvoiceTable 
                invoices={invoices} 
                initialMeta={initialMeta}
                availableCurrencies={availableCurrencies} 
                showPaymentToggle={true} 
                showHeader={false}
                canUseQuotes={access.plan.canUseQuotes}
                canExportCsv={access.plan.canExportCsv || access.isAdmin}
                baseStatus="draft,unpaid,paid,overdue"
                activeWorkspaceId={activeWorkspaceId}
              />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
