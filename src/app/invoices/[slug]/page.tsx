import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ShareInvoiceRedirect({ params }: Props) {
  const { slug } = await params;

  const { data: invoice } = await supabaseAdmin
    .from('invoices')
    .select('pdf_url')
    .eq('share_slug', slug)
    .is('deleted_at', null)
    .single();

  if (!invoice?.pdf_url) {
    redirect('/');
  }

  redirect(`/view/${encodeURIComponent(invoice.pdf_url)}`);
}
