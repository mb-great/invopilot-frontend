import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import ClientsClient from '@/components/dashboard/ClientsClient';
import { getActiveWorkspaceId } from '@/lib/workspace';
import { resolvePlanAccess } from '@/lib/billing/tiers';
import { getWorkspaceAccess } from '@/lib/billing/getWorkspaceAccess';

export const dynamic = 'force-dynamic';

type ClientInvoiceRow = {
  id: string;
  client_name: string | null;
  client_email: string | null;
  amount: number | null;
  currency: string | null;
  payment_status: string | null;
  form_data: any;
};

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url, tier, subscription_status, subscription_period_end, defaults')
    .eq('id', user.id)
    .single();

  const activeWorkspaceId = await getActiveWorkspaceId(user.id);

  const { data: wsData } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', activeWorkspaceId)
    .single();

  const ownerId = wsData?.owner_id || user.id;

  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('role, tier, subscription_status, subscription_period_end')
    .eq('id', ownerId)
    .single();

  const access = await getWorkspaceAccess(supabase);
  const clientLimit = access.plan.maxClients === 'unlimited' ? Infinity : (access.plan.maxClients as number);

  // 1. Fetch saved clients for the active workspace
  const { data: dbClientsData } = await supabase
    .from('clients')
    .select('*')
    .eq('workspace_id', activeWorkspaceId)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  const savedClients = dbClientsData || [];

  // 2. Fetch recent invoices to aggregate billing stats, potential clients, and mismatches
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, client_name, client_email, amount, currency, payment_status, form_data')
    .eq('workspace_id', activeWorkspaceId)
    .is('deleted_at', null)
    .not('client_name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  // Group invoices for billing stats by client name
  const billingStats = ((invoices || []) as ClientInvoiceRow[]).reduce<Record<string, {
    totalBilled: number;
    invoiceCount: number;
    paidCount: number;
    outstandingAmount: number;
    healthScore: number;
    currency: string;
    status: string;
  }>>((acc, inv) => {
    const name = inv.client_name?.trim();
    if (!name) return acc;

    if (!acc[name]) {
      acc[name] = {
        totalBilled: 0,
        invoiceCount: 0,
        paidCount: 0,
        outstandingAmount: 0,
        healthScore: 0,
        currency: inv.currency || 'INR',
        status: inv.payment_status || 'draft'
      };
    }
    acc[name].totalBilled += inv.amount || 0;
    acc[name].invoiceCount += 1;
    if (inv.payment_status === 'paid') {
      acc[name].paidCount += 1;
    } else {
      acc[name].outstandingAmount += inv.amount || 0;
    }
    return acc;
  }, {});

  // Calculate health scores
  Object.keys(billingStats).forEach(name => {
    const s = billingStats[name];
    s.healthScore = s.invoiceCount > 0 ? Math.round((s.paidCount / s.invoiceCount) * 100) : 0;
  });

  // 3. Extract unique unsaved, non-dismissed potential clients (limit to top 5)
  const dismissedClients = profile?.defaults?.dismissed_clients || [];
  const potentialClientsMap: Record<string, { name: string; email: string | null }> = {};

  (invoices || []).forEach(inv => {
    const name = inv.client_name?.trim();
    const email = inv.client_email?.trim() || null;
    if (!name || name.toLowerCase() === 'unknown' || name.toLowerCase() === 'unknown client') return;

    // Check if already in clients list (strict name match)
    const isSaved = savedClients.some(c => c.name.toLowerCase() === name.toLowerCase());

    // Check if dismissed in profile defaults
    const isDismissed = dismissedClients.some((d: string) => d.toLowerCase() === name.toLowerCase());

    if (!isSaved && !isDismissed) {
      if (!potentialClientsMap[name]) {
        potentialClientsMap[name] = { name, email };
      }
    }
  });

  const potentialClients = Object.values(potentialClientsMap).slice(0, 5);

  // 4. Discover new details for existing saved clients (field mismatches)
  const dismissedUpdates = profile?.defaults?.dismissed_updates || [];
  const mismatches: {
    clientId: string;
    clientName: string;
    field: string;
    fieldName: string;
    oldVal: string;
    newVal: string;
    invoiceId: string;
    invoiceNumber: string;
  }[] = [];

  savedClients.forEach(client => {
    // Find matching invoices
    const matchingInvoices = ((invoices || []) as ClientInvoiceRow[]).filter(inv => {
      const name = inv.client_name?.trim();
      return name && name.toLowerCase() === client.name.toLowerCase();
    });

    if (matchingInvoices.length > 0) {
      const latestInvoice = matchingInvoices[0];
      const formData = latestInvoice.form_data || {};

      const invoiceEmail = formData.email?.trim() || latestInvoice.client_email?.trim() || '';
      const invoiceCompanyName = formData.companyName?.trim() || '';
      const invoiceTaxId = formData.companyTaxId?.trim() || '';
      const invoiceAddress = [
        formData.companyAddress || '',
        formData.companyCity || '',
        formData.companyState || '',
        formData.companyZip || '',
        formData.companyCountry || ''
      ].map(s => s.trim()).filter(Boolean).join(', ');

      const storedEmail = client.email?.trim() || '';
      const storedCompanyName = client.company_name?.trim() || '';
      const storedTaxId = client.vat_gstin?.trim() || '';
      const storedAddress = client.address?.trim() || '';

      const checks = [
        { key: 'email', name: 'Email', old: storedEmail, new: invoiceEmail },
        { key: 'company_name', name: 'Company Name', old: storedCompanyName, new: invoiceCompanyName },
        { key: 'vat_gstin', name: 'Tax ID', old: storedTaxId, new: invoiceTaxId },
        { key: 'address', name: 'Address', old: storedAddress, new: invoiceAddress }
      ];

      checks.forEach(c => {
        if (c.new && c.new.toLowerCase() !== c.old.toLowerCase()) {
          const updateKey = `${client.id}:${c.key}:${c.new}`;
          const isDismissed = dismissedUpdates.includes(updateKey);

          if (!isDismissed) {
            mismatches.push({
              clientId: client.id,
              clientName: client.name,
              field: c.key,
              fieldName: c.name,
              oldVal: c.old || '—',
              newVal: c.new,
              invoiceId: latestInvoice.id,
              invoiceNumber: formData.invoiceNumber || 'recent invoice'
            });
          }
        }
      });
    }
  });

  const latestMismatches = mismatches.slice(0, 5);

  return (
    <DashboardShell
      userEmail={user.email}
      userName={profile?.full_name}
      avatarUrl={profile?.avatar_url}
      access={access}
    >
      <ClientsClient
        initialClients={savedClients}
        potentialClients={potentialClients}
        potentialUpdates={latestMismatches}
        billingStats={billingStats}
        clientLimit={clientLimit}
        userId={user.id}
      />
    </DashboardShell>
  );
}
