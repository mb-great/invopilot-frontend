import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      console.log('Auth Callback: Code exchange successful.');

      // Check if user needs onboarding
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('defaults')
          .eq('id', user.id)
          .single()

        if (!profile?.defaults?.onboarding_seen) {
          console.log('Auth Callback: New user, redirecting to onboarding.');
          return NextResponse.redirect(`${origin}/onboarding`)
        }
      }

      console.log('Auth Callback: Returning user, redirecting to:', next);
      return NextResponse.redirect(`${origin}${next}`)
    } else {
      console.error('Auth Callback Error:', error.message, error.status);
    }
  }

  console.error('Auth Callback: Failed to establish session. Redirecting.');
  
  if (next.includes('reset-password')) {
    return NextResponse.redirect(`${origin}/forgot-password?error=auth-failed-pkce`)
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth-failed-pkce`)
}
