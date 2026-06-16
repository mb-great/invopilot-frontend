import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/layout/DashboardShell'
import StatCards from '@/components/admin/StatCards'
import AdminTable from '@/components/admin/AdminTable'
import RecentActivity from '@/components/admin/RecentActivity'
import InviteUserForm from '@/components/admin/InviteUserForm'
import { Activity } from 'lucide-react'
import Link from 'next/link'
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const access = await getWorkspaceAccess(supabase);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url, tier, subscription_status, subscription_period_end')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
    redirect('/dashboard')
  }

  // Await searchParams for Next.js 15
  const resolvedParams = await searchParams || {};
  const queryParam = typeof resolvedParams.q === 'string' ? resolvedParams.q : '';
  const page = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page) : 1;
  const tab = typeof resolvedParams.tab === 'string' ? resolvedParams.tab : 'active';
  const limit = 10;
  const offset = (page - 1) * limit;

  // 1. Fetch Platform-wide Stats
  const { data: metrics } = await supabase.rpc('get_admin_metrics');
  const totalInvoices = metrics?.[0]?.active_invoices_count || 0;
  const activeUsers = metrics?.[0]?.total_users || 0;
  const lifetimeGenerated = metrics?.[0]?.total_invoices_lifetime || 0;

  const { count: successInvoices } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('status', 'done');
  const successRate = totalInvoices ? ((successInvoices || 0) / totalInvoices * 100).toFixed(1) + '%' : '100%';

  let displayData: any[] = [];
  let totalCount = 0;

  if (tab === 'active') {
    // 2. Fetch Active Users
    let userQuery = supabase
      .from('profiles')
      .select('id, email, full_name, role, created_at, total_invoices_generated, tier, subscription_status, subscription_period_start, subscription_period_end, subscription_source', { count: 'exact' });

    if (queryParam) {
      userQuery = userQuery.or(`email.ilike.%${queryParam}%,full_name.ilike.%${queryParam}%`);
    }

    const { data: users, count } = await userQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    displayData = users || [];
    totalCount = count || 0;
  } else {
    // 2. Fetch Deleted Archive
    let archiveQuery = supabase
      .from('deleted_accounts_archive')
      .select('original_user_id, email, full_name, total_invoices, deleted_at', { count: 'exact' });
    
    if (queryParam) {
      archiveQuery = archiveQuery.or(`email.ilike.%${queryParam}%,full_name.ilike.%${queryParam}%`);
    }

    const { data: deleted, count } = await archiveQuery
      .order('deleted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    displayData = (deleted || []).map(d => ({
      id: d.original_user_id,
      email: d.email,
      full_name: d.full_name,
      role: 'DELETED',
      created_at: d.deleted_at,
      total_invoices_generated: d.total_invoices,
      isDeleted: true
    }));
    totalCount = count || 0;
  }

  // 3. Fetch Recent Activity Logs
  const { data: activityLogs } = await supabase
    .from('activity_logs')
    .select(`
      *,
      profiles (email, full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  const totalPages = Math.ceil((totalCount || 0) / limit);

  return (
    <DashboardShell
      userEmail={user.email}
      userName={profile?.full_name}
      avatarUrl={profile?.avatar_url}
      access={access}
    >
      <div className="mb-12">
        <h1 className="text-4xl font-bold mb-3 tracking-tight text-ink-900" style={{ fontFamily: 'var(--font-display)' }}>
          System Admin
        </h1>
        <p className="text-ink-500 text-lg">Monitoring platform usage and health metrics</p>
      </div>

      <section className="mb-12">
        <StatCards 
          totalInvoices={totalInvoices} 
          activeUsers={activeUsers} 
          lifetimeGenerated={lifetimeGenerated}
          successRate={successRate} 
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section className="glass-card overflow-hidden bg-white border border-ink-100 shadow-sm">
            <div className="p-6 border-b border-ink-100 bg-ink-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-1 bg-ink-100 p-1 rounded-xl w-fit">
                <Link 
                  href="/admin?tab=active"
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === 'active' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}
                >
                  Active
                </Link>
                <Link 
                  href="/admin?tab=deleted"
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${tab === 'deleted' ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}
                >
                  Deleted Archive
                </Link>
              </div>

              <form method="GET" action="/admin">
                <input type="hidden" name="tab" value={tab} />
                <input 
                  type="text" 
                  name="q"
                  defaultValue={queryParam}
                  placeholder="Search email/name..." 
                  className="bg-white border border-ink-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-brand-500 transition-all shadow-inner w-full md:w-64"
                />
              </form>
            </div>
            <div className="p-2">
              {displayData && displayData.length > 0 ? (
                <AdminTable 
                  users={displayData} 
                  pagination={{
                    currentPage: page,
                    totalPages,
                    totalCount: totalCount || 0
                  }} 
                  currentUserRole={profile.role}
                />
              ) : (
                <div className="py-20 text-center text-ink-400 italic">
                  {queryParam ? 'No users found for your search.' : 'No users in database.'}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <InviteUserForm />

          <section className="glass-card p-6 bg-white border border-ink-100 shadow-sm">
            <h3 className="font-bold text-xl text-ink-900 mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-brand-500" />
              Live Activity
            </h3>
            <RecentActivity logs={activityLogs || []} />
          </section>

          <div className="glass-card p-6 bg-ink-900 text-white shadow-2xl">
            <h4 className="font-bold mb-4 italic font-serif text-brand-400 text-lg">System Health</h4>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-ink-400 uppercase tracking-widest font-bold">Postgres</span>
                <span className="text-emerald-400 font-bold uppercase">Optimal</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-ink-400 uppercase tracking-widest font-bold">Storage</span>
                <span className="text-emerald-400 font-bold uppercase">92% Free</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-ink-400 uppercase tracking-widest font-bold">API Latency</span>
                <span className="text-brand-400 font-bold uppercase">42ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
