'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002'
  const supabase = createClient();
  const router = useRouter();

  // No need for checkSession here as the backend set-password endpoint handles the step-cookie check.
  // If the cookie is missing, the request will fail and we can redirect then.

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/signup/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');

      // Set session in Supabase client
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });

      setMessage({ type: 'success', text: 'Password reset successful! Redirecting...' });
      
      // Clear fields
      setPassword('');
      setConfirmPassword('');

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'error', text: msg });
      if (msg.includes('expired')) {
        setTimeout(() => router.push('/forgot-password'), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-ink-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-12">
          <img src="/logo.png" alt="InvoPilot Logo" className="w-10 h-10 object-contain drop-shadow-sm" />
          <span className="font-bold text-xl tracking-tight text-ink-900">InvoPilot</span>
        </div>

        <div className="glass-card p-8 bg-white shadow-xl rounded-2xl border border-ink-100">
          <h1 className="text-3xl font-bold mb-2 text-ink-900 tracking-tight">
            Reset <span className="headline-accent italic text-brand-500 font-serif">Password</span>
          </h1>
          <p className="text-ink-500 mb-8">Enter your new secure password below.</p>

          <form onSubmit={handleUpdatePassword} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">New Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-ink-200 px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all bg-white"
                placeholder="Min 6 characters"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink-700 mb-2">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-ink-200 px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all bg-white"
                placeholder="Confirm your new password"
                required
              />
            </div>

            {message && (
              <p className={`text-sm text-center font-bold ${message.type === 'success' ? 'text-emerald-600' : 'text-red-500'}`}>
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink-900 hover:bg-ink-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Save New Password'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
