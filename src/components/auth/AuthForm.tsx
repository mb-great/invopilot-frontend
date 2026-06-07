'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Mail, Lock, User, ShieldCheck } from 'lucide-react'
import { getBackendUrl } from '@/lib/url'

const BACKEND_URL = getBackendUrl();

function AuthFormContent({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [step, setStep] = useState<'email' | 'verify' | 'profile'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()



  const isLogin = mode === 'login'

  // Step 0: Check for stray 'code' (Magic Link) parameters
  useEffect(() => {
    const code = searchParams.get('code')
    if (code) {
      setError('Invalid login method detected. Our system requires an 8-digit code for security. Please request a new code below.')
    }
  }, [searchParams])

  // Step 1: Send OTP via Backend Proxy
  const handleSendOtp = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/signup/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');

      setSuccess('8-digit code sent to your email.');
      setStep('verify')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Verify OTP via Backend Proxy
  const handleVerifyOtp = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const endpoint = isLogin ? '/api/auth/forgot-password/verify' : '/api/auth/signup/verify-otp';
      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), token: otpCode }),
        // Important: allow step-cookie to be set
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'OTP_EXPIRED') {
          throw new Error('Code expired. Please request a new one.');
        }
        throw new Error(data.error || 'Verification failed');
      }

      setStep('profile')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // Step 3: Complete Profile via Backend Proxy
  const handleCompleteProfile = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/signup/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, fullName }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to set password');

      // Set session in Supabase client
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      });

      if (sessionError) throw sessionError;

      router.push('/onboarding')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // Legacy Login with Password
  const handlePasswordLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message);
      } else {
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : '') || 'An unexpected error occurred during sign in');
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLogin) {
      await handlePasswordLogin()
    } else {
      await handleSendOtp()
    }
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        queryParams: {
          prompt: 'select_account'
        }
      },
    })
  }

  // RENDER: PROFILE SETUP (Step 3)
  if (step === 'profile') {
    return (
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-2 mb-12">
          <img src="/logo.png" alt="InvoPilot Logo" className="w-10 h-10 object-contain drop-shadow-sm" />
          <span className="font-bold text-xl tracking-tight text-ink-900">InvoPilot</span>
        </div>

        <h1 className="text-4xl font-bold mb-3 text-ink-900 tracking-tight">
          Complete <span className="headline-accent italic text-brand-500 font-serif">Profile</span>
        </h1>
        <p className="text-ink-500 mb-10 text-lg">
          Verification successful! Now set your name and a secure password.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-ink-700 mb-2">Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
              <input
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-ink-200 pl-11 pr-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all bg-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-ink-700 mb-2">Create Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
              <input
                type="password"
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-ink-200 pl-11 pr-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all bg-white"
                minLength={6}
                required
              />
            </div>
          </div>

          {error && <p className="text-sm text-center font-medium text-red-500">{error}</p>}

          <button
            onClick={handleCompleteProfile}
            disabled={loading || !password || !fullName}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-brand-500/25 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Get Started'}
          </button>
        </div>
      </div>
    )
  }

  // RENDER: VERIFY OTP (Step 2)
  if (step === 'verify') {
    return (
      <div className="w-full max-w-md animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex items-center gap-2 mb-12">
          <img src="/logo.png" alt="InvoPilot Logo" className="w-10 h-10 object-contain drop-shadow-sm" />
          <span className="font-bold text-xl tracking-tight text-ink-900">InvoPilot</span>
        </div>

        <h1 className="text-4xl font-bold mb-3 text-ink-900 tracking-tight">
          Verify your <span className="headline-accent italic text-brand-500 font-serif">email</span>
        </h1>
        <p className="text-ink-500 mb-10 text-lg leading-relaxed">
          We sent an 8-digit code to <span className="font-bold text-ink-900">{email}</span>.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-ink-700 mb-2">Verification Code</label>
            <input
              type="text"
              placeholder="00000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              className="w-full text-center text-3xl tracking-[0.5em] font-mono rounded-xl border border-ink-200 px-4 py-5 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all bg-white"
              maxLength={8}
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-center font-medium text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}
          {success && <p className="text-sm text-center font-medium text-emerald-600 bg-emerald-50 p-3 rounded-xl border border-emerald-100">{success}</p>}

          <button
            onClick={handleVerifyOtp}
            disabled={loading || otpCode.length < 6}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-brand-500/25 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Continue'}
          </button>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="text-brand-500 text-sm font-bold hover:underline underline-offset-4 disabled:opacity-50"
            >
              Didn&apos;t get a code? Resend
            </button>
            <button
              onClick={() => { setStep('email'); setSuccess(null); setError(null); }}
              className="text-ink-400 text-sm font-bold hover:text-ink-600 transition-colors"
            >
              ← Back to email entry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // RENDER: EMAIL ENTRY (Step 1)
  return (
    <div className="w-full max-w-md animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-12">
        <img src="/logo.png" alt="InvoPilot Logo" className="w-10 h-10 object-contain drop-shadow-sm" />
        <span className="font-bold text-xl tracking-tight text-ink-900">InvoPilot</span>
      </div>

      <h1 className="text-5xl font-bold mb-3 text-ink-900 tracking-tight">
        {isLogin ? (
          <>Welcome <span className="headline-accent italic text-brand-500 font-serif">back</span></>
        ) : (
          <>Get <span className="headline-accent italic text-brand-500 font-serif">started</span></>
        )}
      </h1>
      <p className="text-ink-500 mb-10 text-lg">
        {isLogin 
          ? 'Sign in with your email or Google account.'
          : 'Enter your email to start your multi-step registration.'}
      </p>

      <div className="space-y-6">
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border border-ink-200 text-ink-700 font-bold py-3.5 rounded-xl hover:bg-ink-50 hover:border-ink-300 transition-all shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-4 py-2">
          <div className="h-px bg-ink-200 flex-1" />
          <span className="text-ink-400 text-[10px] font-bold uppercase tracking-widest">or email</span>
          <div className="h-px bg-ink-200 flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-ink-700 mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-ink-200 pl-11 pr-4 py-3.5 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all bg-white"
                required
              />
            </div>
          </div>

          {isLogin && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-ink-700">Password</label>
                <a 
                  href={`/forgot-password?email=${encodeURIComponent(email)}`}
                  className="text-xs font-bold text-brand-500 hover:text-brand-600 transition-colors uppercase tracking-widest"
                >
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 pl-11 pr-4 py-3.5 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all bg-white"
                  required
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-center font-medium text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || (isLogin && !password)}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-brand-500/25 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? 'Sign in' : 'Continue')}
          </button>
        </form>
      </div>

      <p className="mt-12 text-sm text-ink-500 text-center">
        {isLogin ? (
          <>Don&apos;t have an account? <a href="/signup" className="text-brand-500 hover:text-brand-700 font-bold underline underline-offset-4">Sign up</a></>
        ) : (
          <>Already have an account? <a href="/login" className="text-brand-500 hover:text-brand-700 font-bold underline underline-offset-4">Sign in</a></>
        )}
      </p>
    </div>
  )
}

export default function AuthForm({ mode = 'login' }: { mode?: 'login' | 'signup' }) {
  return (
    <Suspense fallback={null}>
      <AuthFormContent mode={mode} />
    </Suspense>
  )
}
