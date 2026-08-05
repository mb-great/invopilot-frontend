'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Eye, Mail, MessageCircle, Send, Globe, Clock, UserCheck, Info, Layers, List } from 'lucide-react';

export interface ViewEvent {
  timestamp: string;
  source: string;
  viewer: string;
}

export interface InvoiceActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    invoice_number?: string | null;
    nickname?: string | null;
    client_name?: string | null;
    client_email?: string | null;
    view_count?: number;
    mail_views?: number;
    whatsapp_views?: number;
    telegram_views?: number;
    direct_views?: number;
    first_viewed_at?: string | null;
    last_viewed_at?: string | null;
    view_events?: ViewEvent[];
  } | null;
}

interface StackedViewer {
  viewer: string;
  source: string;
  count: number;
  latest: string;
  first: string;
}

export function InvoiceActivityModal({ isOpen, onClose, invoice }: InvoiceActivityModalProps) {
  const [viewMode, setViewMode] = useState<'stacked' | 'all'>('stacked');

  const viewEvents = invoice?.view_events;

  // Stacked view events: Combines repeated opens from the same viewer & channel (Hook called unconditionally)
  const stackedViewers: StackedViewer[] = useMemo(() => {
    if (!Array.isArray(viewEvents) || viewEvents.length === 0) return [];
    
    const map = new Map<string, StackedViewer>();
    
    for (const ev of viewEvents) {
      const key = `${ev.viewer || 'Anonymous Client'}__${(ev.source || 'directlink').toLowerCase()}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          viewer: ev.viewer || 'Anonymous Client',
          source: ev.source || 'directlink',
          count: 1,
          latest: ev.timestamp,
          first: ev.timestamp,
        });
      } else {
        existing.count += 1;
        existing.latest = ev.timestamp;
      }
    }
    
    return Array.from(map.values()).sort((a, b) => new Date(b.latest).getTime() - new Date(a.latest).getTime());
  }, [viewEvents]);

  const rawEvents = useMemo(() => {
    return Array.isArray(viewEvents)
      ? [...viewEvents].reverse().slice(0, 25)
      : [];
  }, [viewEvents]);

  if (!invoice) return null;

  const totalViews = invoice.view_count || 0;
  const mailViews = invoice.mail_views || 0;
  const whatsappViews = invoice.whatsapp_views || 0;
  const telegramViews = invoice.telegram_views || 0;
  const directViews = invoice.direct_views || 0;

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Never';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getSourceBadge = (source: string) => {
    switch (source?.toLowerCase()) {
      case 'mail':
      case 'email':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
            <Mail className="w-3 h-3" /> Email
          </span>
        );
      case 'whatsapp':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 shrink-0">
            <MessageCircle className="w-3 h-3" /> WhatsApp
          </span>
        );
      case 'telegram':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 shrink-0">
            <Send className="w-3 h-3" /> Telegram
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200 shrink-0">
            <Globe className="w-3 h-3" /> Direct Link
          </span>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-white rounded-2xl w-[95vw] mx-auto p-4 sm:p-6 border border-ink-100 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-ink-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-extrabold text-ink-900 leading-tight">
                Invoice Activity
              </DialogTitle>
              <DialogDescription className="text-xs text-ink-500 truncate mt-0.5">
                {invoice.invoice_number || invoice.nickname || 'Invoice'} · Multi-channel tracking
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Metrics Grid: 2x2 on mobile, 4 columns on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="bg-ink-50/80 rounded-xl p-2.5 sm:p-3 text-center border border-ink-100">
            <span className="text-[11px] font-semibold text-ink-500 block">Total Opens</span>
            <span className="text-xl sm:text-2xl font-extrabold text-ink-900">{totalViews}</span>
          </div>
          <div className="bg-blue-50/50 rounded-xl p-2.5 sm:p-3 text-center border border-blue-100">
            <span className="text-[11px] font-semibold text-blue-600 block">Via Email</span>
            <span className="text-xl sm:text-2xl font-extrabold text-blue-900">{mailViews}</span>
          </div>
          <div className="bg-green-50/50 rounded-xl p-2.5 sm:p-3 text-center border border-green-100">
            <span className="text-[11px] font-semibold text-green-600 block">WhatsApp</span>
            <span className="text-xl sm:text-2xl font-extrabold text-green-900">{whatsappViews}</span>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 text-center border border-slate-200">
            <span className="text-[11px] font-semibold text-slate-600 block">Direct / Link</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900">{directViews + telegramViews}</span>
          </div>
        </div>

        {/* First / Last Opened: Stacked on mobile, 2 cols on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-ink-50/50 p-3 rounded-xl border border-ink-100">
          <div className="flex items-center gap-2 text-ink-600">
            <Clock className="w-4 h-4 text-ink-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-ink-400 block">First Opened</span>
              <span className="font-semibold text-ink-800 truncate block">{formatDate(invoice.first_viewed_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-ink-600">
            <Eye className="w-4 h-4 text-ink-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-ink-400 block">Last Opened</span>
              <span className="font-semibold text-ink-800 truncate block">{formatDate(invoice.last_viewed_at)}</span>
            </div>
          </div>
        </div>

        {/* View Log with Stacked / Flat Toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-700 uppercase tracking-wider">
              {viewMode === 'stacked' ? 'Viewers & Activity' : 'Activity History'}
            </span>
            <div className="flex items-center bg-ink-100 p-0.5 rounded-lg text-[11px] font-medium text-ink-600">
              <button
                type="button"
                onClick={() => setViewMode('stacked')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'stacked' ? 'bg-white text-ink-900 shadow-sm font-bold' : 'hover:text-ink-900'
                }`}
              >
                <Layers className="w-3 h-3" /> Stacked
              </button>
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'all' ? 'bg-white text-ink-900 shadow-sm font-bold' : 'hover:text-ink-900'
                }`}
              >
                <List className="w-3 h-3" /> Log
              </button>
            </div>
          </div>

          {stackedViewers.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-ink-200 rounded-xl bg-ink-50/30 text-ink-400 text-xs">
              No recorded activity yet. Once the recipient views this invoice, details will appear here.
            </div>
          ) : viewMode === 'stacked' ? (
            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 text-xs">
              {stackedViewers.map((viewer, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl border border-ink-100 bg-white hover:bg-ink-50/40 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserCheck className="w-4 h-4 text-brand-500 shrink-0" />
                      <span className="font-bold text-ink-900 text-[13px] truncate" title={viewer.viewer}>
                        {viewer.viewer}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {getSourceBadge(viewer.source)}
                      {viewer.count > 1 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                          {viewer.count} opens
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-ink-400 pt-0.5 border-t border-ink-50">
                    <span>Latest: <strong className="text-ink-700 font-semibold">{formatDate(viewer.latest)}</strong></span>
                    {viewer.count > 1 && (
                      <span className="text-[10.5px] text-ink-400">First: {formatDate(viewer.first)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1 text-xs">
              {rawEvents.map((ev, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl border border-ink-100 bg-white hover:bg-ink-50/40 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserCheck className="w-4 h-4 text-brand-500 shrink-0" />
                      <span className="font-bold text-ink-900 text-[13px] truncate" title={ev.viewer}>
                        {ev.viewer || 'Anonymous Client'}
                      </span>
                    </div>
                    {getSourceBadge(ev.source)}
                  </div>
                  <div className="text-right text-[11px] text-ink-400 border-t border-ink-50 pt-0.5">
                    <strong className="text-ink-700 font-semibold">{formatDate(ev.timestamp)}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subtle Anonymous Notice Banner */}
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/70 text-amber-900 text-[11px] leading-relaxed">
          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Viewer Attribution:</strong> If the client is logged in with an InvoPilot account, their profile is recognized. Public / unregistered clients are accurately tracked as <em>Anonymous Client (via source channel)</em>.
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
