'use client';

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Menu, X, LogOut, LayoutDashboard, FileText, Users, Settings, ShieldCheck } from 'lucide-react'

interface DashboardShellProps {
  children: React.ReactNode
  userEmail?: string
  userName?: string
  avatarUrl?: string | null
  isAdmin?: boolean
}

const navLinks = [
  { name: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { name: 'Invoices', href: '/invoices', icon: <FileText className="w-4 h-4" /> },
  { name: 'Clients', href: '/dashboard/clients', icon: <Users className="w-4 h-4" /> },
  { name: 'Settings', href: '/dashboard/settings', icon: <Settings className="w-4 h-4" /> },
  { name: 'Admin', href: '/admin', adminOnly: true, icon: <ShieldCheck className="w-4 h-4" /> }
]

export default function DashboardShell({ children, userEmail, userName, avatarUrl, isAdmin }: DashboardShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
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

  return (
    <div className="flex h-screen bg-ink-50 overflow-hidden">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-ink-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[280px] bg-white border-r border-ink-200 flex flex-col transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between px-6 py-6 lg:py-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <span className="text-white font-bold text-lg italic">I</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-ink-900">InvoPilot</span>
          </div>
          <button 
            className="lg:hidden p-2 text-ink-500 hover:bg-ink-50 rounded-lg"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
          {navLinks.map((link) => {
            if (link.adminOnly && !isAdmin) return null;
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
                {link.name}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-ink-200 p-6 bg-ink-50/30">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white font-bold border border-brand-600 shadow-md overflow-hidden text-sm tracking-tighter">
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName || 'User'} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-ink-900 truncate">{userName || 'User'}</div>
              <div className="text-[10px] text-ink-400 font-bold uppercase truncate">{userEmail || 'user@example.com'}</div>
            </div>
          </div>
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
        <header className="lg:hidden h-16 bg-white border-b border-ink-200 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-brand-500 flex items-center justify-center shadow-md shadow-brand-500/10">
              <span className="text-white font-bold text-sm italic">I</span>
            </div>
            <span className="font-bold text-md text-ink-900">InvoPilot</span>
          </div>
          <button 
            className="p-2 text-ink-600 hover:bg-ink-50 rounded-lg"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <main className="flex-1 overflow-auto relative">
          <div className="w-full max-w-[1440px] mx-auto px-4 py-6 md:px-8 md:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
