'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Copy, MessageCircle, Share2, MessageSquare } from 'lucide-react';
import { useState } from 'react';

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
}

export function ShareDialog({ isOpen, onClose, shareUrl }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const shareText = "Here is your invoice.";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Invoice',
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.error('Error sharing natively', err);
      }
    } else {
      alert("Native sharing not supported on this browser.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white rounded-2xl w-[95vw] mx-auto p-6 border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-ink-900 mb-4">Share Invoice</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-4 gap-4 pb-4">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
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
            href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 group-hover:bg-blue-100 transition-colors">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .24z"/></svg>
            </div>
            <span className="text-[10px] font-bold text-ink-600 uppercase tracking-tighter">Telegram</span>
          </a>

          <a
            href={`fb-messenger://share/?link=${encodeURIComponent(shareUrl)}`}
            className="flex flex-col items-center gap-2 group md:hidden"
          >
            <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 group-hover:bg-purple-100 transition-colors">
              <MessageSquare className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-bold text-ink-600 uppercase tracking-tighter">Messenger</span>
          </a>
          <a
            href={`https://www.facebook.com/dialog/send?link=${encodeURIComponent(shareUrl)}&app_id=123456789&redirect_uri=${encodeURIComponent(shareUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex flex-col items-center gap-2 group"
          >
            <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 group-hover:bg-purple-100 transition-colors">
              <MessageSquare className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-bold text-ink-600 uppercase tracking-tighter">Messenger</span>
          </a>

          <button
            onClick={handleNativeShare}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-14 h-14 bg-ink-50 rounded-full flex items-center justify-center text-ink-600 group-hover:bg-ink-100 transition-colors">
              <Share2 className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-bold text-ink-600 uppercase tracking-tighter">Others</span>
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-ink-100 flex items-center gap-2">
          <input 
            type="text" 
            readOnly 
            value={shareUrl} 
            className="flex-1 bg-ink-50 border border-ink-200 rounded-lg px-3 py-2 text-xs text-ink-600 outline-none truncate"
          />
          <button 
            onClick={handleCopy}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg font-bold text-xs hover:bg-brand-600 transition-colors flex items-center gap-2"
          >
            {copied ? 'Done' : <><Copy className="w-4 h-4" /> Copy</>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
