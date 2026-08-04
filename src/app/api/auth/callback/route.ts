import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFrontendUrl, getBackendUrl } from '@/lib/url';

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
        let claimedInvoiceId = null;

        // If a pending invoice token was passed, delegate claim to backend
        if (token) {
          try {
            console.log(`Auth Callback: Delegating claim of token ${token} to backend for user ${user.id}`);
            
            const backendUrl = getBackendUrl();
            const claimRes = await fetch(`${backendUrl}/api/funnel/claim`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Worker-Secret': process.env.WORKER_SECRET || '',
              },
              body: JSON.stringify({ token, userId: user.id }),
            });

            const claimData = await claimRes.json();

            if (claimRes.ok) {
              if (claimData.deferred) {
                console.log('Auth Callback: Claim deferred (new user, no workspace yet).');
              } else {
                console.log(`Auth Callback: Invoice ${claimData.invoiceId} claimed, PDF queued.`);
                claimedInvoiceId = claimData.invoiceId;
              }
            } else {
              console.error('Auth Callback: Claim failed:', claimData.error);
            }
          } catch (claimErr) {
            console.error('Auth Callback: Exception during claim:', claimErr);
          }
        }

        // Check if new user needs onboarding (and update defaults with the claimed invoice ID if any)
        const { data: profile } = await supabase
          .from('profiles')
          .select('defaults')
          .eq('id', user.id)
          .single();

        let updatedDefaults = profile?.defaults || {};
        let needsUpdate = false;

        // If we successfully claimed an invoice, store its ID for the onboarding card
        if (claimedInvoiceId) {
          updatedDefaults = { ...updatedDefaults, pending_send_invoice_id: claimedInvoiceId };
          needsUpdate = true;
        }

        if (needsUpdate) {
          await supabase
            .from('profiles')
            .update({ defaults: updatedDefaults })
            .eq('id', user.id);
        }

        // Check if user already submitted a beta application modal with this email
        if (user.email) {
          try {
            const { data: betaApp } = await supabase
              .from('beta_applications')
              .select('id')
              .eq('email', user.email.toLowerCase().trim())
              .maybeSingle();

            if (betaApp) {
              console.log(`Auth Callback: Matching beta application found for ${user.email}, linking.`);
              await supabase
                .from('profiles')
                .update({ beta_applied: true })
                .eq('id', user.id);
            }
          } catch (e) {
            console.warn('Auth Callback: Error checking beta application:', e);
          }
        }

        // Dispatch welcome email for new account signups (guarded by welcome_email_sent in backend)
        const backendUrl = getBackendUrl();
        fetch(`${backendUrl}/api/funnel/welcome`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Worker-Secret': process.env.WORKER_SECRET || '',
          },
          body: JSON.stringify({
            userId: user.id,
            name: user.user_metadata?.full_name || user.user_metadata?.name || undefined,
          }),
        }).catch(err => {
          console.warn('Auth Callback: Error triggering welcome email:', err);
        });

        // Funnel Claim Flow: skip onboarding for Session 1 so the user lands straight on dashboard with their invoice
        if (token) {
          console.log(`Auth Callback: Funnel claim token ${token} detected. Redirecting straight to dashboard.`);
          const separator = next.includes('?') ? '&' : '?';
          return NextResponse.redirect(`${baseUrl}/dashboard?claim=${token}`);
        }

        // Direct / returning users: if onboarding not completed, route to /onboarding
        if (!updatedDefaults?.onboarding_seen) {
          console.log('Auth Callback: New user, redirecting to onboarding.');
          return NextResponse.redirect(`${baseUrl}/onboarding`);
        }

        // Returning user — add ?returning=true for welcome back notification
        const separator = next.includes('?') ? '&' : '?';
        const redirectUrl = `${baseUrl}${next}`;

        console.log('Auth Callback: Redirecting to:', redirectUrl);
        return NextResponse.redirect(redirectUrl);
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
