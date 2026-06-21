'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Building, User, ChevronDown, Check, Clock, CheckCircle, XCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function GlobalWorkspaceSwitcher({ className = '' }: { className?: string }) {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get active workspace from cookie
      const cookies = document.cookie.split(';');
      const activeCookie = cookies.find(c => c.trim().startsWith('invopilot_active_workspace='));
      const activeId = activeCookie ? activeCookie.split('=')[1] : null;

      // Fetch accepted workspaces
      const { data: acceptedData } = await supabase
        .from('workspace_members')
        .select('workspaces(*)')
        .eq('user_id', user.id)
        .eq('status', 'accepted');
        
      let parsedWorkspaces = acceptedData?.map(m => Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces) || [];
      
      // Filter out nulls
      parsedWorkspaces = parsedWorkspaces.filter(Boolean);
      
      setWorkspaces(parsedWorkspaces);
      if (activeId && parsedWorkspaces.some(w => w.id === activeId)) {
        setActiveWorkspaceId(activeId);
      } else if (parsedWorkspaces.length > 0) {
        setActiveWorkspaceId(parsedWorkspaces[0].id);
      }

      // Fetch pending invites
      const { data: pendingData } = await supabase
        .from('workspace_members')
        .select('id, role, status, workspaces(id, name)')
        .or(`user_id.eq.${user.id},invited_email.eq.${user.email}`)
        .eq('status', 'pending');

      if (pendingData) {
        setInvites(pendingData);
      }
    }
    
    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (workspaceId: string) => {
    document.cookie = `invopilot_active_workspace=${workspaceId}; path=/; max-age=31536000`; // 1 year
    setIsOpen(false);
    setActiveWorkspaceId(workspaceId);
    
    const url = new URL(window.location.href);
    url.searchParams.delete('business');
    router.push(url.pathname + url.search);
    router.refresh();
  };

  const handleRespond = async (inviteId: string, action: 'accept' | 'dismiss') => {
    setLoadingId(inviteId);
    try {
      const res = await fetch('/api/workspaces/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId, action }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to respond to invite');
      }

      toast.success(`Invite ${action === 'accept' ? 'accepted' : 'dismissed'} successfully`);
      setIsOpen(false);
      
      // Delay slightly and refresh the page to load the new workspace completely
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
      setLoadingId(null);
    }
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  if (!activeWorkspace) return null;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-between gap-2 px-3 py-2 bg-white border border-ink-200 rounded-lg shadow-sm hover:bg-ink-50 transition-colors w-full min-w-0"
      >
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {activeWorkspace.owner_id ? <User className="w-4 h-4 text-ink-500 shrink-0" /> : <Building className="w-4 h-4 text-ink-500 shrink-0" />}
          <span className="text-sm font-bold text-ink-900 truncate">
            {activeWorkspace.displayName || activeWorkspace.name || 'Workspace'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-ink-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        
        {invites.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white shadow-sm animate-pulse">
            {invites.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[min(280px,calc(100vw-2rem))] bg-white border border-ink-150 rounded-xl shadow-xl z-[150] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          
          {/* Workspaces Section */}
          <div className="px-3 py-2 border-b border-ink-100 bg-ink-50/50 flex items-center justify-between">
            <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">Switch Workspace</span>
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSelect(ws.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors min-w-0 gap-2 ${
                  activeWorkspaceId === ws.id ? 'bg-brand-50 text-brand-900' : 'hover:bg-ink-50 text-ink-700'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {ws.owner_id ? <User className="w-4 h-4 text-ink-400 shrink-0" /> : <Building className="w-4 h-4 text-ink-400 shrink-0" />}
                  <span className="text-sm font-medium truncate block">{ws.displayName || ws.name}</span>
                </div>
                {activeWorkspaceId === ws.id && <Check className="w-4 h-4 text-brand-600 shrink-0" />}
              </button>
            ))}
          </div>

          {/* Pending Invites Section */}
          {invites.length > 0 && (
            <>
              <div className="px-3 py-2 border-y border-ink-100 bg-amber-50/50 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Pending Invites</span>
              </div>
              <div className="max-h-48 overflow-y-auto p-1 bg-amber-50/30">
                {invites.map((invite) => (
                  <div key={invite.id} className="flex flex-col gap-2 p-2 border border-ink-100 rounded-lg mb-1 last:mb-0 bg-white">
                    <div className="flex items-center gap-2 truncate">
                      <Building className="w-3.5 h-3.5 text-brand-500 shrink-0" />
                      <span className="text-sm font-bold text-ink-900 truncate">
                        {Array.isArray(invite.workspaces) ? invite.workspaces[0]?.name : (invite.workspaces?.name || 'Workspace')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-ink-500 px-1.5 py-0.5 bg-ink-100 rounded">{invite.role}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleRespond(invite.id, 'dismiss')}
                          disabled={loadingId === invite.id}
                          className="px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleRespond(invite.id, 'accept')}
                          disabled={loadingId === invite.id}
                          className="px-2 py-1 text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 rounded transition-colors disabled:opacity-50"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
