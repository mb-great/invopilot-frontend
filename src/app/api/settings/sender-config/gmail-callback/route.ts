import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const getFrontendUrl = () => process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3001';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const frontendUrl = getFrontendUrl();

  if (!code) {
    return NextResponse.redirect(`${frontendUrl}/dashboard/settings?gmail=error`);
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(`${frontendUrl}/login`);
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${frontendUrl}/api/settings/sender-config/gmail-callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      console.error('Gmail token exchange failed:', await tokenResponse.text());
      return NextResponse.redirect(`${frontendUrl}/dashboard/settings?gmail=error`);
    }

    const tokens = await tokenResponse.json();

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    const { error } = await supabase
      .from('user_sender_config')
      .upsert(
        {
          user_id: user.id,
          method: 'gmail',
          gmail_access_token: tokens.access_token,
          gmail_refresh_token: tokens.refresh_token,
          gmail_email: userInfo.email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Failed to save Gmail config:', error.message);
      return NextResponse.redirect(`${frontendUrl}/dashboard/settings?gmail=error`);
    }

    return NextResponse.redirect(`${frontendUrl}/dashboard/settings?gmail=connected`);
  } catch (err) {
    console.error('Gmail callback error:', err);
    return NextResponse.redirect(`${frontendUrl}/dashboard/settings?gmail=error`);
  }
}
