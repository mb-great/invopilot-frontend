import { NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/api-auth';
import { createServerClient } from '@supabase/ssr';
import { v4 as uuidv4 } from 'uuid';

function mapFormDataToApi(formData: any) {
  if (!formData) return {};
  const mapped = { ...formData };
  
  // Standardize naming
  mapped.business_logo = mapped.yourLogo;
  mapped.client_logo = mapped.companyLogo;
  
  // Remove internal confusing names
  delete mapped.yourLogo;
  delete mapped.companyLogo;
  
  return mapped;
}

function mapApiToFormData(apiData: any) {
  if (!apiData) return {};
  const mapped = { ...apiData };
  
  // Convert standard naming back to internal form_data requirements
  mapped.yourLogo = mapped.business_logo;
  mapped.companyLogo = mapped.client_logo;
  
  // Remove external names
  delete mapped.business_logo;
  delete mapped.client_logo;
  
  return mapped;
}

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

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const supabaseAdmin = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: { get() { return ''; }, set() {}, remove() {} }
  });

  const { data, error, count } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, nickname, amount, currency, status, pdf_url, created_at, client_name, client_email, form_data', { count: 'exact' })
    .eq('workspace_id', auth.workspaceId)
    .is('deleted_at', null)
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map to standardized output
  const mappedData = data.map(inv => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3002';
    return {
      ...inv,
      form_data: mapFormDataToApi(inv.form_data),
      pdf_download_url: inv.pdf_url ? `${backendUrl}/storage/v1/object/public/invoices/${inv.pdf_url}` : null,
      view_url: `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3001'}/view/${inv.id}`
    };
  });

  return NextResponse.json({
    data: mappedData,
    meta: {
      total: count,
      page,
      limit
    }
  });
}

export async function POST(req: Request) {
  const auth = await verifyApiKey();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    
    // Minimal validation
    if (!body.client_name || !body.client_email || !body.items || !Array.isArray(body.items)) {
      return NextResponse.json({ error: 'client_name, client_email, and items array are required' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabaseAdmin = createServerClient(supabaseUrl, supabaseServiceKey, {
      cookies: { get() { return ''; }, set() {}, remove() {} }
    });

    const invoiceId = uuidv4();
    const invoiceNumber = body.invoice_number || `INV-${Date.now().toString().slice(-6)}`;
    
    // Map external API naming back to internal form_data
    const internalFormData = mapApiToFormData(body);
    internalFormData.invoiceNumber = invoiceNumber;

    // Calculate total amount (items + tax - discount)
    const subtotal = body.items.reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.price)), 0);
    const taxRate = Number(body.tax_rate || body.items?.[0]?.tax_rate || 0);
    const discount = Number(body.discount || 0);
    const amount = subtotal + (subtotal * taxRate / 100) - discount;

    const { data, error } = await supabaseAdmin
      .from('invoices')
      .insert({
        id: invoiceId,
        workspace_id: auth.workspaceId,
        user_id: auth.userId,
        invoice_number: invoiceNumber,
        client_name: body.client_name,
        client_email: body.client_email,
        amount,
        currency: body.currency || 'USD',
        status: 'draft',
        form_data: internalFormData,
        nickname: body.nickname || `API Generated ${invoiceNumber}`
      })
      .select('id, invoice_number, status, created_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger PDF generation on backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:3002';
    const workerSecret = process.env.WORKER_SECRET;
    
    fetch(`${backendUrl}/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-worker-secret': workerSecret || ''
      },
      body: JSON.stringify({ invoiceId, formData: internalFormData })
    }).catch(err => console.error('API Invoice PDF trigger failed:', err));

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Invalid JSON payload or internal error' }, { status: 400 });
  }
}
