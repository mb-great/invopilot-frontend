import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug);
  const { searchParams } = new URL(request.url);
  const isDownload = searchParams.get('download') === '1';

  // Try pdf_url first, then share_slug
  let { data: invoice, error } = await supabaseAdmin
    .from('invoices')
    .select('pdf_url, nickname, invoice_number')
    .eq('pdf_url', decoded)
    .is('deleted_at', null)
    .single();

  if (error || !invoice?.pdf_url) {
    const res = await supabaseAdmin
      .from('invoices')
      .select('pdf_url, nickname, invoice_number')
      .eq('share_slug', decoded)
      .is('deleted_at', null)
      .single();
    invoice = res.data;
    error = res.error;
  }

  if (error || !invoice?.pdf_url) {
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
