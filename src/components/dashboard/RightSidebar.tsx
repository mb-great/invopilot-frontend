'use client';

import Link from 'next/link';
import { resolvePlanAccess } from '@/lib/billing/tiers';
import { FileText, Plus, Settings, CreditCard, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function RightSidebar({ 
  profile, 
  stats, 
  recentInvoices,
  currentStorageBytes
}: { 
  profile: any, 
  stats: any, 
  recentInvoices: any[],
  currentStorageBytes?: number
}) {
  const access = resolvePlanAccess(profile);
  const used = stats?.total_invoice_count || 0;
  
  // Calculate remaining limits (using lifetime for free tier, or assuming period count matches total for simplicity here)
  const limit = access.plan.maxInvoices;
  const isUnlimited = limit === 'unlimited';
  const remaining = isUnlimited ? null : Math.max((limit as number) - used, 0);
  const percentage = isUnlimited ? 0 : Math.min((used / (limit as number)) * 100, 100);

  // Calculate storage usage
  const storageLimit = access.plan.maxStorageBytes;
  const storageUsed = currentStorageBytes || 0;
  const storagePercentage = Math.min((storageUsed / storageLimit) * 100, 100);
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formattedStorageUsed = formatBytes(storageUsed);
  const formattedStorageLimit = formatBytes(storageLimit);

  // Derive Insights (Overdue / Unpaid)
  const unpaidInvoices = recentInvoices.filter(i => i.payment_status !== 'paid');
  const overdueCount = unpaidInvoices.filter(i => {
    const dueDateValue = i.due_date || (i as any).dueDate || i.form_data?.dueDate;
    if (!dueDateValue) return false;
    const dueDate = new Date(dueDateValue);
    return dueDate.getTime() < new Date().getTime();
  }).length;

  return (
    <div className="space-y-6 shrink-0 w-full">
      {/* SUBSCRIPTION SNAPSHOT */}
      <div className="glass-card flex flex-col overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between">
          <h2 className="font-bold text-ink-800 tracking-tight text-sm uppercase">Your Plan</h2>
          <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[10px] font-bold uppercase tracking-wider border border-brand-100">
            {access.plan.name}
          </span>
        </div>
        <div className="p-5">
          <div className="flex justify-between text-xs font-bold mb-2">
            <span className="text-ink-500">Invoices Used</span>
            <span className="text-ink-900">{used} / {isUnlimited ? '∞' : limit}</span>
          </div>
          {!isUnlimited && (
            <div className="w-full h-2 bg-ink-100 rounded-full overflow-hidden mb-4">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${percentage > 90 ? 'bg-red-500' : 'bg-brand-500'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          )}

          <div className="flex justify-between text-xs font-bold mb-2 relative group cursor-help">
            <span className="text-ink-500 flex items-center gap-1">
              Storage Used
              {storagePercentage >= 100 && <AlertCircle className="w-3 h-3 text-red-500 animate-pulse" />}
            </span>
            <span className={`${storagePercentage >= 100 ? 'text-red-600' : 'text-ink-900'}`}>
              {formattedStorageUsed} / {formattedStorageLimit}
            </span>
            
            {storagePercentage >= 100 && (
              <div className="absolute right-0 top-6 w-56 p-3 bg-red-950 text-red-50 text-[11px] font-medium leading-relaxed rounded-xl shadow-xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none border border-red-900/50">
                <strong className="block text-white mb-1">Storage Limit Reached</strong>
                Generating a new invoice will automatically purge your oldest PDF to make room. Upgrade your plan for more space.
              </div>
            )}
          </div>
          <div className="w-full h-2 bg-ink-100 rounded-full overflow-hidden mb-4">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${storagePercentage >= 100 ? 'bg-red-500' : storagePercentage > 90 ? 'bg-amber-500' : 'bg-brand-500'}`}
              style={{ width: `${storagePercentage}%` }}
            />
          </div>
          
          {access.effectiveTier === 'free' && (
            <Link href="/pricing" className="block w-full text-center py-2 rounded-lg bg-ink-900 text-white text-xs font-bold hover:bg-ink-800 transition-colors">
              Upgrade to Starter
            </Link>
          )}
        </div>
      </div>

      {/* INSIGHTS */}
      <div className="glass-card flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-100 bg-amber-50/30">
          <h2 className="font-bold text-ink-800 tracking-tight text-sm uppercase">Insights</h2>
        </div>
        <div className="p-0">
          <div className="flex items-center gap-3 p-4 border-b border-ink-50 last:border-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${overdueCount > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {overdueCount > 0 ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <p className="font-bold text-ink-900 text-sm">
                {overdueCount > 0 ? `${overdueCount} Overdue Invoices` : 'All caught up!'}
              </p>
              <p className="text-xs text-ink-500">
                {overdueCount > 0 ? 'Clients are late on payments.' : 'No invoices are past due.'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-4 border-b border-ink-50 last:border-0">
            <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-ink-900 text-sm">{unpaidInvoices.length} Unpaid Invoices</p>
              <p className="text-xs text-ink-500">Total outstanding drafts & sent.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ACTIVITY LOG */}
      <div className="glass-card flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-ink-100">
          <h2 className="font-bold text-ink-800 tracking-tight text-sm uppercase">Recent Activity</h2>
        </div>
        <div className="p-5 space-y-4">
          {recentInvoices.slice(0, 3).map((inv, idx) => (
            <div key={inv.id} className="flex gap-3 relative">
              {idx !== 2 && idx !== recentInvoices.length - 1 && (
                <div className="absolute left-[9px] top-6 bottom-[-16px] w-[2px] bg-ink-100" />
              )}
              <div className="w-5 h-5 rounded-full bg-ink-100 border-2 border-white shrink-0 z-10 flex items-center justify-center mt-0.5">
                <Clock className="w-3 h-3 text-ink-400" />
              </div>
              <div>
                <p className="text-sm text-ink-900">
                  Generated <span className="font-bold">{inv.invoice_number || inv.nickname || 'Invoice'}</span>
                </p>
                <p className="text-xs text-ink-400 mt-0.5">
                  {format(new Date(inv.created_at), 'MMM d, h:mm a')}
                </p>
              </div>
            </div>
          ))}
          {recentInvoices.length === 0 && (
            <p className="text-sm text-ink-400 text-center py-2">No recent activity.</p>
          )}
        </div>
      </div>
    </div>
  );
}
