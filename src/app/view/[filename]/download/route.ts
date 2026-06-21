import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const decodedFilename = decodeURIComponent(filename);

  const { data: invoice, error } = await supabaseAdmin
    .from('invoices')
    .select('pdf_url, nickname, invoice_number')
    .eq('pdf_url', decodedFilename)
    .is('deleted_at', null)
    .single();

  if (error || !invoice?.pdf_url) {
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
