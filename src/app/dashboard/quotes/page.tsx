import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardShell from '@/components/layout/DashboardShell'
import InvoiceTable from '@/components/dashboard/InvoiceTable'
import EmptyState from '@/components/dashboard/EmptyState'
import { resolvePlanAccess } from '@/lib/billing/tiers';
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';
import { getActiveWorkspaceId } from '@/lib/workspace'
import { ArrowRightLeft } from 'lucide-react'

export default async function QuotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url, tier, subscription_status, subscription_period_end')
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
        .select('role, tier, subscription_status, subscription_period_end')
        .eq('id', wsData.owner_id)
        .single();
      if (ownerData) {
        ownerProfile = ownerData;
      }
    }
  }

  // Get actual count of non-deleted quotes
  const { count: actualQuoteCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', activeWorkspaceId)
    .in('payment_status', ['draft', 'converted'])
    .is('deleted_at', null)

  const { data: quotes } = await supabase
    .from('invoices')
    .select('*, profiles(full_name, avatar_url, email)')
    .eq('workspace_id', activeWorkspaceId)
    .in('payment_status', ['draft', 'converted'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(0, 9)

  const { data: statsData } = await supabase.rpc('get_workspace_dashboard_stats', { workspace_id_param: activeWorkspaceId });
  const stats = statsData || { top_currencies: [], other_currencies: [] };
  const availableCurrencies = [
    ...stats.top_currencies.map((c: any) => c.currency),
    ...stats.other_currencies.map((c: any) => c.currency)
  ]
  const access = await getWorkspaceAccess(supabase);
  
  const totalCount = actualQuoteCount ?? 0;
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
            <h1 className="text-3xl font-bold tracking-tight text-ink-900">Quotes</h1>
            <p className="text-ink-500 mt-1">Manage quotes and convert them to invoices with one click.</p>
          </div>
          <Link 
            href="/invoices/new?type=quote"
            className="bg-purple-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2"
          >
            <ArrowRightLeft className="w-4 h-4" />
            New Quote
          </Link>
        </div>

        {(access.plan.canUseQuotes || access.isAdmin) && (
          <div className="bg-amber-50/60 border border-amber-200/50 rounded-xl p-4 text-xs text-amber-800 leading-relaxed max-w-3xl">
            💡 <strong>Draft & Approval Mode:</strong> Quotes represent draft proposals or estimated pricing. Once approved by your client, you can convert them to a live invoice in a single click, edit details, or remove them.
          </div>
        )}

        {!access.plan.canUseQuotes && !access.isAdmin ? (
          <div className="glass-card flex-1 flex flex-col justify-center items-center p-8 text-center min-h-0">
            <div className="w-16 h-16 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <ArrowRightLeft className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-ink-900 mb-2">Quotes are a Pro Feature</h2>
            <p className="text-ink-500 max-w-md mb-6">
              Upgrade to the Pro plan to create quotes and automatically convert them into invoices when your clients accept them.
            </p>
            <Link 
              href="/pricing"
              className="bg-ink-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-ink-800 transition-all"
            >
              Upgrade Plan
            </Link>
          </div>
        ) : (
          <div className="glass-card flex-1 flex flex-col overflow-hidden min-h-0 mb-4">
            <div className="flex-1 overflow-auto p-2">
              {quotes && quotes.length > 0 ? (
                <InvoiceTable 
                  invoices={quotes} 
                  initialMeta={initialMeta}
                  availableCurrencies={availableCurrencies} 
                  showPaymentToggle={false} 
                  showHeader={false}
                  canUseQuotes={access.plan.canUseQuotes || access.isAdmin}
                  canExportCsv={access.plan.canExportCsv || access.isAdmin}
                  baseStatus="draft,converted"
                  activeWorkspaceId={activeWorkspaceId}
                />
              ) : (
                <EmptyState 
                  title="No quotes yet"
                  message="Create your first quote to send to clients. Quotes can be converted to invoices with one click."
                  href="/invoices/new?type=quote"
                  buttonText="Create Quote"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
