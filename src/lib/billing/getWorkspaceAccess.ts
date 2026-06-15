import { SupabaseClient } from '@supabase/supabase-js';
import { resolvePlanAccess } from './tiers';
import { cookies } from 'next/headers';

export async function getActiveWorkspaceId(supabase: SupabaseClient) {
  const cookieStore = await cookies();
  const savedWorkspaceId = cookieStore.get('invopilot_active_workspace')?.value;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (savedWorkspaceId) {
    // Validate the cookie value — user must be an accepted member
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', savedWorkspaceId)
      .eq('status', 'accepted')
      .limit(1)
      .single();

    if (membership) return savedWorkspaceId;
  }

  // Fallback to first available workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('status', 'accepted')
    .limit(1)
    .single();

  return membership?.workspace_id || null;
}

export async function getWorkspaceAccess(supabase: SupabaseClient, workspaceId?: string | null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return resolvePlanAccess(null);
  
  const { data: currentUserProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  // Superadmins/Admins should always retain their global bypass, regardless of which workspace they are viewing
  if (currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'superadmin') {
    return resolvePlanAccess(currentUserProfile);
  }

  const activeWorkspaceId = workspaceId || await getActiveWorkspaceId(supabase);

  if (!activeWorkspaceId) {
    // If no workspace, fallback to current user
    return resolvePlanAccess(currentUserProfile);
  }

  // Find workspace owner
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', activeWorkspaceId)
    .single();

  if (!workspace?.owner_id) {
    return resolvePlanAccess(null);
  }

  // Fetch owner's billing profile
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', workspace.owner_id)
    .single();

  return resolvePlanAccess(ownerProfile);
}
