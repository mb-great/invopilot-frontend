import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/layout/DashboardShell'
import Link from 'next/link'
import InvoiceTable from '@/components/dashboard/InvoiceTable'
import EmptyState from '@/components/dashboard/EmptyState'
import StatCards from '@/components/dashboard/StatCards'
import RightSidebar from '@/components/dashboard/RightSidebar'
import BusinessProfileDropdown from '@/components/dashboard/BusinessProfileDropdown'
import RevenueChart from '@/components/dashboard/RevenueChart'
import StatusDonut from '@/components/dashboard/StatusDonut'
import HelpPopover from '@/components/ui/HelpPopover'
import { resolvePlanAccess } from '@/lib/billing/tiers'
import { Lock, Sparkles } from 'lucide-react'
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
    .select('role, full_name, avatar_url, tier, subscription_status, subscription_period_end, cancel_requested_at, defaults')
    .eq('id', user.id)
    .single()

  const access = resolvePlanAccess({
    role: profile?.role,
    tier: profile?.tier,
    subscription_status: profile?.subscription_status,
    subscription_period_end: profile?.subscription_period_end,
  });

  const businesses = (profile?.defaults?.businesses || []).filter((b: any) => !b.deletedAt);
  const isMultiBusinessLocked = !access.plan.canUseQuotes && !access.isAdmin; // using Quotes access as proxy for Pro tier

  // Fetch all invoices to compute charts and filtered stats
  let query = supabase
    .from('invoices')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (businessFilter && !isMultiBusinessLocked) {
    query = query.eq('business_profile_name', businessFilter)
  }

  const { data: allInvoicesData } = await query
  const allInvoices = allInvoicesData || []

  // Fetch metrics data via RPC if no filter, otherwise compute manually
  let stats;
  if (businessFilter && !isMultiBusinessLocked) {
    let topMap = new Map();
    allInvoices.forEach(inv => {
      let amt = 0;
      if (inv.amount) amt = inv.amount;
      else if (inv.form_data?.items) {
        amt = inv.form_data.items.reduce((s: number, i: any) => s + ((i.quantity || 0) * (i.rate || 0)), 0);
      }
      const cur = inv.currency || inv.form_data?.currency || 'USD';
      if (!topMap.has(cur)) topMap.set(cur, { currency: cur, outstanding: 0, paid: 0, overdue: 0, this_month: 0, total_volume: 0, invoice_count: 0 });
      let curStats = topMap.get(cur);
      curStats.invoice_count++;
      curStats.total_volume += amt;
      const status = inv.payment_status || 'draft';
      if (status === 'paid') curStats.paid += amt;
      if (status === 'sent' || status === 'overdue') curStats.outstanding += amt;
      if (status === 'overdue') curStats.overdue += amt;
      const date = new Date(inv.created_at);
      const now = new Date();
      if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
        curStats.this_month += amt;
      }
    });
    const sorted = Array.from(topMap.values()).sort((a, b) => b.total_volume - a.total_volume);
    stats = {
      top_currencies: sorted.slice(0, 3),
      other_currencies: sorted.slice(3),
      total_invoice_count: allInvoices.length
    };
  } else {
    const { data: statsData } = await supabase.rpc('get_dashboard_stats', { user_id_param: user.id })
    stats = statsData || { top_currencies: [], other_currencies: [], total_invoice_count: 0 }
  }

  const availableCurrencies = [
    ...stats.top_currencies.map((c: any) => c.currency),
    ...stats.other_currencies.map((c: any) => c.currency)
  ]

  const recentInvoices = allInvoices.slice(0, 10);

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
      isAdmin={profile?.role === 'admin' || profile?.role === 'superadmin'}
      tier={profile?.tier}
      subscriptionStatus={profile?.subscription_status}
      subscriptionPeriodEnd={profile?.subscription_period_end}
    >
      <div className="flex flex-col space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between shrink-0">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-ink-900 flex items-center gap-3">
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
          <div className="flex items-center gap-4">
            <BusinessProfileDropdown 
              businesses={businesses} 
              isLocked={isMultiBusinessLocked} 
              profile={profile}
              userId={user.id}
              maxBusinesses={access.plan.maxBusinesses}
              canUploadLogo={access.plan.canUploadLogo || access.isAdmin}
            />
            <Link href="/invoices/new" className="btn-brand shadow-lg shadow-brand-500/20 flex items-center gap-2 px-6">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              New invoice
            </Link>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="shrink-0">
          <StatCards 
            topCurrencies={stats.top_currencies} 
            otherCurrencies={stats.other_currencies} 
          />
        </div>

        {/* Charts Section */}
        {access.effectiveTier !== 'free' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 shrink-0">
            <div className="lg:col-span-2">
              <RevenueChart invoices={allInvoices} targetCurrency={stats.top_currencies?.[0]?.currency || 'USD'} profile={profile} />
            </div>
            <div className="lg:col-span-1">
              <StatusDonut invoices={allInvoices} />
            </div>
          </div>
        )}

        {/* Main Content Sections */}
        <div className="grid lg:grid-cols-3 gap-8 pb-4">
          <div className="lg:col-span-2 flex flex-col">
            <div className="glass-card flex flex-col">
              <div className="px-6 py-5 border-b border-ink-100 flex items-center justify-between shrink-0">
                <h2 className="font-bold text-ink-800 tracking-tight">Recent Invoices</h2>
                <Link href="/invoices" className="text-sm font-bold text-brand-600 hover:text-brand-700">View all</Link>
              </div>
              <div className="flex-1 overflow-auto p-2">
                {recentInvoices && recentInvoices.length > 0 ? (
                  <InvoiceTable 
                    invoices={recentInvoices} 
                    initialMeta={initialMeta}
                    showHeader={false} 
                    availableCurrencies={availableCurrencies}
                    canExportCsv={access.plan.canExportCsv || access.isAdmin}
                  />
                ) : (
                  <EmptyState />
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 flex flex-col">
            <RightSidebar profile={profile} stats={stats} recentInvoices={recentInvoices || []} />
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
