import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const memberId = params.id;
    if (!memberId) {
      return NextResponse.json({ error: 'Missing member ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First fetch the member record to find the workspace_id
    const { data: targetMember, error: targetError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, user_id')
      .eq('id', memberId)
      .single();

    if (targetError || !targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // You cannot delete an owner
    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove the workspace owner' }, { status: 403 });
    }

    // Check if current user is owner or admin of this workspace
    const { data: currentMember, error: currentError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', targetMember.workspace_id)
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .single();

    if (currentError || !currentMember || !['owner', 'admin'].includes(currentMember.role)) {
      // Allow users to leave the workspace themselves
      if (targetMember.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden: You do not have permission to remove members' }, { status: 403 });
      }
    }

    // Proceed to delete
    const { error: deleteError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId);

    if (deleteError) {
      console.error('Failed to remove member:', deleteError);
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Remove member error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
