'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

export default function PasswordSettings({ userEmail }: { userEmail?: string }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const searchParams = useSearchParams();
  const isRecovery = searchParams.get('recovery') === 'true';
  const supabase = createClient();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // 1. If not in recovery mode, verify the current password first
      if (!isRecovery && userEmail) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: currentPassword,
        });

        if (signInError) {
          throw new Error('Current password incorrect. Please try again.');
        }
      }

      // 2. Update to the new password
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw updateError;
      }

      setMessage({ type: 'success', text: 'Password updated successfully.' });
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <h4 className="font-bold mb-4 text-ink-800">Security</h4>
      <p className="text-xs text-muted mb-6 leading-relaxed">
        {isRecovery 
          ? "Establish your new password to regain access to your account."
          : "Update your password regularly to keep your invoices secure."
        }
      </p>

      <form onSubmit={handleUpdatePassword} className="space-y-4">
        {!isRecovery && (
          <div>
            <label className="block text-[10px] uppercase font-bold text-muted mb-1 tracking-widest">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition-colors"
              placeholder="Enter old password"
              required
            />
          </div>
        )}

        <div>
          <label className="block text-[10px] uppercase font-bold text-muted mb-1 tracking-widest">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition-colors"
            placeholder="Min 6 characters"
            required
            minLength={6}
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-muted mb-1 tracking-widest">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition-colors"
            placeholder="Confirm new password"
            required
          />
        </div>

        {message && (
          <p className={`text-[11px] font-bold ${message.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-ink-900 text-white text-xs font-bold uppercase tracking-widest rounded-xl hover:bg-ink-800 transition-all disabled:opacity-50 shadow-lg shadow-black/10"
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
