import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  
  // 1. Verify admin role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 2. Fetch audit transactions for target user
  const { data, error } = await supabase
    .from('audit_transactions')
    .select(`
      id,
      action,
      tier,
      reason,
      valid_until,
      amount,
      currency,
      created_at,
      admin:profiles!admin_id(email, full_name)
    `)
    .eq('user_id', id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch user audit logs error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
