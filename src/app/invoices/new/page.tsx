import InvoiceBuilder from '@/components/invoice/InvoiceBuilder';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function NewInvoicePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <InvoiceBuilder />;
}
