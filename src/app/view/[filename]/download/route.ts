import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const decodedFilename = decodeURIComponent(filename);

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let invoice: { pdf_url: string; nickname?: string | null; invoice_number?: string | null } | null = null;

  if (UUID_RE.test(decodedFilename)) {
    const { data } = await supabaseAdmin
      .from('invoices')
      .select('pdf_url, nickname, invoice_number')
      .eq('id', decodedFilename)
      .is('deleted_at', null)
      .maybeSingle();
    invoice = data;
  }

  if (!invoice?.pdf_url) {
    const { data } = await supabaseAdmin
      .from('invoices')
      .select('pdf_url, nickname, invoice_number')
      .eq('share_slug', decodedFilename)
      .is('deleted_at', null)
      .maybeSingle();
    invoice = data;
  }

  if (!invoice?.pdf_url) {
    const { data } = await supabaseAdmin
      .from('invoices')
      .select('pdf_url, nickname, invoice_number')
      .eq('pdf_url', decodedFilename)
      .is('deleted_at', null)
      .maybeSingle();
    invoice = data;
  }

  if (!invoice?.pdf_url) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: fileData, error: downloadError } = await supabaseAdmin
    .storage
    .from('invoices')
    .download(invoice.pdf_url);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: 'Could not download file' }, { status: 500 });
  }

  const displayFilename = `${invoice.nickname || invoice.invoice_number || 'invoice'}.pdf`.replace(/[^a-z0-9.]/gi, '_');

  const headers = new Headers();
  headers.set('Content-Type', 'application/pdf');
  headers.set('Content-Disposition', `attachment; filename="${displayFilename}"`);

  return new NextResponse(fileData, { status: 200, headers });
}
