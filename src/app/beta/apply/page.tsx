'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getBackendUrl } from '@/lib/url'
import { Loader2, Sparkles, CheckCircle2 } from 'lucide-react'

const BACKEND_URL = getBackendUrl()

const BUSINESS_TYPES = [
  'Freelancer / Consultant',
  'Agency',
  'Small business / MSME',
  'Startup',
  'Accountant',
  'Other',
]

const INVOICE_VOLUMES = ['1 - 5', '6 - 20', '21 - 50', '50+']

export default function BetaApplyPage() {
  const supabase = createClient()
  const router = useRouter()

  const [form, setForm] = useState({
    name: '',
    email: '',
    businessType: '',
    monthlyInvoices: '',
    biggestProblem: '',
    agreeToReview: false,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.name || !form.email || !form.businessType || !form.monthlyInvoices) {
      setError('Please fill all required fields.')
      return
    }
    if (!form.email.includes('@')) {
      setError('Please enter a valid email address.')
      return
    }
    if (!form.agreeToReview) {
      setError('You must agree to the review commitment to join the beta.')
      return
    }

    setLoading(true)

    try {
      // Get current session token
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const res = await fetch(`${BACKEND_URL}/api/beta/apply`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          businessType: form.businessType,
          monthlyInvoices: form.monthlyInvoices,
          biggestProblem: form.biggestProblem,
          agreeToReview: form.agreeToReview,
        }),
      })

      const body = await res.json().catch(() => ({}))

      if (!res.ok && res.status !== 409) {
        throw new Error(body.error || 'Failed to submit application')
      }

      // 409 = already applied — still count as success
      setSuccess(true)
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-amber-50 via-white to-orange-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-green-200 bg-white p-10 text-center shadow-lg animate-in fade-in duration-300">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-xl font-black text-ink-900">You&apos;re in!</h2>
          <p className="mt-2 text-sm text-ink-500">
            Welcome to the InvoPilot Beta. Redirecting to your dashboard…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-amber-50 via-white to-orange-50 px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <Sparkles className="h-6 w-6 text-brand-600" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-ink-900">
            Join the InvoPilot Beta
          </h1>
          <p className="mt-2 text-sm text-ink-500 leading-relaxed max-w-sm mx-auto">
            Full access to every feature, free until September 2026.
            In exchange, we ask for one honest review on G2.
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-ink-100 bg-white p-8 shadow-sm space-y-5"
        >
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
              className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
              Work email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@business.com"
              className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Business Type + Invoice Volume */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
                Business type <span className="text-red-500">*</span>
              </label>
              <select
                value={form.businessType}
                onChange={(e) => setForm({ ...form, businessType: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">Select one</option>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
                Monthly invoices <span className="text-red-500">*</span>
              </label>
              <select
                value={form.monthlyInvoices}
                onChange={(e) => setForm({ ...form, monthlyInvoices: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              >
                <option value="">Select one</option>
                {INVOICE_VOLUMES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Biggest Problem */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-ink-500">
              Biggest invoicing problem right now
            </label>
            <input
              type="text"
              value={form.biggestProblem}
              onChange={(e) => setForm({ ...form, biggestProblem: e.target.value })}
              placeholder="Optional"
              className="w-full rounded-lg border border-ink-200 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Review Agreement */}
          <label className="flex cursor-pointer gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 transition-colors hover:bg-brand-100/50">
            <input
              type="checkbox"
              checked={form.agreeToReview}
              onChange={(e) => setForm({ ...form, agreeToReview: e.target.checked })}
              className="mt-0.5 h-4 w-4 accent-brand-500"
            />
            <span className="text-sm leading-relaxed text-ink-800">
              <strong>The beta deal:</strong> I agree to submit one honest
              public review on G2 within 10 days of getting beta access.
            </span>
          </label>

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:bg-brand-400 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </span>
            ) : (
              'Apply for Beta Access'
            )}
          </button>

          <p className="text-center text-xs text-ink-400">
            No credit card. No spam. Instant access after applying.
          </p>
        </form>
      </div>
    </div>
  )
}
