import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardShell from '@/components/layout/DashboardShell'
import InvoiceTable from '@/components/dashboard/InvoiceTable'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url, total_invoices_generated')
    .eq('id', user.id)
    .single()

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
  
  const totalCount = profile?.total_invoices_generated || 0;
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
      isAdmin={profile?.role === 'admin'}
    >
      <div className="mb-8 flex items-center justify-between">
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

      <div className="glass-card p-6">
        {invoices && invoices.length > 0 ? (
          <InvoiceTable 
            invoices={invoices} 
            initialMeta={initialMeta}
            availableCurrencies={availableCurrencies} 
            showPaymentToggle={true} 
            showHeader={false}
          />
        ) : (
          <div className="py-20 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-ink-50 text-ink-400 mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </div>
            <h3 className="text-lg font-bold text-ink-900">No invoices yet</h3>
            <p className="text-ink-500 mt-1 max-w-xs mx-auto">Create your first invoice to start tracking your business revenue.</p>
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
