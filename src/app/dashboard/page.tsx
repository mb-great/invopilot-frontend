import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/layout/DashboardShell'
import Link from 'next/link'
import InvoiceTable from '@/components/dashboard/InvoiceTable'
import EmptyState from '@/components/dashboard/EmptyState'
import StatCards from '@/components/dashboard/StatCards'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Await searchParams since Next.js 15
  await searchParams

  // Fetch metrics data via RPC
  const { data: statsData } = await supabase.rpc('get_dashboard_stats', { 
    user_id_param: user.id 
  })

  const stats = statsData || { 
    top_currencies: [], 
    other_currencies: [], 
    total_invoice_count: 0 
  }

  const availableCurrencies = [
    ...stats.top_currencies.map((c: any) => c.currency),
    ...stats.other_currencies.map((c: any) => c.currency)
  ]

  // Fetch recent invoices for the table
  const { data: recentInvoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(6)

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url')
    .eq('id', user.id)
    .single()

  const initialMeta = {
    total: stats.total_invoice_count,
    page: 1,
    limit: 6,
    totalPages: Math.ceil(stats.total_invoice_count / 6)
  };

  return (
    <DashboardShell 
      userEmail={user.email} 
      userName={profile?.full_name} 
      avatarUrl={profile?.avatar_url} 
      isAdmin={profile?.role === 'admin'}
    >
      <div className="flex flex-col h-full space-y-8 md:space-y-10 min-h-0">
        {/* Header */}
        <div className="flex items-start justify-between shrink-0">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-ink-900">
              Your <span className="headline-accent italic font-serif font-normal">dashboard</span>
            </h1>
            <p className="text-ink-500 mt-2 text-lg">Snapshot of your invoicing — outstanding, paid, and what&apos;s due next.</p>
          </div>
          <Link href="/invoices/new" className="btn-brand shadow-lg shadow-brand-500/20 flex items-center gap-2 px-6">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            New invoice
          </Link>
        </div>

        {/* Metric Cards */}
        <div className="shrink-0">
          <StatCards 
            topCurrencies={stats.top_currencies} 
            otherCurrencies={stats.other_currencies} 
          />
        </div>

        {/* Main Content Sections */}
        <div className="flex-1 grid lg:grid-cols-3 gap-8 min-h-0 pb-4">
          <div className="lg:col-span-2 flex flex-col min-h-0">
            <div className="glass-card flex flex-col overflow-hidden h-full">
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
                  />
                ) : (
                  <EmptyState />
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8 shrink-0">
            <div className="glass-card p-6 bg-brand-500 text-white relative overflow-hidden group cursor-pointer">
              <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-white/10 rounded-full blur-2xl group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2 italic font-serif">Pro Tip</h3>
                <p className="text-brand-50 text-sm leading-relaxed">
                  You can set up auto-reminders in settings to notify clients 3 days before an invoice is due.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
