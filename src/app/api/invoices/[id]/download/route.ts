import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const viewOnly = searchParams.get('view') === '1';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Get the PDF URL and nickname from the invoice
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('pdf_url, nickname, invoice_number')
    .eq('id', id)
    .single();

  if (error || !invoice || !invoice.pdf_url) return NextResponse.json({ error: 'Not found or not generated' }, { status: 404 });

  // 2. Generate signed URL (expires in 60s)
  // If not viewOnly, set the download filename
  const filename = `${invoice.nickname || invoice.invoice_number || 'invoice'}.pdf`.replace(/[^a-z0-9.]/gi, '_');
  
  const { data: signedUrl, error: signedUrlError } = await supabase
    .storage
    .from('invoices')
    .createSignedUrl(invoice.pdf_url, 60, {
      download: viewOnly ? false : filename
    });

  if (signedUrlError || !signedUrl) return NextResponse.json({ error: 'Could not generate URL' }, { status: 500 });

  return NextResponse.redirect(signedUrl.signedUrl);
}
