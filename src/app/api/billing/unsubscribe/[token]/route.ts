import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/ratelimit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // Rate limit: 5 requests per 10 minutes per IP
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 5, 10 * 60_000)) {
    return new NextResponse('Too many requests', { status: 429 });
  }

  const { token } = await params;

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ purchase_reminders_enabled: false })
    .eq('purchase_reminder_unsubscribe_token', token)
    .select('id')
    .maybeSingle();

  const ok = !error && !!data;
  const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>InvoPilot reminders</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f4ef; color: #161b25; }
          main { max-width: 520px; padding: 32px; background: #fff; border: 1px solid #e8dfd2; border-radius: 12px; box-shadow: 0 20px 60px rgba(22,27,37,.08); }
          h1 { margin: 0 0 12px; font-size: 28px; }
          p { line-height: 1.55; color: #526070; }
        </style>
      </head>
      <body>
        <main>
          <h1>${ok ? 'Purchase reminders off' : 'Link not found'}</h1>
          <p>${ok
            ? 'You will no longer receive subscription purchase reminder emails. Billing/account notices still send when required.'
            : 'This unsubscribe link is invalid or already unavailable.'}</p>
        </main>
      </body>
    </html>`;

  return new NextResponse(html, {
    status: ok ? 200 : 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
