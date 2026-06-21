import { supabaseAdmin } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import InvoiceViewer from '@/components/invoice/InvoiceViewer';

type Props = {
  params: Promise<{ filename: string }>;
};

export default async function ViewInvoicePage({ params }: Props) {
  const { filename } = await params;
  const decodedFilename = decodeURIComponent(filename);

  const { data: invoice, error } = await supabaseAdmin
    .from('invoices')
    .select('pdf_url, nickname, invoice_number')
    .eq('pdf_url', decodedFilename)
    .is('deleted_at', null)
    .single();

  if (error || !invoice?.pdf_url) {
    notFound();
  }

  return (
    <InvoiceViewer
      pdfUrl={invoice.pdf_url}
      invoiceNumber={invoice.invoice_number || invoice.nickname || 'Invoice'}
      slug={decodedFilename}
    />
  );
}
