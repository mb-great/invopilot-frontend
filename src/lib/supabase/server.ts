import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          ...(headerStore.get('Authorization') ? { Authorization: headerStore.get('Authorization')! } : {}),
        },
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (err) {
            // Called from Server Component — ignore
            console.warn('[Supabase] setAll cookie error:', err);
          }
        },
      },
    }
  )
}
