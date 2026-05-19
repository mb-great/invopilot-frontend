'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function ForgotPasswordContent() {
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002'
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const emailParam = searchParams.get('email')
    const tokenParam = searchParams.get('token')
    const errorParam = searchParams.get('error')

    if (emailParam) setEmail(emailParam)
    
    // Auto-fill OTP from email link
    if (tokenParam) {
      setOtpCode(tokenParam)
      setSent(true)
      setStep('verify')
    }
    
    if (errorParam === 'auth-failed-pkce') {
      setError('Auth link expired or opened in a different browser. Please enter the 8-digit code sent to your email.')
      setStep('verify')
    }
  }, [searchParams])

  // Auto-submit when OTP is pre-filled from URL
  useEffect(() => {
    if (step === 'verify' && otpCode.length === 8 && email && searchParams.get('token')) {
      handleVerify()
    }
  }, [step, otpCode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return setError('Please enter your email.')
    
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send recovery code');
      }

      setSent(true)
      setStep('verify')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/forgot-password/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), token: otpCode }),
        credentials: 'include'
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      router.push('/reset-password')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-ink-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-12">
          <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <span className="text-white font-bold text-xl italic">I</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-ink-900">InvoPilot</span>
        </div>

        <div className="bg-white shadow-xl rounded-2xl border border-ink-100 p-8">
          {step === 'request' ? (
            <>
              <h1 className="text-3xl font-bold mb-2 text-ink-900 tracking-tight">
                Forgot <span className="headline-accent italic text-brand-500 font-serif">Password?</span>
              </h1>
              <p className="text-ink-500 mb-8">
                Enter your email and we&apos;ll send you a recovery link and code.
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-ink-700 mb-2">Email</label>
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-ink-200 px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all bg-white"
                    autoFocus
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-center font-bold text-red-500">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-brand-500/25 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Recovery Link'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-ink-900 font-bold text-lg">Verify your identity</p>
                <p className="text-ink-500 text-sm mt-2 leading-relaxed">
                  If an account exists for <span className="font-bold text-ink-900">{email}</span>, we sent a recovery code.
                  <br />Enter the 8-digit code below or click the link in your email.
                </p>
              </div>

              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="00000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  className="w-full text-center text-3xl tracking-[0.5em] font-mono rounded-xl border border-ink-200 px-4 py-4 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all bg-white"
                  maxLength={8}
                />
                
                {error && (
                  <p className="text-sm text-center font-bold text-red-500">{error}</p>
                )}

                <button
                  onClick={handleVerify}
                  disabled={loading || otpCode.length < 6}
                  className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-brand-500/25 active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Reset Password'}
                </button>
              </div>
              
              <button 
                onClick={() => setStep('request')}
                className="text-brand-500 text-sm font-bold hover:underline underline-offset-4"
              >
                Try a different email
              </button>
            </div>
          )}
        </div>

        <a 
          href="/login"
          className="block w-full mt-8 text-sm text-ink-500 hover:text-ink-900 font-medium transition-colors text-center"
        >
          ← Back to login
        </a>
      </div>
    </main>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordContent />
    </Suspense>
  )
}
