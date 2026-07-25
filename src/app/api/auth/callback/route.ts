import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFrontendUrl } from '@/lib/url';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const token = searchParams.get('token');
  const next = searchParams.get('next') ?? '/dashboard';
  const baseUrl = getFrontendUrl();

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      console.log('Auth Callback: Code exchange successful.');

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // If a pending invoice token was passed, process the claim!
        if (token) {
          try {
            console.log(`Auth Callback: Claiming pending invoice token ${token} for user ${user.id}`);
            
            // 1. Fetch pending invoice record
            const { data: pendingRecord } = await supabase
              .from('pending_invoices')
              .select('*')
              .eq('id', token)
              .is('claimed_by', null)
              .gt('expires_at', new Date().toISOString())
              .maybeSingle();

            if (pendingRecord) {
              const payload = pendingRecord.invoice_data || {};
              const company = payload.companyDetails || {};
              const details = payload.invoiceDetails || {};
              const terms = payload.invoiceTerms || {};
              const your = payload.yourDetails || {};
              const items = payload.paymentDetails?.items || payload.items || [];

              // Get active workspace ID for user
              const { data: member } = await supabase
                .from('workspace_members')
                .select('workspace_id')
                .eq('user_id', user.id)
                .limit(1)
                .maybeSingle();

              let workspaceId = member?.workspace_id;
              if (!workspaceId) {
                // Fetch default workspace or fallback
                const { data: ws } = await supabase
                  .from('workspaces')
                  .select('id')
                  .limit(1)
                  .maybeSingle();
                workspaceId = ws?.id;
              }

              if (workspaceId) {
                // Calculate amount
                let amount = details.amount || 0;
                if (!amount && Array.isArray(items)) {
                  amount = items.reduce((acc: number, item: any) => {
                    const qty = Number(item.quantity || item.qty || 1);
                    const rate = Number(item.rate || item.price || item.amount || 0);
                    return acc + qty * rate;
                  }, 0);
                }

                const clientName = company.companyName || company.clientName || company.name || 'Client';
                const clientEmail = company.companyEmail || company.email || null;
                const invoiceNumber = terms.invoiceNumber || details.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;

                // 2. Insert into `invoices`
                const { data: newInvoice, error: invErr } = await supabase
                  .from('invoices')
                  .insert({
                    user_id: user.id,
                    workspace_id: workspaceId,
                    form_data: payload,
                    nickname: `${invoiceNumber} · ${clientName}`,
                    status: 'unsent',
                    amount,
                    currency: details.currency || 'INR',
                    client_name: clientName,
                    client_email: clientEmail,
                    business_profile_name: your.name || null,
                    type: 'invoice',
                    payment_status: 'unpaid',
                    delivery_status: 'unsent',
                    invoice_number: invoiceNumber,
                    issue_date: terms.issueDate || null,
                    due_date: terms.dueDate || null,
                  })
                  .select('id')
                  .single();

                if (!invErr && newInvoice) {
                  // 3. Mark pending invoice as claimed
                  await supabase
                    .from('pending_invoices')
                    .update({ claimed_by: user.id })
                    .eq('id', token);

                  // 4. Update profile defaults with pending_send_invoice_id
                  const { data: profile } = await supabase
                    .from('profiles')
                    .select('defaults')
                    .eq('id', user.id)
                    .single();

                  const existingDefaults = profile?.defaults || {};
                  await supabase
                    .from('profiles')
                    .update({
                      defaults: {
                        ...existingDefaults,
                        pending_send_invoice_id: newInvoice.id,
                      }
                    })
                    .eq('id', user.id);

                  // 5. Create client entry if not present
                  if (clientName) {
                    await supabase
                      .from('clients')
                      .insert({
                        workspace_id: workspaceId,
                        user_id: user.id,
                        name: clientName,
                        email: clientEmail,
                      })
                      .select()
                      .maybeSingle();
                  }

                  console.log(`Auth Callback: Successfully claimed invoice ${newInvoice.id}`);
                } else {
                  console.error('Auth Callback: Failed to insert claimed invoice:', invErr);
                }
              }
            }
          } catch (claimErr) {
            console.error('Auth Callback: Exception during claim process:', claimErr);
          }
        }

        // Check if new user needs onboarding
        const { data: profile } = await supabase
          .from('profiles')
          .select('defaults')
          .eq('id', user.id)
          .single();

        if (!profile?.defaults?.onboarding_seen) {
          console.log('Auth Callback: New user, redirecting to onboarding.');
          return NextResponse.redirect(`${baseUrl}/onboarding`);
        }
      }

      console.log('Auth Callback: Redirecting to:', next);
      return NextResponse.redirect(`${baseUrl}${next}`);
    } else {
      console.error('Auth Callback Error:', error.message, error.status);
    }
  }

  console.error('Auth Callback: Failed to establish session. Redirecting.');
  
  if (next.includes('reset-password')) {
    return NextResponse.redirect(`${baseUrl}/forgot-password?error=auth-failed-pkce`);
  }

  return NextResponse.redirect(`${baseUrl}/login?error=auth-failed-pkce`);
}
