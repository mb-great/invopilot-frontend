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

      alert("Your account has been scheduled for deletion. You can restore your data by signing up again with the same email within 90 days.");
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
          Schedule your account for deletion. This will remove your profile and login access. 
          Your data is retained for 90 days if you wish to restore it by signing up again.
        </p>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-2 border border-red-500/50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest flex items-center gap-2"
        >
          Delete Account
        </button>
      </section>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleDelete}
        title="Account Deletion"
        message="⚠️ Proceed with account deletion? Your invoices and profile will be hidden and scheduled for removal in 90 days. You can sign up again later with the same email to restore your history."
        confirmLabel="Confirm Deletion"
        isDestructive={true}
      />
    </>
  );
}
