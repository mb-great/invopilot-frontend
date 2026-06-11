'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PendingInvite {
  id: string;
  role: string;
  workspaces: {
    name: string;
  };
}

interface PendingInvitesModalProps {
  invites: PendingInvite[];
  isOpen: boolean;
  onClose: () => void;
}

export default function PendingInvitesModal({ invites, isOpen, onClose }: PendingInvitesModalProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const router = useRouter();

  if (!isOpen || invites.length === 0) return null;

  const handleRespond = async (workspaceId: string, action: 'accept' | 'dismiss') => {
    setLoadingId(workspaceId);
    try {
      const res = await fetch('/api/workspaces/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: workspaceId, action }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to respond to invite');
      }

      toast.success(`Invite ${action === 'accept' ? 'accepted' : 'dismissed'} successfully`);
      
      // If we accepted, we probably want to switch to it, but for now just refresh
      if (invites.length === 1) {
        onClose();
      }
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 text-center border-b border-ink-100">
          <div className="w-12 h-12 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-ink-900">Pending Workspace Invites</h2>
          <p className="text-sm text-ink-500 mt-2">
            You have been invited to join the following workspaces.
          </p>
        </div>
        
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {invites.map((invite) => (
            <div key={invite.id} className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-ink-200 rounded-xl bg-ink-50">
              <div className="text-center sm:text-left">
                <p className="font-bold text-ink-900">{Array.isArray(invite.workspaces) ? invite.workspaces[0]?.name : (invite.workspaces?.name || 'Unknown Workspace')}</p>
                <p className="text-xs text-ink-500">Role: <span className="uppercase font-semibold">{invite.role}</span></p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRespond(invite.id, 'dismiss')}
                  disabled={loadingId === invite.id}
                  className="p-2 text-ink-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors disabled:opacity-50"
                  title="Dismiss Invite"
                >
                  <XCircle className="w-6 h-6" />
                </button>
                <button
                  onClick={() => handleRespond(invite.id, 'accept')}
                  disabled={loadingId === invite.id}
                  className="p-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-50"
                  title="Accept Invite"
                >
                  <CheckCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-4 bg-ink-50 border-t border-ink-100 text-center">
          <button 
            onClick={onClose}
            className="text-sm font-bold text-ink-500 hover:text-ink-700"
          >
            I'll review these later
          </button>
        </div>
      </div>
    </div>
  );
}
