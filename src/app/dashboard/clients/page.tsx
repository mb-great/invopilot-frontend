import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/layout/DashboardShell'

type ClientInvoiceRow = {
  client_name: string | null
  client_email: string | null
  amount: number | null
  currency: string | null
  payment_status: string | null
}

type ClientSummary = {
  name: string
  email: string | null
  totalBilled: number
  invoiceCount: number
  currency: string
  status: string
}

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url')
    .eq('id', user.id)
    .single()

  // Fetch all invoices to derive clients
  const { data: invoices } = await supabase
    .from('invoices')
    .select('client_name, client_email, amount, currency, payment_status')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .not('client_name', 'is', null);

  // Filter and group by client_name
  const clientsMap = ((invoices || []) as ClientInvoiceRow[]).reduce<Record<string, ClientSummary>>((acc, inv) => {
    const name = inv.client_name?.trim();
    
    // Skip if name is empty or explicitly 'Unknown' (case insensitive)
    if (!name || name.toLowerCase() === 'unknown' || name.toLowerCase() === 'unknown client') {
      return acc;
    }

    if (!acc[name]) {
      acc[name] = {
        name,
        email: inv.client_email,
        totalBilled: 0,
        invoiceCount: 0,
        currency: inv.currency || 'INR',
        status: inv.payment_status || 'draft'
      }
    }
    acc[name].totalBilled += inv.amount || 0
    acc[name].invoiceCount += 1
    return acc
  }, {})

  const clients: ClientSummary[] = Object.values(clientsMap)

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0
    }).format(amount);
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
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">Clients</h1>
          <p className="text-ink-500 mt-1">Directory of clients derived from your invoice history.</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-ink-400 text-xs uppercase tracking-widest border-b border-ink-100 bg-ink-50/30">
              <th className="py-4 px-6 font-bold">Client Name</th>
              <th className="py-4 px-6 font-bold">Total Billed</th>
              <th className="py-4 px-6 font-bold text-center">Invoices</th>
              <th className="py-4 px-6 font-bold text-right">Latest Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {clients.length > 0 ? (
              clients.map((client) => (
                <tr key={client.name} className="group hover:bg-ink-50/50 transition-colors">
                  <td className="py-5 px-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-ink-900">{client.name}</span>
                      <span className="text-xs text-ink-400">{client.email || 'No email provided'}</span>
                    </div>
                  </td>
                  <td className="py-5 px-6 font-bold text-ink-900">
                    {formatCurrency(client.totalBilled, client.currency)}
                  </td>
                  <td className="py-5 px-6 text-center text-ink-500 font-medium">
                    {client.invoiceCount}
                  </td>
                  <td className="py-5 px-6 text-right">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                      client.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                      client.status === 'overdue' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                      'bg-brand-500/10 text-brand-600 border-brand-500/20'
                    }`}>
                      {client.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-20 text-center italic text-ink-400">
                  No clients found. Generate an invoice to see them here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  )
}
