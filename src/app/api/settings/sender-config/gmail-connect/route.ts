import { NextResponse } from 'next/server';
import { getFrontendUrl } from '@/lib/url';

export async function GET() {
  const frontendUrl = getFrontendUrl();
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  const redirectUri = `${frontendUrl}/api/settings/sender-config/gmail-callback`;

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/gmail.send',
  ].join(' ');

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      access_type: 'offline',
      prompt: 'consent',
    }).toString();

  return NextResponse.redirect(googleAuthUrl);
}
