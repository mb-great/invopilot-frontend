import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inviteId, action } = await req.json();

    if (!inviteId || !['accept', 'dismiss'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Fetch the pending invite
    const { data: invite, error: inviteError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('id', inviteId)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invite not found or already processed' }, { status: 404 });
    }

    // Verify the invite belongs to this user (either by user_id or by email)
    if (invite.user_id !== user.id && invite.invited_email !== user.email) {
      return NextResponse.json({ error: 'Forbidden: Invite belongs to another user' }, { status: 403 });
    }

    if (action === 'dismiss') {
      const { error: deleteError } = await supabase
        .from('workspace_members')
        .delete()
        .eq('id', inviteId);

      if (deleteError) {
        return NextResponse.json({ error: 'Failed to dismiss invite' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Invite dismissed' });
    } else if (action === 'accept') {
      const { error: updateError } = await supabase
        .from('workspace_members')
        .update({ 
          status: 'accepted',
          user_id: user.id // Ensure user_id is populated if it was only invited by email
        })
        .eq('id', inviteId);

      if (updateError) {
        return NextResponse.json({ error: 'Failed to accept invite' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Invite accepted' });
    }
  } catch (err: any) {
    console.error('Respond invite error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
