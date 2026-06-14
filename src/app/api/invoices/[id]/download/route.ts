import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

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
  // We use the user's supabase client here so RLS ensures they own it
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('pdf_url, nickname, invoice_number')
    .eq('id', id)
    .single();

  if (error || !invoice || !invoice.pdf_url) return NextResponse.json({ error: 'Not found or not generated' }, { status: 404 });

  if (invoice.pdf_url.startsWith('http://') || invoice.pdf_url.startsWith('https://')) {
    return NextResponse.redirect(invoice.pdf_url);
  }

  const filename = `${invoice.nickname || invoice.invoice_number || 'invoice'}.pdf`.replace(/[^a-z0-9.]/gi, '_');
  
  // 2. Fetch the file directly from storage using admin client to stream it
  const { data: fileData, error: downloadError } = await supabaseAdmin
    .storage
    .from('invoices')
    .download(invoice.pdf_url);

  if (downloadError || !fileData) return NextResponse.json({ error: 'Could not download file' }, { status: 500 });

  // 3. Stream the file to the client with appropriate headers
  const headers = new Headers();
  headers.set('Content-Type', 'application/pdf');
  headers.set(
    'Content-Disposition',
    viewOnly ? 'inline' : `attachment; filename="${filename}"`
  );

  return new NextResponse(fileData, {
    status: 200,
    headers,
  });
}
