import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { resolvePlanAccess } from '@/lib/billing/tiers';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workspaceId, email, role } = await req.json();

    if (!workspaceId || !email || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['admin', 'member', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // 1. Verify user is owner or admin of the workspace
    const { data: memberRecord, error: memberError } = await supabase
      .from('workspace_members')
      .select('role, workspaces(owner_id)')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .single();

    if (memberError || !memberRecord || !['owner', 'admin'].includes(memberRecord.role)) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to invite members' }, { status: 403 });
    }

    // 2. Check if the workspace is owned by a profile with a business/admin tier
    const ownerId = Array.isArray(memberRecord.workspaces) 
      ? memberRecord.workspaces[0]?.owner_id 
      : (memberRecord.workspaces as any)?.owner_id;
    if (!ownerId) {
      return NextResponse.json({ error: 'Workspace owner not found' }, { status: 500 });
    }

    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('role, tier, subscription_status, subscription_period_end')
      .eq('id', ownerId)
      .single();

    const access = resolvePlanAccess(ownerProfile);

    // Free users can't invite
    if (access.effectiveTier === 'free' && !access.isAdmin) {
      return NextResponse.json({ error: 'Upgrade to Business tier to invite team members' }, { status: 403 });
    }

    // Pro users can't invite either based on typical SaaS limits, but let's check your specific rules.
    // The prompt says "only Business/Admin tiers" can invite.
    if (access.effectiveTier !== 'business' && !access.isAdmin) {
      return NextResponse.json({ error: 'Upgrade to Business tier to invite team members' }, { status: 403 });
    }

    // 3. See if user already exists in auth
    // Wait, we can't query auth.users from here directly easily unless using service role,
    // but we CAN check if they have a profile!
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    // 4. Insert into workspace_members (RLS will also double-check permissions)
    const newMemberData: any = {
      workspace_id: workspaceId,
      role: role,
      status: 'pending',
      invited_email: email
    };

    if (existingProfile) {
      newMemberData.user_id = existingProfile.id;
    }

    const { data: insertData, error: insertError } = await supabase
      .from('workspace_members')
      .insert(newMemberData)
      .select()
      .single();

    if (insertError) {
      console.error('Insert invite error:', insertError);
      if (insertError.code === '23505') { // Unique violation
        return NextResponse.json({ error: 'User is already in this workspace or has a pending invite' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Failed to invite user' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: insertData });
  } catch (err: any) {
    console.error('Invite error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
