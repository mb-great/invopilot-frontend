'use client';

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { clearAnonId } from '@/lib/track'
import { Menu, X, LogOut, LayoutDashboard, FileText, Users, Settings, ShieldCheck, CreditCard, Repeat, Code, Wallet } from 'lucide-react'
import { resolvePlanAccess } from '@/lib/billing/tiers'
import PremiumBadge from '@/components/ui/PremiumBadge'
import GlobalWorkspaceSwitcher from '@/components/layout/GlobalWorkspaceSwitcher'
import { toast } from 'sonner'

interface DashboardShellProps {
  children: React.ReactNode
  userEmail?: string
  userName?: string
  avatarUrl?: string | null
  access: ReturnType<typeof resolvePlanAccess>
}

const navLinks = [
  { name: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { name: 'Invoices', href: '/invoices', icon: <FileText className="w-4 h-4" /> },
  { name: 'Quotes', href: '/dashboard/quotes', icon: <FileText className="w-4 h-4" />, premiumBadge: 'pro' as const },
  { name: 'Recurring', href: '/dashboard/recurring', icon: <Repeat className="w-4 h-4" />, premiumBadge: 'pro' as const },
  { name: 'Clients', href: '/dashboard/clients', icon: <Users className="w-4 h-4" /> },
  { name: 'Payment Methods', href: '/dashboard/payment-methods', icon: <Wallet className="w-4 h-4" />, premiumBadge: 'pro' as const },
  { name: 'Team', href: '/dashboard/members', icon: <Users className="w-4 h-4" />, premiumBadge: 'biz' as const },
  { name: 'API', href: '/dashboard/api', icon: <Code className="w-4 h-4" />, premiumBadge: 'biz' as const },
  { name: 'Pricing', href: '/pricing', icon: <CreditCard className="w-4 h-4" /> },
  { name: 'Settings', href: '/dashboard/settings', icon: <Settings className="w-4 h-4" /> },
  { name: 'Admin', href: '/admin', adminOnly: true, icon: <ShieldCheck className="w-4 h-4" /> }
]

export default function DashboardShell({ children, userEmail, userName, avatarUrl, access }: DashboardShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [imgError, setImgError] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const celebration = localStorage.getItem('invopilot_celebration_toast');
    if (celebration) {
      try {
        const { tier, periodEnd } = JSON.parse(celebration);
        const dateStr = new Date(periodEnd).toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        });
        toast.success(`🎉 You've been granted the ${tier.toUpperCase()} plan free until ${dateStr}!`, {
          duration: 8000
        });
      } catch {}
      localStorage.removeItem('invopilot_celebration_toast');
    }
  }, []);

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    clearAnonId() // fresh anon trail for next person on shared device
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
      }
      return parts[0].charAt(0).toUpperCase();
    }
    return email ? email.charAt(0).toUpperCase() : 'U';
  };

  const initials = getInitials(userName, userEmail);
  const tierLabel = access.isSuperAdmin ? 'Superadmin' : access.isAdmin ? 'Admin' : access.plan.name;
  const statusLabel = access.isExpired
    ? 'expired'
    : access.isAdmin
      ? 'bypass'
      : access.effectiveTier === 'free'
        ? 'free'
        : 'active';

  return (
    <div className="flex h-[100dvh] bg-ink-50 overflow-hidden">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-ink-900/50 z-[100] lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[110] w-[280px] bg-white border-r border-ink-200 flex flex-col transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between px-6 py-6 lg:py-8">
          <div className="flex items-center gap-2">
            <img src="/logo.webp" alt="InvoPilot Logo" className="w-8 h-8 object-contain drop-shadow-sm" />
            <span className="font-bold text-lg tracking-tight text-ink-900">InvoPilot</span>
          </div>
          <button 
            className="lg:hidden p-2 text-ink-500 hover:bg-ink-50 rounded-lg"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pb-4">
          <GlobalWorkspaceSwitcher className="w-full" />
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
          {navLinks.map((link) => {
            if (link.adminOnly && !access.isAdmin) return null;
            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`nav-link flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                  isActive 
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                  : 'text-ink-500 hover:text-brand-600 hover:bg-brand-50'
                }`}
              >
                {link.icon}
                <span className="flex-1 flex items-center justify-between">
                  <span>{link.name}</span>
                  {link.premiumBadge && <PremiumBadge type={link.premiumBadge} />}
                </span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-ink-200 p-6 bg-ink-50/30">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold border border-brand-600 shadow-md overflow-hidden text-sm tracking-tighter">
              {avatarUrl && !imgError ? (
                <img src={avatarUrl} alt={userName || 'User'} referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={() => setImgError(true)} />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-ink-900 truncate">{userName || 'User'}</div>
              <div className="text-[10px] text-ink-400 font-bold uppercase truncate">{userEmail || 'user@example.com'}</div>
            </div>
          </div>
          <Link
            href="/pricing"
            className="mb-4 flex items-center justify-between rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-tight text-ink-600 hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
          >
            <span>{tierLabel} tier</span>
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px]">{statusLabel}</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 text-sm font-bold text-ink-600 hover:text-red-600 py-3 rounded-xl hover:bg-red-50 transition-all border border-ink-200 hover:border-red-100 bg-white"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden relative z-50 h-14 bg-white border-b border-ink-200 flex items-center justify-between px-3 shrink-0 gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <img src="/logo.webp" alt="InvoPilot Logo" className="w-6 h-6 object-contain drop-shadow-sm" />
            <span className="font-bold text-sm text-ink-900">InvoPilot</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
            <GlobalWorkspaceSwitcher className="max-w-[140px] min-w-0" />
            <button 
              className="p-1.5 text-ink-600 hover:bg-ink-50 rounded-lg shrink-0"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto relative">
          <div className="w-full max-w-[1440px] mx-auto px-4 py-6 md:px-8 md:py-10 flex flex-col min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
