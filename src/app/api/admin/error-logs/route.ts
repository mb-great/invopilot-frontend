import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

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
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
  const level = searchParams.get('level');
  const source = searchParams.get('source');
  const daysParam = searchParams.get('days') || '7'; // Default to last 7 days

  let query = supabase
    .from('error_logs')
    .select('id, level, source, message, stack, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (daysParam !== 'all') {
    const days = parseInt(daysParam, 10) || 7;
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', sinceDate);
  }

  if (level) query = query.eq('level', level);
  if (source) query = query.eq('source', source);

  const { data: logs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: logs || [] });
}

export async function DELETE(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  let error;
  if (id) {
    const res = await supabaseAdmin.from('error_logs').delete().eq('id', id);
    error = res.error;
  } else {
    // Purge all error logs
    const res = await supabaseAdmin.from('error_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    error = res.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
