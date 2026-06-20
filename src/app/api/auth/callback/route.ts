import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFrontendUrl } from '@/lib/url'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  const baseUrl = getFrontendUrl()

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      console.log('Auth Callback: Code exchange successful.');

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('defaults')
          .eq('id', user.id)
          .single()

        if (!profile?.defaults?.onboarding_seen) {
          console.log('Auth Callback: New user, redirecting to onboarding.');
          return NextResponse.redirect(`${baseUrl}/onboarding`)
        }
      }

      console.log('Auth Callback: Returning user, redirecting to:', next);
      return NextResponse.redirect(`${baseUrl}${next}`)
    } else {
      console.error('Auth Callback Error:', error.message, error.status);
    }
  }

  console.error('Auth Callback: Failed to establish session. Redirecting.');
  
  if (next.includes('reset-password')) {
    return NextResponse.redirect(`${baseUrl}/forgot-password?error=auth-failed-pkce`)
  }

  return NextResponse.redirect(`${baseUrl}/login?error=auth-failed-pkce`)
}
