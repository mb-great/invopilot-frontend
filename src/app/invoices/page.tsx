import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardShell from '@/components/layout/DashboardShell'
import InvoiceTable from '@/components/dashboard/InvoiceTable'
import EmptyState from '@/components/dashboard/EmptyState'
import { resolvePlanAccess } from '@/lib/billing/tiers'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url, total_invoices_generated, tier, subscription_status, subscription_period_end')
    .eq('id', user.id)
    .single()

  // Get actual count of non-deleted invoices (NOT lifetime counter which includes deleted)
  const { count: actualInvoiceCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('deleted_at', null)

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(0, 9)

  const { data: metrics } = await supabase
    .from('user_currency_metrics')
    .select('currency')
    .eq('user_id', user.id)

  const availableCurrencies = metrics?.map(m => m.currency) || []
  const access = resolvePlanAccess(profile);
  
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
      isAdmin={profile?.role === 'admin' || profile?.role === 'superadmin'}
      tier={profile?.tier}
      subscriptionStatus={profile?.subscription_status}
      subscriptionPeriodEnd={profile?.subscription_period_end}
    >
      <div className="flex flex-col h-full space-y-6 md:space-y-8 min-h-0">
        <div className="flex items-center justify-between shrink-0 px-1">
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
