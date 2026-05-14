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

  // 4. Fetch metrics to archive
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { count: invoiceCount } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  // 5. Create Admin Client
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 6. Archive metrics
  await supabaseAdmin.from('deleted_accounts_archive').insert({
    original_user_id: user.id,
    email: user.email!,
    full_name: profile?.full_name,
    total_invoices: invoiceCount || 0,
    last_active_at: new Date().toISOString(),
    reason: 'User self-deletion'
  });

  // 7. Hard Delete Invoices (to prevent bloat)
  await supabaseAdmin.from('invoices').delete().eq('user_id', user.id);

  // 8. Hard delete the user from auth.users (cascades to public.profiles)
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
