import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          ...(request.headers.get('Authorization') ? { Authorization: request.headers.get('Authorization')! } : {}),
        },
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // Public routes — no auth required
  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/verify-otp') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/billing/unsubscribe') ||
    pathname.startsWith('/tools/') || // public SEO tools (MSME calculator, etc.)
    pathname.startsWith('/api/share') || // public invoice share links
    pathname.startsWith('/view/') || // public invoice view by filename
    pathname.startsWith('/i/') || // legacy share links
    pathname.startsWith('/beta/apply') || // beta application form (accessible to logged-in unapplied users)
    (pathname.startsWith('/invoices/') && pathname !== '/invoices/new' && pathname !== '/invoices') // public share: /invoices/:slug (redirects to /view/)

  // Short-circuit public routes — skip getUser() entirely to avoid
  // stale refresh token errors (AuthApiError: Refresh Token Not Found)
  if (isPublicRoute) {
    return supabaseResponse
  }

  // IMPORTANT: Do not add logic between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAdminRoute = pathname.startsWith('/admin')

  // Unauthenticated user on protected route
  if (!user) {
    if (!pathname.startsWith('/api/')) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
  }

  // Beta gate — require beta application before dashboard access
  // Admins bypass; API routes bypass (let individual endpoints enforce)
  if (user && !pathname.startsWith('/api/')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, beta_applied')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'

    // Admin role check for /admin routes
    if (isAdminRoute && !isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Beta gate: redirect non-applied users to beta form (admins and /onboarding bypass)
    if (!isAdmin && profile?.beta_applied !== true && !pathname.startsWith('/onboarding')) {
      const url = request.nextUrl.clone()
      url.pathname = '/beta/apply'
      return NextResponse.redirect(url)
    }
  }

  // Redirect logged-in users away from auth pages
  const authPages = ['/login', '/signup', '/forgot-password']
  if (user && authPages.some(p => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: return supabaseResponse (carries refreshed cookies)
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
