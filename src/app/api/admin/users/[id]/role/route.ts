import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  const supabase = await createClient();

  // 1. Verify caller is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Verify caller is admin
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (callerProfile?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden — only superadmin can change roles' }, { status: 403 });
  }

  // 2.5 Verify target is not superadmin (unless caller is superadmin)
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', targetUserId)
    .single();

  if (targetProfile?.role === 'superadmin' && callerProfile?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden — cannot modify superadmin' }, { status: 403 });
  }

  // 3. Parse body
  const body = await request.json();
  const newRole = body.role;

  if (!['admin', 'user', 'superadmin'].includes(newRole)) {
    return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
  }

  // 4. Prevent self-demotion (safety: don't lock yourself out)
  if (targetUserId === user.id && newRole === 'user') {
    return NextResponse.json({ error: 'Cannot demote yourself.' }, { status: 400 });
  }

  // 5. Update target user's role
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ role: newRole })
    .eq('id', targetUserId)
    .select('id, email, role')
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
  }

  return NextResponse.json({ data, status: 'ok' });
}
