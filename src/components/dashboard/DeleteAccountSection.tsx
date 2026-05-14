'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Trash2 } from 'lucide-react';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

export default function DeleteAccountSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleDelete = async (password: string) => {
    try {
      const res = await fetch('/api/user/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to delete account');
      }

      alert("Your account has been permanently deleted.");
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsModalOpen(false);
    }
  };

  return (
    <>
      <section className="glass-card p-8 border-red-500/20 bg-red-500/5">
        <h3 className="text-xl font-bold mb-4 text-red-500 flex items-center gap-2">
          <Trash2 className="w-5 h-5" /> Danger Zone
        </h3>
        <p className="text-sm text-red-600/70 mb-6 leading-relaxed">
          Permanently delete your account. This removes your profile and login access. 
          All your invoices will be deleted. You can sign up again later with the same email.
        </p>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-2 border border-red-500/50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest flex items-center gap-2"
        >
          Delete Account Permanently
        </button>
      </section>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDelete}
        title="Permanent Deletion"
        message="⚠️ WARNING: This will permanently delete your login, profile, and all generated invoices. This action cannot be undone. You will be able to sign up again with the same email as a fresh user."
        confirmLabel="Delete Everything"
        isDestructive={true}
      />
    </>
  );
}
