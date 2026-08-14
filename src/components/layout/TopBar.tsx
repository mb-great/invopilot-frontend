'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface TopBarProps {
  userEmail?: string
}

import { clearAnonId } from '@/lib/track'

export default function TopBar({ userEmail }: TopBarProps) {
  const supabase = createClient()
  const router = useRouter()

  const handleLogout = async () => {
    clearAnonId()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="h-16 border-b border-border bg-bg/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-8">
        <Link href="/dashboard" className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          INVOPILOT
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="hover:text-accent transition-colors">Generate</Link>
          <Link href="/dashboard" className="hover:text-accent transition-colors">My Invoices</Link>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {userEmail && (
          <span className="text-xs text-muted hidden sm:inline">{userEmail}</span>
        )}
        <button
          onClick={handleLogout}
          className="text-xs font-semibold hover:text-accent transition-colors border border-border px-3 py-1.5 rounded-md"
        >
          Logout
        </button>
      </div>
    </header>
  )
}
