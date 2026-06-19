import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

async function verifyWorkspaceMember(supabase: any, userId: string, workspaceId: string, requireAdmin = false) {
  const { data: member, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .single();

  if (error || !member) return false;
  if (requireAdmin && !['owner', 'admin'].includes(member.role)) return false;
  return true;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) {
    return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 });
  }

  if (!await verifyWorkspaceMember(supabase, user.id, workspaceId)) {
    return NextResponse.json({ data: [] });
  }

  const { data: apiKeys, error } = await supabase
    .from('api_keys')
    .select('id, name, prefix, last_used_at, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: apiKeys });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, workspaceId } = body;

  if (!name || !workspaceId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!await verifyWorkspaceMember(supabase, user.id, workspaceId, true)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Generate secure key: inv_prod_ + 32 random hex chars
  const rawKey = `inv_prod_${crypto.randomBytes(24).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const prefix = rawKey.substring(0, 15) + '...';

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      name,
      key_hash: keyHash,
      prefix
    })
    .select('id, name, prefix, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, rawKey }, { status: 201 });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const workspaceId = searchParams.get('workspaceId');

  if (!id || !workspaceId) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  if (!await verifyWorkspaceMember(supabase, user.id, workspaceId, true)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
