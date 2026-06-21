import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify admin role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Query directly from Supabase (bypasses the backend)
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const level = searchParams.get('level');
  const source = searchParams.get('source');

  let query = supabase
    .from('error_logs')
    .select('id, level, source, message, stack, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (level) query = query.eq('level', level);
  if (source) query = query.eq('source', source);

  const { data: logs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: logs || [] });
}
