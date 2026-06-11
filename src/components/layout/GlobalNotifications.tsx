'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import PendingInvitesModal from '@/components/dashboard/PendingInvitesModal';

export default function GlobalNotifications() {
  const [invites, setInvites] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvites() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from('workspace_members')
          .select('id, role, status, workspaces(id, name)')
          .or(`user_id.eq.${user.id},invited_email.eq.${user.email}`)
          .eq('status', 'pending');

        if (data && data.length > 0) {
          setInvites(data);
          
          // Auto-pop logic (once per session)
          const hasSeen = sessionStorage.getItem('invopilot_seen_invites');
          if (!hasSeen) {
            setIsModalOpen(true);
            sessionStorage.setItem('invopilot_seen_invites', 'true');
          }
        }
      } catch (err) {
        console.error('Error fetching invites:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchInvites();
  }, []);

  if (loading || invites.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="relative p-2 text-ink-500 hover:bg-ink-100 rounded-full transition-colors flex items-center justify-center"
        title="Pending Invites"
      >
        <Bell className="w-5 h-5" />
        <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-sm border border-white" />
      </button>

      {/* Reusing the Modal, but we control the open state from here now */}
      <PendingInvitesModal 
        invites={invites} 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
