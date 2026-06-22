'use client';

import { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { X, Send, Copy, MessageCircle, Share2, Paperclip, Eye, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/clipboard';
import Link from 'next/link';

export interface UnifiedShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  clientEmail?: string;
  clientName?: string;
  senderName?: string;
  pdfUrl?: string;
  shareSlug?: string;
  formData?: Record<string, unknown>;
  senderMethod?: 'system' | 'gmail' | 'smtp';
  senderEmail?: string;
  initialTab?: 'email' | 'share';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ChipInput({
  chips,
  setChips,
  placeholder,
  disabled,
}: {
  chips: string[];
  setChips: (c: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const email = raw.trim().replace(/[,\s]+$/, '');
    if (!email) return;
    if (!EMAIL_RE.test(email)) {
      toast.error('Invalid email address');
      return;
    }
    setChips([...chips, email]);
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === 'Tab') {
      e.preventDefault();
      commit(value);
    } else if (e.key === 'Backspace' && !value && chips.length) {
      setChips(chips.slice(0, -1));
    }
  };

  const onChange = (raw: string) => {
    if (raw.endsWith(',') || raw.endsWith(' ')) {
      commit(raw);
    } else {
      setValue(raw);
    }
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 items-center border-b border-ink-100 pb-3 min-h-[36px] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {chips.map((chip) => (
        <span
          key={chip}
          className="flex items-center gap-1 bg-brand-50 text-brand-700 text-xs font-semibold px-2.5 py-1 rounded-full"
        >
          {chip}
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); setChips(chips.filter((c) => c !== chip)); }}
            className="text-brand-400 hover:text-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={chips.length ? '' : placeholder}
        className="flex-1 min-w-[120px] text-sm text-ink-900 placeholder:text-ink-300 outline-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

export default function UnifiedShareModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  clientEmail,
  clientName,
  senderName,
  pdfUrl,
  shareSlug,
  formData,
  senderMethod = 'system',
  senderEmail,
  initialTab = 'email',
}: UnifiedShareModalProps) {
  const hasShare = Boolean(pdfUrl);
  const [tab, setTab] = useState<'email' | 'share'>(initialTab);
  const [toChips, setToChips] = useState<string[]>(clientEmail ? [clientEmail] : []);
  const [ccChips, setCcChips] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [attachPdf, setAttachPdf] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [senderConfig, setSenderConfig] = useState<{ method: string; email?: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setToChips(clientEmail ? [clientEmail] : []);
      fetch('/api/settings/sender-config')
        .then(r => r.json())
        .then(json => {
          if (json.data && json.data.method !== 'system') {
            setSenderConfig({
              method: json.data.method,
              email: json.data.method === 'gmail' ? json.data.gmail_email : json.data.smtp_user,
            });
          } else {
            setSenderConfig(null);
          }
        })
        .catch(() => setSenderConfig(null));
    }
  }, [isOpen]);

  const shareUrl = pdfUrl && typeof window !== 'undefined'
    ? `${window.location.origin}/view/${encodeURIComponent(pdfUrl)}`
    : '';

  const [subject, setSubject] = useState(
    `Invoice #${invoiceNumber} from ${senderName || 'us'}`
  );
  const [message, setMessage] = useState(
    `Hi ${clientName || 'there'},\n\nPlease find your invoice #${invoiceNumber}${attachPdf ? ' attached' : ''}.\n\nView it online: ${shareUrl}\n\nTotal: ${formData?.currency || ''} ${formData?.total || ''}\n\nLet me know if you have any questions.\n\nBest regards,\n${senderName || ''}`
  );

  if (!isOpen) return null;

  const senderBar = senderConfig
    ? senderConfig.method === 'gmail'
      ? `Sending as ${senderConfig.email || 'your Gmail'}`
      : `Sending as ${senderConfig.email || 'your SMTP'}`
    : 'Email not configured';

  const handleSend = async () => {
    if (!toChips.length) return;
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: toChips[0],
          subject,
          message,
          cc: ccChips.join(','),
          attachPdf,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Failed to send');
      }
      toast.success(`Sent to ${toChips[0]}`);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = () => {
    localStorage.setItem(`emailDraft_${invoiceId}`, JSON.stringify({ subject, message }));
    toast.success('Draft saved');
  };

  const handleCopy = async () => {
    await copyToClipboard(shareUrl);
    toast.success('Link copied');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Invoice', url: shareUrl });
    } else {
      toast.error('Sharing not supported on this browser');
    }
  };

  const previewHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f9fafb;">
      <div style="background: white; border-radius: 16px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 48px; height: 48px; background: #FFF5EB; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px;">
            <span style="font-size: 24px;">📄</span>
          </div>
          <h1 style="margin: 0; font-size: 20px; color: #0A0D14;">Invoice #${invoiceNumber}</h1>
        </div>
        <div style="color: #5C6471; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${message}</div>
        ${attachPdf ? `<div style="margin-top: 24px; padding: 16px; background: #F7F8F9; border-radius: 12px; text-align: center;">
          <div style="display: inline-flex; align-items: center; gap: 8px; color: #5C6471; font-size: 13px;">
            <span style="font-size: 16px;">📎</span>
            Invoice_${invoiceNumber}.pdf attached
          </div>
        </div>` : ''}
        ${shareUrl ? `<div style="margin-top: 20px; text-align: center;">
          <a href="${shareUrl}" style="display: inline-block; background: #F39C5B; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">View Invoice Online</a>
        </div>` : ''}
      </div>
      <div style="text-align: center; margin-top: 16px; color: #8A92A0; font-size: 11px;">
        Sent via InvoPilot
      </div>
    </div>
  `;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 sm:backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-[640px] max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-xl font-bold text-ink-900">Send Invoice #{invoiceNumber}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center text-ink-400 hover:text-ink-900 hover:bg-ink-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          <button
            onClick={() => setTab('email')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${tab === 'email' ? 'bg-brand-500 text-white' : 'text-ink-500 hover:text-ink-900'}`}
          >
            Email
          </button>
          {hasShare && (
            <button
              onClick={() => setTab('share')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${tab === 'share' ? 'bg-brand-500 text-white' : 'text-ink-500 hover:text-ink-900'}`}
            >
              Share
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === 'email' && !showPreview && (
            <div className="space-y-3">
              {/* Sender bar */}
              <div className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${senderConfig ? 'text-ink-500 bg-ink-50' : 'text-amber-600 bg-amber-50 border border-amber-200'}`}>
                <span>{senderBar}</span>
                {!senderConfig ? (
                  <a href="/dashboard/settings" className="text-amber-600 font-semibold hover:underline">
                    Setup Email →
                  </a>
                ) : (
                  <Link href="/dashboard/settings" className="text-brand-500 font-semibold hover:underline">
                    Change →
                  </Link>
                )}
              </div>

              {/* To */}
              <div className="flex gap-3 items-start">
                <span className="text-sm font-semibold text-ink-500 w-8 pt-1.5 shrink-0">To</span>
                <div className={`flex-1 ${!senderConfig ? 'opacity-50' : ''}`}>
                  <ChipInput chips={toChips} setChips={setToChips} placeholder="Add email" disabled={!senderConfig} />
                </div>
              </div>

              {/* CC */}
              <div className="flex gap-3 items-start">
                <span className="text-sm font-semibold text-ink-500 w-8 pt-1.5 shrink-0">CC</span>
                <div className={`flex-1 ${!senderConfig ? 'opacity-50' : ''}`}>
                  <ChipInput chips={ccChips} setChips={setCcChips} placeholder="Add email" disabled={!senderConfig} />
                </div>
              </div>

              {/* Subject */}
              <div className={`flex items-center gap-3 border-b border-ink-100 pb-3 ${!senderConfig ? 'opacity-50' : ''}`}>
                <span className="text-sm font-semibold text-ink-500 w-8 shrink-0">Sub</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={!senderConfig}
                  className="flex-1 text-sm text-ink-900 outline-none bg-transparent disabled:cursor-not-allowed"
                />
              </div>

              {/* Attach PDF toggle */}
              <div className={`flex items-center justify-between py-2 ${!senderConfig ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-ink-400" />
                  <span className="text-sm text-ink-700">Attach PDF</span>
                </div>
                <button
                  onClick={() => setAttachPdf(!attachPdf)}
                  disabled={!senderConfig}
                  className={`relative w-10 h-5 rounded-full transition-colors ${attachPdf ? 'bg-brand-500' : 'bg-ink-200'} disabled:cursor-not-allowed`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${attachPdf ? 'left-5.5 translate-x-0' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Message */}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={!senderConfig}
                rows={8}
                className={`w-full bg-ink-50 rounded-xl p-4 text-sm text-ink-900 outline-none resize-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${!senderConfig ? 'opacity-50' : ''}`}
              />
            </div>
          )}

          {tab === 'email' && showPreview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-ink-500 mb-2">
                <Eye className="w-4 h-4" />
                <span>Email Preview</span>
              </div>
              <div className="border border-ink-200 rounded-xl overflow-hidden">
                <div className="bg-ink-50 px-4 py-2 border-b border-ink-200 text-xs text-ink-500">
                  <div><strong>To:</strong> {toChips.join(', ') || '(none)'}</div>
                  {ccChips.length > 0 && <div><strong>CC:</strong> {ccChips.join(', ')}</div>}
                  <div><strong>Subject:</strong> {subject}</div>
                </div>
                <div
                  className="p-4 text-sm"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            </div>
          )}

          {tab === 'share' && hasShare && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent('Here is your invoice: ' + shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center text-green-600 group-hover:bg-green-100 transition-colors">
                    <MessageCircle className="w-7 h-7" />
                  </div>
                  <span className="text-[10px] font-bold text-ink-600 uppercase tracking-tighter">WhatsApp</span>
                </a>

                <a
                  href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent('Here is your invoice.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 group-hover:bg-blue-100 transition-colors">
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/></svg>
                  </div>
                  <span className="text-[10px] font-bold text-ink-600 uppercase tracking-tighter">Telegram</span>
                </a>

                <button onClick={handleNativeShare} className="flex flex-col items-center gap-2 group">
                  <div className="w-14 h-14 bg-ink-50 rounded-full flex items-center justify-center text-ink-600 group-hover:bg-ink-100 transition-colors">
                    <Share2 className="w-7 h-7" />
                  </div>
                  <span className="text-[10px] font-bold text-ink-600 uppercase tracking-tighter">Others</span>
                </button>

                <button onClick={handleCopy} className="flex flex-col items-center gap-2 group">
                  <div className="w-14 h-14 bg-ink-50 rounded-full flex items-center justify-center text-ink-600 group-hover:bg-ink-100 transition-colors">
                    <Copy className="w-7 h-7" />
                  </div>
                  <span className="text-[10px] font-bold text-ink-600 uppercase tracking-tighter">Copy Link</span>
                </button>
              </div>

              <div className="flex items-center gap-2 border-t border-ink-100 pt-4">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 bg-ink-50 border border-ink-200 rounded-lg px-3 py-2 text-xs text-ink-600 outline-none truncate"
                />
                <button
                  onClick={handleCopy}
                  className="px-4 py-2 bg-brand-500 text-white rounded-lg font-bold text-xs hover:bg-brand-600 transition-colors flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer (email tab only) */}
        {tab === 'email' && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-ink-100 bg-ink-50/50">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveDraft}
                className="text-xs font-semibold text-ink-500 hover:text-ink-700 transition-colors"
              >
                Save draft
              </button>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-700 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                {showPreview ? 'Edit' : 'Preview'}
              </button>
            </div>
            <button
              onClick={handleSend}
              disabled={sending || !toChips.length || !senderConfig}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-brand-500/25 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
