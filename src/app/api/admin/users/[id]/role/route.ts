import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 });
  }

  // 3. Parse body
  const body = await request.json();
  const newRole = body.role;

  if (!['admin', 'user'].includes(newRole)) {
    return NextResponse.json({ error: 'Invalid role. Must be "admin" or "user".' }, { status: 400 });
  }

  // 4. Prevent self-demotion (safety: don't lock yourself out)
  if (targetUserId === user.id && newRole === 'user') {
    return NextResponse.json({ error: 'Cannot demote yourself.' }, { status: 400 });
  }

  // 5. Update target user's role
  const { data, error } = await supabase
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
