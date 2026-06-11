import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  const { action } = await request.json();

  const supabase = await createClient();
  const { data: { user: adminUser } } = await supabase.auth.getUser();
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify admin status
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', adminUser.id)
    .single();

  if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify target is not superadmin
  const { data: targetProfileAuth } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', targetUserId)
    .single();

  if (targetProfileAuth?.role === 'superadmin') {
    return NextResponse.json({ error: 'Forbidden — Superadmins cannot be banned or deleted via the UI.' }, { status: 403 });
  }

  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (action === 'ban') {
    // 8760h = 1 year. This is how you actually ban in Supabase Auth.
    await supabaseAdmin.auth.admin.updateUserById(targetUserId, { ban_duration: '8760h' }); 
    await supabaseAdmin.from('profiles').update({ is_banned: true }).eq('id', targetUserId);
  } else if (action === 'unban') {
    await supabaseAdmin.auth.admin.updateUserById(targetUserId, { ban_duration: 'none' });
    await supabaseAdmin.from('profiles').update({ is_banned: false }).eq('id', targetUserId);
  } else if (action === 'delete') {
    // 1. Fetch metrics for archive
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .single();

    const { count: invoiceCount } = await supabaseAdmin
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', targetUserId);

    // 2. Archive
    await supabaseAdmin.from('deleted_accounts_archive').insert({
      original_user_id: targetUserId,
      email: targetProfile?.email || 'unknown',
      full_name: targetProfile?.full_name,
      total_invoices: invoiceCount || 0,
      last_active_at: targetProfile?.updated_at,
      reason: 'Admin-initiated deletion'
    });

    // 3. Wipe Data via Soft Deletion
    await supabaseAdmin.from('invoices').update({ deleted_at: new Date().toISOString() }).eq('user_id', targetUserId);

    // 4. Soft Delete Account
    // We ban the user to revoke access and mark the profile as deleted. A 90-day retention worker will handle the hard delete.
    await supabaseAdmin.auth.admin.updateUserById(targetUserId, { ban_duration: '8760h' });
    await supabaseAdmin.from('profiles').update({ is_banned: true, deleted_at: new Date().toISOString() }).eq('id', targetUserId);
  }

  return NextResponse.json({ success: true });
}
