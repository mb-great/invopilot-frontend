import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OnboardingForm from './OnboardingForm'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, company_name, defaults')
    .eq('id', user.id)
    .single()

  // Already onboarded? Go to dashboard.
  if (profile?.defaults?.onboarding_seen) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-[100dvh] bg-ink-50 flex items-center justify-center px-4">
      <OnboardingForm
        userId={user.id}
        fullName={profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || ''}
        avatarUrl={profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || null}
        email={user.email || ''}
        existingCompany={profile?.company_name || ''}
      />
    </main>
  )
}
