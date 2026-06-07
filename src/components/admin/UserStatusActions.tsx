'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, UserCheck, Trash2, Loader2 } from 'lucide-react';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { toast } from 'sonner';

export default function UserStatusActions({ 
  userId, 
  initialBanned, 
  initialDeleted 
}: { 
  userId: string, 
  initialBanned: boolean, 
  initialDeleted: boolean 
}) {
  const [banned, setBanned] = useState(initialBanned);
  const [deleted, setDeleted] = useState(initialDeleted);
  const [loading, setLoading] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    action: 'ban' | 'delete';
    title: string;
    message: string;
    confirmLabel: string;
  }>({
    isOpen: false,
    action: 'ban',
    title: '',
    message: '',
    confirmLabel: ''
  });

  const router = useRouter();

  const handleAction = async (password: string) => {
    const action = modalConfig.action;

    // Verify Password first
    try {
      const verifyRes = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!verifyRes.ok) {
        toast.error("Invalid admin password. Action cancelled.");
        return;
      }
    } catch (err) {
      toast.error("Verification failed. Please try again.");
      return;
    }

    // Perform Action
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (!res.ok) throw new Error('Action failed');

      if (action === 'ban') setBanned(true);
      if (action === 'delete') {
        setDeleted(true);
        toast.success("User account and data have been permanently deleted.");
        router.push('/admin'); // Redirect away from deleted user detail
      }

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setModalConfig({ ...modalConfig, isOpen: false });
    }
  };

  const openModal = (action: 'ban' | 'delete') => {
    const config = action === 'ban' 
      ? {
          action,
          title: 'Ban User',
          message: '⚠️ WARNING: Banning a user will block their access immediately. This affects client trust and should only be used for severe violations.',
          confirmLabel: 'Ban User'
        }
      : {
          action,
          title: 'Permanent Deletion',
          message: '⚠️ WARNING: This will permanently delete the user account and ALL their invoice data. This is irreversible. Final metrics will be archived.',
          confirmLabel: 'Delete Everything'
        };
    
    setModalConfig({ ...config, isOpen: true });
  };

  const handleUnban = async () => {
    if (!confirm('Are you sure you want to UNBAN this user?')) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unban' })
      });
      if (res.ok) setBanned(false);
      router.refresh();
    } catch (err) {
      toast.error('Failed to unban');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-ink-400" />;

  return (
    <div className="flex gap-2">
      {banned ? (
        <button 
          onClick={handleUnban}
          className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold uppercase tracking-widest border border-emerald-100 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-2"
        >
          <UserCheck className="w-3 h-3" /> Unban User
        </button>
      ) : (
        <button 
          onClick={() => openModal('ban')}
          className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold uppercase tracking-widest border border-red-100 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
        >
          <Ban className="w-3 h-3" /> Ban User
        </button>
      )}

      {!deleted && (
        <button 
          onClick={() => openModal('delete')}
          className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold uppercase tracking-widest border border-red-100 hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
        >
          <Trash2 className="w-3 h-3" /> Delete User
        </button>
      )}

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onConfirm={handleAction}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmLabel={modalConfig.confirmLabel}
        isDestructive={true}
      />
    </div>
  );
}
