'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Building, ArrowRight } from 'lucide-react'

export default function OnboardingForm({
  userId,
  fullName,
  avatarUrl,
  email,
  existingCompany,
}: {
  userId: string
  fullName: string
  avatarUrl: string | null
  email: string
  existingCompany: string
}) {
  const [companyName, setCompanyName] = useState(existingCompany)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleContinue = async () => {
    setLoading(true)
    try {
      // Update profile with company name and set onboarding flag
      const { data: existing } = await supabase
        .from('profiles')
        .select('defaults')
        .eq('id', userId)
        .single()

      const updatedDefaults = {
        ...(existing?.defaults || {}),
        onboarding_seen: true,
      }

      await supabase
        .from('profiles')
        .update({
          company_name: companyName.trim() || null,
          defaults: updatedDefaults,
        })
        .eq('id', userId)

      router.push('/dashboard')
    } catch {
      // Even on error, don't block — just go to dashboard
      router.push('/dashboard')
    }
  }

  const initials = fullName
    ? fullName.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : email[0]?.toUpperCase() || 'U'

  return (
    <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-2 mb-10">
        <img src="/logo.webp" alt="InvoPilot" className="w-10 h-10 object-contain drop-shadow-sm" />
        <span className="font-bold text-xl tracking-tight text-ink-900">InvoPilot</span>
      </div>

      {/* Avatar + Welcome */}
      <div className="flex items-center gap-5 mb-10">
        <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-brand-500/20 overflow-hidden border-2 border-brand-600">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-ink-900 tracking-tight">
            Welcome, <span className="headline-accent italic font-serif font-normal text-brand-500">{fullName.split(' ')[0] || 'there'}!</span>
          </h1>
          <p className="text-ink-400 text-sm font-medium mt-1">{email}</p>
        </div>
      </div>

      <p className="text-ink-500 text-lg mb-8 leading-relaxed">
        One quick thing before you start — tell us about your business so we can personalize your invoices.
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-ink-700 mb-2">Company / Business Name</label>
          <div className="relative">
            <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
            <input
              type="text"
              placeholder="e.g. Acme Studios"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-xl border border-ink-200 pl-11 pr-4 py-3.5 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all bg-white"
            />
          </div>
          <p className="text-xs text-ink-400 mt-2">Optional — you can always change this in Settings.</p>
        </div>

        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-brand-500/25 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Continue to Dashboard
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-ink-400 mt-8 text-center">
        You can update your profile, add bank details, and upload a logo anytime from Settings.
      </p>
    </div>
  )
}
