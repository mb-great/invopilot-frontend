import InvoiceBuilder from '@/components/invoice/InvoiceBuilder';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

import { Suspense } from 'react';

export default async function NewInvoicePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <InvoiceBuilder />
    </Suspense>
  );
}
