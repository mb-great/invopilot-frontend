import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  const supabase = await createClient();
  
  // 1. Get current session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Parse password
  const { password } = await request.json();
  if (!password) return NextResponse.json({ error: 'Password required' }, { status: 400 });

  // 3. Re-verify by attempting a sign-in
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password,
  });

  if (verifyError) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  // 4. Create Admin Client
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 5. Fetch metrics to archive
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { count: invoiceCount } = await supabaseAdmin
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('deleted_at', null);

  // 6. Archive metrics
  await supabaseAdmin.from('deleted_accounts_archive').insert({
    original_user_id: user.id,
    email: user.email!,
    full_name: profile?.full_name,
    total_invoices: invoiceCount || 0,
    last_active_at: new Date().toISOString(),
    reason: 'User self-deletion (90-day grace period)'
  });

  // 7. Soft Delete: rename email in auth (frees original for re-signup)
  const timestamp = Math.floor(Date.now() / 1000);
  const [localPart, domain] = user.email!.split('@');
  const deletedEmail = `${localPart}+deleted${timestamp}@${domain}`;

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    email: deletedEmail,
    user_metadata: { ...user.user_metadata, deleted_at: new Date().toISOString(), original_email: user.email }
  });

  if (authError) {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }

  // 8. Soft delete profile (keeps data for 90 days, cron handles hard delete)
  await supabaseAdmin
    .from('profiles')
    .update({ 
      deleted_at: new Date().toISOString(),
      email: deletedEmail
    })
    .eq('id', user.id);

  // 9. Soft delete all invoices (keeps PDFs in storage for 90 days)
  await supabaseAdmin
    .from('invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('deleted_at', null);

  // 10. Soft delete clients and recurring templates
  await supabaseAdmin
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('deleted_at', null);

  await supabaseAdmin
    .from('recurring_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('deleted_at', null);

  return NextResponse.json({ 
    success: true, 
    message: 'Account scheduled for deletion. Your data will be retained for 90 days. Sign up again to restore.' 
  });
}
