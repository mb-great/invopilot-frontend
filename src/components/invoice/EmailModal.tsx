'use client';

import { useState } from 'react';
import { X, Send, Copy, Download, Eye, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { getBackendUrl } from '@/lib/url';

interface EmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  invoiceNumber: string;
  clientEmail?: string;
  clientName?: string;
  senderName?: string;
  pdfUrl?: string;
  shareUrl?: string;
}

export default function EmailModal({
  isOpen,
  onClose,
  invoiceId,
  invoiceNumber,
  clientEmail = '',
  clientName = '',
  senderName = '',
  pdfUrl,
  shareUrl,
}: EmailModalProps) {
  const [to, setTo] = useState(clientEmail);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(`Invoice ${invoiceNumber}`);
  const [message, setMessage] = useState(
    `Hi ${clientName || '{customer}'},\n\nPlease find the invoice attached below.\n\nInvoice Number: ${invoiceNumber}\n\nLet me know if you have any questions.\n\nBest regards,\n${senderName || '{yourName}'}`
  );
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!to) {
      toast.error('Enter a recipient email');
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: to, subject, message, cc }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to send');
      }
      toast.success(`Invoice sent to ${to}`);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-[680px] max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-0">
          <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center shrink-0">
            <Send className="w-6 h-6 text-brand-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-ink-900">Send invoice</h2>
            <p className="text-sm text-ink-500 mt-1">Share invoice {invoiceNumber} with your customer.</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-ink-50 flex items-center justify-center text-ink-400 hover:text-ink-900 hover:bg-ink-100 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* To */}
          <div className="flex items-center gap-3 border-b border-ink-100 pb-3">
            <span className="text-sm font-semibold text-ink-500 w-8">To</span>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="customer@email.com"
              className="flex-1 text-sm text-ink-900 placeholder:text-ink-300 outline-none bg-transparent"
            />
          </div>

          {/* CC */}
          <div className="flex items-center gap-3 border-b border-ink-100 pb-3">
            <span className="text-sm font-semibold text-ink-500 w-8">CC</span>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="Add CC emails (comma separated)"
              className="flex-1 text-sm text-ink-900 placeholder:text-ink-300 outline-none bg-transparent"
            />
          </div>

          {/* Subject */}
          <div className="flex items-center gap-3 border-b border-ink-100 pb-3">
            <span className="text-sm font-semibold text-ink-500 w-8">Subject</span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="flex-1 text-sm text-ink-900 outline-none bg-transparent"
            />
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-ink-500">Message</span>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-1.5 text-xs font-semibold text-ink-400 hover:text-ink-700 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                {showPreview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {showPreview ? (
              <div className="bg-ink-50 rounded-xl p-4 text-sm text-ink-700 whitespace-pre-wrap min-h-[120px]">
                {message}
              </div>
            ) : (
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="w-full bg-ink-50 rounded-xl p-4 text-sm text-ink-900 placeholder:text-ink-300 outline-none resize-none focus:ring-2 focus:ring-brand-500/20"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-ink-100 bg-ink-50/50">
          <div className="flex items-center gap-1">
            <button onClick={handleCopyLink} className="p-2.5 rounded-xl text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Copy link">
              <Copy className="w-4 h-4" />
            </button>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="p-2.5 rounded-xl text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors" title="Download PDF">
                <Download className="w-4 h-4" />
              </a>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !to}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-brand-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending...' : 'Send invoice'}
          </button>
        </div>
      </div>
    </div>
  );
}
