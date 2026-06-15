'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type SenderMethod = 'system' | 'gmail' | 'smtp';

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
  const [config, setConfig] = useState<SenderConfig>({ method: 'system' });
  const [loading, setLoading] = useState(false);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');

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
      if (json.data) {
        setConfig(json.data);
        setSmtpHost(json.data.smtp_host || '');
        setSmtpPort(String(json.data.smtp_port || 587));
        setSmtpUser(json.data.smtp_user || '');
      }
    } catch {
      toast.error('Failed to load email settings.');
    }
  }

  async function handleMethodChange(method: SenderMethod) {
    if (method === 'gmail' && config.method !== 'gmail') {
      const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3001';
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        toast.error('Google Client ID not configured.');
        return;
      }
      const redirectUri = `${frontendUrl}/api/settings/sender-config/gmail-callback`;
      const scope = 'https://www.googleapis.com/auth/gmail.send';
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
      window.location.href = authUrl;
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, any> = { method };
      if (method === 'smtp') {
        payload.smtp_host = smtpHost;
        payload.smtp_port = parseInt(smtpPort);
        payload.smtp_user = smtpUser;
        if (smtpPass) payload.smtp_pass = smtpPass;
      }

      const res = await fetch('/api/settings/sender-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to update');
      setConfig({ ...config, method });
      toast.success('Email sender updated.');
    } catch {
      toast.error('Failed to update email settings.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings/sender-config', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to disconnect');
      setConfig({ method: 'system' });
      setSmtpHost('');
      setSmtpPort('587');
      setSmtpUser('');
      setSmtpPass('');
      toast.success('Disconnected. Using system default.');
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
      setConfig({ ...config, method: 'smtp', smtp_host: smtpHost, smtp_port: parseInt(smtpPort), smtp_user: smtpUser });
      setSmtpPass('');
      toast.success('SMTP settings saved.');
    } catch {
      toast.error('Failed to save SMTP settings.');
    } finally {
      setLoading(false);
    }
  }

  const isCustom = config.method !== 'system';

  return (
    <section className="glass-card p-8 bg-white border border-ink-100 shadow-sm mt-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-ink-900 mb-2">Email Sender</h2>
        <p className="text-ink-500 text-sm">Choose how invoice emails are sent. System default uses InvoPilot&apos;s SMTP.</p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          {(['system', 'gmail', 'smtp'] as SenderMethod[]).map((method) => (
            <label
              key={method}
              className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                config.method === method
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-ink-200 hover:border-ink-300'
              }`}
            >
              <input
                type="radio"
                name="sender-method"
                value={method}
                checked={config.method === method}
                onChange={() => handleMethodChange(method)}
                className="accent-brand-500"
              />
              <div>
                <span className="font-semibold text-ink-900">
                  {method === 'system' ? 'System Default' : method === 'gmail' ? 'Gmail' : 'Custom SMTP'}
                </span>
                {method === 'gmail' && config.method === 'gmail' && config.gmail_email && (
                  <span className="ml-2 text-sm text-ink-500">({config.gmail_email})</span>
                )}
                {method === 'system' && (
                  <p className="text-xs text-ink-500">Uses InvoPilot&apos;s configured email service.</p>
                )}
                {method === 'gmail' && (
                  <p className="text-xs text-ink-500">Send via your Google account using OAuth2.</p>
                )}
                {method === 'smtp' && (
                  <p className="text-xs text-ink-500">Use your own SMTP server.</p>
                )}
              </div>
            </label>
          ))}
        </div>

        {config.method === 'smtp' && (
          <div className="mt-4 p-4 rounded-lg border border-ink-200 bg-ink-50 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">SMTP Host</Label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.example.com"
                  className="mt-1 w-full px-3 py-2 rounded-md border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Port</Label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                  className="mt-1 w-full px-3 py-2 rounded-md border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Username</Label>
              <input
                type="text"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="your@email.com"
                className="mt-1 w-full px-3 py-2 rounded-md border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Password</Label>
              <input
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder={config.method === 'smtp' ? '••••••••' : 'Enter password'}
                className="mt-1 w-full px-3 py-2 rounded-md border border-ink-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSmtpSave} disabled={loading || !smtpHost || !smtpUser} className="bg-brand-500 hover:bg-brand-600">
                {loading ? 'Saving...' : 'Save SMTP'}
              </Button>
            </div>
          </div>
        )}

        {isCustom && (
          <div className="pt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={loading}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Disconnect
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
