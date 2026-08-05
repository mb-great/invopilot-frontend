import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import InvoiceViewer from '@/components/invoice/InvoiceViewer';
import { isBotOrScanner, resolveSource } from '@/lib/tracking/botFilter';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ src?: string }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PublicInvoicePage({ params, searchParams }: Props) {
  const { id: rawId } = await params;
  const { src } = await searchParams;
  const decoded = decodeURIComponent(rawId).trim();

  // 1. Resolve invoice by UUID id, share_slug, or pdf_url
  let invoice: { id: string; user_id?: string | null; pdf_url: string; invoice_number?: string | null; nickname?: string | null } | null = null;

  if (UUID_RE.test(decoded)) {
    const { data } = await supabaseAdmin
      .from('invoices')
      .select('id, user_id, pdf_url, invoice_number, nickname')
      .eq('id', decoded)
      .is('deleted_at', null)
      .maybeSingle();
    invoice = data;
  }

  if (!invoice) {
    const { data } = await supabaseAdmin
      .from('invoices')
      .select('id, user_id, pdf_url, invoice_number, nickname')
      .eq('share_slug', decoded)
      .is('deleted_at', null)
      .maybeSingle();
    invoice = data;
  }

  if (!invoice) {
    const { data } = await supabaseAdmin
      .from('invoices')
      .select('id, user_id, pdf_url, invoice_number, nickname')
      .eq('pdf_url', decoded)
      .is('deleted_at', null)
      .maybeSingle();
    invoice = data;
  }

  if (!invoice || !invoice.pdf_url) {
    notFound();
  }

  // 2. Non-blocking view tracking with bot filter, 10-min cooldown & viewer identification
  const headerStore = await headers();
  const cookieStore = await cookies();
  const userAgent = headerStore.get('user-agent');
  const isBot = isBotOrScanner(userAgent, headerStore);
  
  const sessionCookieName = `inv_seen_${invoice.id}`;
  const hasActiveSession = cookieStore.has(sessionCookieName);

  if (!isBot && !hasActiveSession) {
    // Non-blocking fire-and-forget view recording
    (async () => {
      try {
        let viewer = 'Anonymous Client';
        try {
          const supabase = await createClient();
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user) {
            // If the logged-in user is the creator/owner of the invoice, DO NOT count as client open!
            if (invoice.user_id && authData.user.id === invoice.user_id) {
              return;
            }
            viewer = authData.user.user_metadata?.full_name || authData.user.email || 'InvoPilot User';
          }
        } catch {
          // Fallback to Anonymous Client
        }

        try {
          cookieStore.set(sessionCookieName, '1', {
            maxAge: 600, // 10 minutes session window
            path: '/',
            sameSite: 'lax',
            httpOnly: true,
          });
        } catch {
          // Ignore cookie set errors in read-only SSR edge cases
        }

        const resolvedSource = resolveSource(src, headerStore.get('referer'));

        await supabaseAdmin.rpc('record_invoice_view', {
          p_invoice_id: invoice.id,
          p_source: resolvedSource,
          p_viewer: viewer,
        });
      } catch (err) {
        console.warn('[Tracking] Failed to record invoice view:', err);
      }
    })();
  }

  return (
    <InvoiceViewer
      pdfUrl={invoice.pdf_url}
      invoiceNumber={invoice.invoice_number || invoice.nickname || 'Invoice'}
      slug={decoded}
    />
  );
}
