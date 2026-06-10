import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import DashboardShell from '@/components/layout/DashboardShell'
import InvoiceTable from '@/components/dashboard/InvoiceTable'
import RecentActivity from '@/components/admin/RecentActivity'
import UserStatusActions from '@/components/admin/UserStatusActions'
import Link from 'next/link'
import { ChevronLeft, Mail, Building, Landmark, MapPin, Hash } from 'lucide-react'
import UserDetailsTabs from '@/components/admin/UserDetailsTabs'

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>,
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params;
  const resolvedParams = await searchParams || {};
  const page = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page) : 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  const supabase = await createClient()
  const { data: { user: adminUser } } = await supabase.auth.getUser()
  if (!adminUser) redirect('/login')

  const { data: adminProfile } = await supabase.from('profiles').select('role, full_name, avatar_url, tier, subscription_status, subscription_period_end').eq('id', adminUser.id).single()
  if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'superadmin') redirect('/dashboard')

  // 1. Fetch Targeted User Profile
  const { data: targetUser, error: userError } = await supabase
    .from('profiles')
    .select('*, is_banned, deleted_at')
    .eq('id', id)
    .single()

  if (userError || !targetUser) notFound()

  // 2. Fetch User Invoices (Paginated first page)
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  // 3. Fetch User Specific Activity Logs
  const { data: activityLogs } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(5)

  const totalInvoices = targetUser.total_invoices_generated || 0;
  const initialMeta = {
    total: totalInvoices,
    page: page,
    limit: limit,
    totalPages: Math.ceil(totalInvoices / limit)
  };

  return (
    <DashboardShell 
      userEmail={adminUser.email} 
      userName={adminProfile?.full_name} 
      avatarUrl={adminProfile?.avatar_url} 
      isAdmin={true}
      tier={adminProfile?.tier}
      subscriptionStatus={adminProfile?.subscription_status}
      subscriptionPeriodEnd={adminProfile?.subscription_period_end}
    >
      <div className="mb-8">
        <Link 
          href="/admin" 
          className="inline-flex items-center gap-2 text-ink-500 hover:text-brand-500 font-bold text-sm transition-colors mb-6 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Admin
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-4 mb-3">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl font-bold italic shadow-lg ${
                targetUser.is_banned ? 'bg-red-500 shadow-red-500/20' : 'bg-brand-500 shadow-brand-500/20'
              }`}>
                {targetUser.full_name?.[0] || targetUser.email?.[0] || 'U'}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-ink-900 tracking-tight">
                    {targetUser.full_name || 'Anonymous User'}
                  </h1>
                  {targetUser.is_banned && (
                    <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Banned</span>
                  )}
                  {targetUser.deleted_at && (
                    <span className="bg-ink-100 text-ink-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Deleted</span>
                  )}
                </div>
                <p className="text-ink-500 font-medium">{targetUser.email}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
             <UserStatusActions userId={targetUser.id} initialBanned={targetUser.is_banned} initialDeleted={!!targetUser.deleted_at} />
             <div className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold uppercase tracking-widest border border-emerald-100 h-fit">
                {targetUser.role}
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <UserDetailsTabs 
            user={targetUser} 
            invoices={invoices || []} 
            initialMeta={initialMeta} 
            currentUserRole={adminProfile.role} 
          />
        </div>

        <div className="space-y-8">
          <section className="glass-card p-6 bg-white border border-ink-100 shadow-sm">
            <h3 className="font-bold text-lg text-ink-900 mb-6 flex items-center gap-2">
              <Mail className="w-4 h-4 text-brand-500" />
              User Defaults
            </h3>
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] uppercase font-bold text-ink-400 tracking-widest mb-1.5">Company</label>
                <div className="flex items-center gap-2 text-sm text-ink-700 font-medium">
                  <Building className="w-4 h-4 text-ink-300" />
                  {targetUser.company_name || 'Not set'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-ink-400 tracking-widest mb-1.5">Tax ID / GSTIN</label>
                <div className="flex items-center gap-2 text-sm text-ink-700 font-medium">
                  <Hash className="w-4 h-4 text-ink-300" />
                  {targetUser.defaults?.gstin || 'Not set'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-ink-400 tracking-widest mb-1.5">Bank Details</label>
                <div className="flex items-center gap-2 text-sm text-ink-700 font-medium">
                  <Landmark className="w-4 h-4 text-ink-300" />
                  {targetUser.defaults?.bankName ? `${targetUser.defaults.bankName} (${targetUser.defaults.accountNo || '?'})` : 'Not set'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-ink-400 tracking-widest mb-1.5">Address</label>
                <div className="flex items-start gap-2 text-sm text-ink-700 font-medium leading-relaxed">
                  <MapPin className="w-4 h-4 text-ink-300 mt-0.5" />
                  {targetUser.defaults?.address || 'Not set'}
                </div>
              </div>
            </div>
          </section>

          <section className="glass-card p-6 bg-white border border-ink-100 shadow-sm">
            <h3 className="font-bold text-lg text-ink-900 mb-6">Recent Activity</h3>
            <RecentActivity logs={activityLogs || []} />
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}
