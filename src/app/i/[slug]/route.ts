import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();

  // 1. Get invoice by share_slug
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('pdf_url')
    .eq('share_slug', slug)
    .single();

  if (error || !invoice || !invoice.pdf_url) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  // 2. Generate signed URL (300s rotation)
  const { data: signedUrl, error: signedUrlError } = await supabase
    .storage
    .from('invoices')
    .createSignedUrl(invoice.pdf_url, 300);

  if (signedUrlError || !signedUrl) {
    return NextResponse.json({ error: 'Could not generate preview' }, { status: 500 });
  }

  return NextResponse.redirect(signedUrl.signedUrl);
}
