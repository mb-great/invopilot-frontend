import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Use admin client to bypass RLS for public share links
  const { data: invoice, error } = await supabaseAdmin
    .from('invoices')
    .select('pdf_url, nickname, invoice_number')
    .eq('share_slug', slug)
    .is('deleted_at', null)
    .single();

  if (error || !invoice || !invoice.pdf_url) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // Download the file directly from storage
  const { data: fileData, error: downloadError } = await supabaseAdmin
    .storage
    .from('invoices')
    .download(invoice.pdf_url);

  if (downloadError || !fileData) {
    return NextResponse.json({ error: 'Could not download file' }, { status: 500 });
  }

  // Serve inline (display in browser, not download)
  const headers = new Headers();
  headers.set('Content-Type', 'application/pdf');
  headers.set('Content-Disposition', 'inline');

  return new NextResponse(fileData, {
    status: 200,
    headers,
  });
}
