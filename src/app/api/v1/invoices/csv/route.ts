import { NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-auth';
import { createServerClient } from '@supabase/ssr';

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Bearer',
    },
  });
}

export async function GET(req: Request) {
  const auth = await verifyApiKey();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseAdmin = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: { get() { return ''; }, set() {}, remove() {} }
  });

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
    'Note'
  ];

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(headers.join(',') + '\n');
      
      const BATCH_SIZE = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabaseAdmin
          .from('invoices')
          .select('id, invoice_number, client_name, client_email, amount, currency, status, payment_status, issue_date, due_date, created_at, pdf_url, form_data')
          .eq('workspace_id', auth.workspaceId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        const { data: invoices, error } = await query.range(offset, offset + BATCH_SIZE - 1);

        if (error) {
          console.error('Fetch invoices error:', error);
          controller.error(error);
          return;
        }

        if (!invoices || invoices.length === 0) {
          hasMore = false;
          break;
        }

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

        const rows = invoices.map((inv: any) => {
          const fd = inv.form_data || {};
          return [
            inv.invoice_number,
            inv.client_name,
            inv.client_email,
            inv.amount,
            inv.currency,
            inv.status,
            inv.payment_status || '',
            inv.issue_date || '',
            inv.due_date || '',
            inv.created_at,
            inv.pdf_url ? `${backendUrl}/storage/v1/object/public/invoices/${inv.pdf_url}` : '',
            fd.yourName,
            fd.yourEmail,
            `${fd.yourAddress || ''} ${fd.yourCity || ''} ${fd.yourState || ''} ${fd.yourZip || ''} ${fd.yourCountry || ''}`.trim(),
            fd.yourTaxId,
            `${fd.companyAddress || ''} ${fd.companyCity || ''} ${fd.companyState || ''} ${fd.companyZip || ''} ${fd.companyCountry || ''}`.trim(),
            fd.companyTaxId,
            fd.discount,
            fd.taxRate,
            fd.note
          ].map(escapeCsvValue).join(',');
        });

        controller.enqueue(rows.join('\n') + '\n');

        if (invoices.length < BATCH_SIZE) {
          hasMore = false;
        } else {
          offset += BATCH_SIZE;
        }
      }

      controller.close();
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="invoices_api_export_${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
