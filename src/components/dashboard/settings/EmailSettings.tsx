'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, AlertTriangle } from 'lucide-react';

type SenderMethod = 'gmail' | 'smtp';

interface SenderConfig {
  method: SenderMethod;
  gmail_email?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
}

export default function EmailSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<SenderConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpExpanded, setSmtpExpanded] = useState(false);

  useEffect(() => {
    const gmailStatus = searchParams.get('gmail');
    if (gmailStatus === 'connected') {
      toast.success('Gmail connected successfully.');
      router.replace('/dashboard/settings');
    } else if (gmailStatus === 'error') {
      toast.error('Failed to connect Gmail. Please try again.');
      router.replace('/dashboard/settings');
    }
  }, [searchParams, router]);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      const res = await fetch('/api/settings/sender-config');
      const json = await res.json();
      if (json.data && json.data.method !== 'system') {
        setConfig(json.data);
        setSmtpHost(json.data.smtp_host || '');
        setSmtpPort(String(json.data.smtp_port || 587));
        setSmtpUser(json.data.smtp_user || '');
        if (json.data.method === 'smtp') setSmtpExpanded(true);
      } else {
        setConfig(null);
      }
    } catch {
      toast.error('Failed to load email settings.');
    }
  }

  async function handleConnectGmail() {
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast.error('Google Client ID not configured.');
      return;
    }
    const redirectUri = `${frontendUrl}/api/settings/sender-config/gmail-callback`;
    const scope = 'https://www.googleapis.com/auth/gmail.send';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    window.location.href = authUrl;
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/sender-config', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      setConfig(null);
      setSmtpHost('');
      setSmtpPort('587');
      setSmtpUser('');
      setSmtpPass('');
      toast.success('Email sender disconnected.');
    } catch {
      toast.error('Failed to disconnect.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSmtpSave() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/sender-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'smtp',
          smtp_host: smtpHost,
          smtp_port: parseInt(smtpPort),
          smtp_user: smtpUser,
          smtp_pass: smtpPass || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setConfig({ method: 'smtp', smtp_host: smtpHost, smtp_port: parseInt(smtpPort), smtp_user: smtpUser });
      setSmtpPass('');
      toast.success('SMTP settings saved.');
    } catch {
      toast.error('Failed to save SMTP settings.');
    } finally {
      setLoading(false);
    }
  }

  const isConfigured = config !== null;
  const senderEmail = config?.method === 'gmail' ? config.gmail_email : config?.method === 'smtp' ? config.smtp_user : null;

  return (
    <section className="glass-card p-8 bg-white border border-ink-100 shadow-sm mt-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-ink-900 mb-2">Email Sender</h2>
        <p className="text-ink-500 text-sm">Connect your email to send invoices from your own address.</p>
      </div>

      {!isConfigured && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">Email not configured</p>
            <p className="text-xs text-amber-600 mt-1">Connect Gmail or set up SMTP to send invoice emails to clients.</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Gmail Option */}
        <div
          className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
            config?.method === 'gmail'
              ? 'border-brand-500 bg-brand-50 shadow-sm'
              : 'border-ink-200 hover:border-ink-300 hover:bg-ink-50/50'
          }`}
          onClick={() => !isConfigured || config?.method !== 'gmail' ? handleConnectGmail() : undefined}
        >
          <div className="w-10 h-10 rounded-lg bg-white border border-ink-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <div className="flex-1">
            <span className="font-bold text-ink-900 text-sm">Gmail</span>
            {config?.method === 'gmail' && senderEmail && (
              <span className="ml-2 text-xs text-brand-600 font-semibold">Connected: {senderEmail}</span>
            )}
            <p className="text-xs text-ink-500 mt-0.5">Send via your Google account using OAuth2.</p>
          </div>
          {config?.method === 'gmail' && (
            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase">Connected</span>
          )}
        </div>

        {/* Custom SMTP Option */}
        <div
          className={`rounded-xl border transition-all ${
            config?.method === 'smtp'
              ? 'border-brand-500 bg-brand-50 shadow-sm'
              : 'border-ink-200 hover:border-ink-300'
          }`}
        >
          <div
            className="flex items-center gap-4 p-4 cursor-pointer"
            onClick={() => {
              if (!isConfigured || config?.method !== 'smtp') {
                setSmtpExpanded(!smtpExpanded);
              }
            }}
          >
            <div className="w-10 h-10 rounded-lg bg-white border border-ink-100 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-ink-600" />
            </div>
            <div className="flex-1">
              <span className="font-bold text-ink-900 text-sm">Custom SMTP</span>
              {config?.method === 'smtp' && senderEmail && (
                <span className="ml-2 text-xs text-brand-600 font-semibold">Connected: {senderEmail}</span>
              )}
              <p className="text-xs text-ink-500 mt-0.5">Use your own SMTP server (Gmail, Outlook, etc).</p>
            </div>
            {config?.method === 'smtp' && (
              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full uppercase">Connected</span>
            )}
          </div>

          {smtpExpanded && (
            <div className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-ink-500">SMTP Host</Label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-ink-500">Port</Label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-ink-500">Username / Email</Label>
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="your@email.com"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-ink-500">Password</Label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder={config?.method === 'smtp' ? '••••••••' : 'App password'}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSmtpSave} disabled={loading || !smtpHost || !smtpUser} className="bg-brand-500 hover:bg-brand-600 text-sm">
                  {loading ? 'Saving...' : 'Save SMTP'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {isConfigured && (
          <div className="pt-2 flex justify-end">
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={loading}
              className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
            >
              Disconnect {config?.method === 'gmail' ? 'Gmail' : 'SMTP'}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
