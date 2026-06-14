import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function getActiveWorkspaceId(userId: string): Promise<string> {
  const cookieStore = await cookies();
  const activeWorkspaceCookie = cookieStore.get('invopilot_active_workspace')?.value;
  
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspaces!inner(id, owner_id)')
    .eq('user_id', userId)
    .eq('status', 'accepted');
    
  const workspaces = (memberships || []).map((m: any) => m.workspaces).filter(Boolean);
  
  if (activeWorkspaceCookie && workspaces.some((w: any) => w.id === activeWorkspaceCookie)) {
    return activeWorkspaceCookie;
  }
  
  const personal = workspaces.find((w: any) => w.owner_id === userId);
  return personal?.id || workspaces[0]?.id;
}
