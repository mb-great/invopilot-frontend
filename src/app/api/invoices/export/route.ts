import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getActiveWorkspaceId } from '@/lib/workspace';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || 'lifetime';
  const startDate = searchParams.get('start');
  const endDate = searchParams.get('end');

  const activeWorkspaceId = await getActiveWorkspaceId(user.id);

  let query = supabase
    .from('invoices')
    .select('id, invoice_number, client_name, client_email, amount, currency, status, payment_status, issue_date, due_date, created_at, share_slug, form_data')
    .eq('workspace_id', activeWorkspaceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Handle Date Filters
  const now = new Date();
  if (range === '7d') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    query = query.gte('created_at', d.toISOString());
  } else if (range === '30d') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    query = query.gte('created_at', d.toISOString());
  } else if (range === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    query = query.gte('created_at', d.toISOString());
  } else if (range === 'custom' && startDate && endDate) {
    query = query.gte('created_at', `${startDate}T00:00:00.000Z`).lte('created_at', `${endDate}T23:59:59.999Z`);
  }

  // To protect memory, we stream the data directly or fetch it all if it's manageable.
  // With 10,000 rows, selecting only the necessary fields keeps the payload around ~5-10MB, which Node can easily parse and serialize to CSV without OOM.
  const { data: invoices, error } = await query;

  if (error) {
    console.error('Fetch invoices error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!invoices || invoices.length === 0) {
    return NextResponse.json({ error: 'No invoices found for this period' }, { status: 404 });
  }

  const escapeCsvValue = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = [
    'Invoice #', 
    'Client Name', 
    'Client Email', 
    'Amount', 
    'Currency', 
    'Status', 
    'Payment Status', 
    'Issue Date', 
    'Due Date', 
    'Generated Date', 
    'PDF Link',
    'Sender Name',
    'Sender Email',
    'Sender Address',
    'Sender Tax ID',
    'Client Address',
    'Client Tax ID',
    'Discount',
    'Tax Rate (%)',
    'Note',
    'Bank Name',
    'Account Number',
    'Account Name',
    'IFSC/Swift Code',
    'UPI ID'
  ];

  const rows = invoices.map((inv: any) => {
    const fd = inv.form_data || {};
    
    const senderAddrParts = [
      fd.yourAddress,
      fd.yourCity,
      fd.yourState,
      fd.yourZip,
      fd.yourCountry
    ].filter(Boolean);
    const senderAddress = senderAddrParts.join(', ');

    const clientAddrParts = [
      fd.address,
      fd.city,
      fd.state,
      fd.zip,
      fd.country
    ].filter(Boolean);
    const clientAddress = clientAddrParts.join(', ');

    const domain = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://invopilot.com';

    const row = [
      inv.invoice_number || inv.id.slice(0, 8),
      inv.client_name || fd.clientName || 'Unnamed',
      inv.client_email || fd.clientEmail || '',
      inv.amount || 0,
      inv.currency || 'INR',
      inv.status,
      inv.payment_status,
      inv.issue_date || fd.issueDate || '',
      inv.due_date || fd.dueDate || '',
      inv.created_at ? new Date(inv.created_at).toISOString().slice(0, 10) : '',
      inv.share_slug ? `${domain}/i/${inv.share_slug}` : '',
      fd.yourName || '',
      fd.yourEmail || '',
      senderAddress,
      fd.yourTaxId || '',
      clientAddress,
      fd.taxId || '',
      fd.discount || 0,
      fd.taxRate || 0,
      fd.note || '',
      fd.bankName || '',
      fd.accountNumber || '',
      fd.accountName || '',
      fd.ifscCode || fd.swiftCode || '',
      fd.upiId || ''
    ];

    return row.map(escapeCsvValue);
  });

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="invoices_${range}_${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
