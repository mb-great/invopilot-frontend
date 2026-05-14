'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

function VerifyOtpContent() {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const email = searchParams.get('email') || '';
  const type = (searchParams.get('type') as 'recovery' | 'signup' | 'invite' | 'magiclink') || 'recovery';

  useEffect(() => {
    if (!email) {
      router.push('/login');
    }
  }, [email, router]);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otp || otp.length < 6) return setError('Please enter the 6-digit code.');
    
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type,
    });

    if (error) {
      setError(error.message);
    } else {
      // If recovery, go to reset-password. Otherwise go to dashboard.
      if (type === 'recovery') {
        router.push('/reset-password');
      } else {
        router.push('/dashboard');
      }
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-ink-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-12">
          <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <span className="text-white font-bold text-xl italic">I</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-ink-900">InvoPilot</span>
        </div>

        <div className="glass-card p-8 bg-white shadow-xl rounded-2xl border border-ink-100">
          <h1 className="text-3xl font-bold mb-2 text-ink-900 tracking-tight">
            Verify <span className="headline-accent italic text-brand-500 font-serif">Code</span>
          </h1>
          <p className="text-ink-500 mb-8">
            We sent a 6-digit code to <span className="font-bold text-ink-900">{email}</span>. 
            Enter it below to continue.
          </p>

          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label className="block text-xs uppercase font-bold text-muted mb-2 tracking-widest">Verification Code</label>
              <input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-xl border border-ink-200 px-4 py-4 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all bg-white font-mono tracking-[0.5em] text-center text-2xl"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-center font-bold text-red-500">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-ink-900 hover:bg-ink-800 text-white font-bold py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-xs"
            >
              {loading ? 'Verifying...' : 'Continue'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-ink-400 leading-relaxed">
            Link in the email not working? <br/>
            Type the 6-digit code manually to bypass security scanners.
          </p>
        </div>

        <button 
          onClick={() => router.push('/login')}
          className="w-full mt-8 text-sm text-ink-500 hover:text-ink-900 font-medium transition-colors"
        >
          ← Back to login
        </button>
      </div>
    </main>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={null}>
      <VerifyOtpContent />
    </Suspense>
  );
}
