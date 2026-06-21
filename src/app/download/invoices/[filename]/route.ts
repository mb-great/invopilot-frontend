import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;
  const { searchParams } = new URL(request.url);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const shareToken = searchParams.get('share');

  if (!user && !shareToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let invoice = null;
  let error = null;

  if (user) {
    // Session user checks via RLS
    const res = await supabase
      .from('invoices')
      .select('id, pdf_url')
      .eq('pdf_url', filename)
      .single();
    invoice = res.data;
    error = res.error;
  } else {
    // Public user downloads via matching share token (bypass RLS using supabaseAdmin)
    const res = await supabaseAdmin
      .from('invoices')
      .select('id, pdf_url')
      .eq('pdf_url', filename)
      .eq('share_slug', shareToken)
      .single();
    invoice = res.data;
    error = res.error;
  }

  if (error || !invoice || !invoice.pdf_url) {
    return NextResponse.json({ error: 'Not found or not generated' }, { status: 404 });
  }
  
  // Fetch the file directly from storage using admin client to stream it
  const { data: fileData, error: downloadError } = await supabaseAdmin
    .storage
    .from('invoices')
    .download(invoice.pdf_url);

  if (downloadError || !fileData) return NextResponse.json({ error: 'Could not download file' }, { status: 500 });

  // Stream the file as attachment
  const headers = new Headers();
  headers.set('Content-Type', 'application/pdf');
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);

  return new NextResponse(fileData, {
    status: 200,
    headers,
  });
}
