import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug).trim();
  const { searchParams } = new URL(request.url);
  const isDownload = searchParams.get('download') === '1';

  // 1. Try UUID id first if valid UUID
  let invoice: { pdf_url: string; nickname?: string | null; invoice_number?: string | null } | null = null;

  if (UUID_RE.test(decoded)) {
    const { data } = await supabaseAdmin
      .from('invoices')
      .select('pdf_url, nickname, invoice_number')
      .eq('id', decoded)
      .is('deleted_at', null)
      .maybeSingle();
    invoice = data;
  }

  // 2. Try share_slug
  if (!invoice?.pdf_url) {
    const { data } = await supabaseAdmin
      .from('invoices')
      .select('pdf_url, nickname, invoice_number')
      .eq('share_slug', decoded)
      .is('deleted_at', null)
      .maybeSingle();
    invoice = data;
  }

  // 3. Try pdf_url
  if (!invoice?.pdf_url) {
    const { data } = await supabaseAdmin
      .from('invoices')
      .select('pdf_url, nickname, invoice_number')
      .eq('pdf_url', decoded)
      .is('deleted_at', null)
      .maybeSingle();
    invoice = data;
  }

  if (!invoice?.pdf_url) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const { data: fileData, error: downloadError } = await supabaseAdmin
    .storage
    .from('invoices')
    .download(invoice.pdf_url);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: 'Could not download file' }, { status: 500 });
  }

  const filename = `${invoice.nickname || invoice.invoice_number || 'invoice'}.pdf`.replace(/[^a-z0-9.]/gi, '_');

  const headers = new Headers();
  headers.set('Content-Type', 'application/pdf');
  headers.set(
    'Content-Disposition',
    isDownload ? `attachment; filename="${filename}"` : 'inline'
  );

  return new NextResponse(fileData, {
    status: 200,
    headers,
  });
}
