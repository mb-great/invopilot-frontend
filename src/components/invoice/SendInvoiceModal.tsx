'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Mail, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

interface SendInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceId: string;
  defaultEmail?: string;
  invoiceNumber?: string;
}

export function SendInvoiceModal({ isOpen, onClose, invoiceId, defaultEmail, invoiceNumber }: SendInvoiceModalProps) {
  const [toEmail, setToEmail] = useState(defaultEmail || '');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail) {
      toast.error('Recipient email is required');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/invoices/${invoiceId}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toEmail
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send email');
      }

      toast.success('Email sent successfully!');
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl w-[95vw] mx-auto p-6 border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-ink-900 mb-2 flex items-center gap-2">
            <Mail className="w-5 h-5 text-brand-500" />
            Send Invoice {invoiceNumber ? `#${invoiceNumber}` : ''}
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-500">
            Email this invoice directly to your client. They will receive a link to download the PDF.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSend} className="mt-4 flex flex-col gap-4">
          <div>
            <label className="block text-xs uppercase font-bold text-ink-400 mb-1 tracking-widest">
              Recipient Email
            </label>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 transition-colors text-ink-900"
              placeholder="client@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-bold text-ink-600 hover:bg-ink-50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !toEmail}
              className="px-6 py-2 bg-brand-500 text-white text-sm font-bold rounded-xl hover:bg-brand-600 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-brand-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Email
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
