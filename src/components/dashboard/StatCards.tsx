'use client';

import { useState, useEffect } from 'react';
import HelpPopover from '@/components/ui/HelpPopover';
import { createClient } from '@/lib/supabase/client';

interface CurrencyStats {
  currency: string;
  outstanding: number;
  paid: number;
  overdue: number;
  this_month: number;
  total_volume: number;
  invoice_count: number;
}

interface StatCardsProps {
  topCurrencies: CurrencyStats[];
  otherCurrencies: CurrencyStats[];
  businessFilter?: string | null;
  activeWorkspaceId?: string;
}

export default function StatCards({ topCurrencies, otherCurrencies, businessFilter, activeWorkspaceId }: StatCardsProps) {
  const [showAll, setShowAll] = useState(false);
  const [businessStats, setBusinessStats] = useState<{ top: CurrencyStats[], other: CurrencyStats[] } | null>(null);

  useEffect(() => {
    async function loadBusinessStats() {
      if (!businessFilter || !activeWorkspaceId) {
        setBusinessStats(null);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from('invoices')
        .select('currency, payment_status, type, amount, created_at, due_date')
        .eq('workspace_id', activeWorkspaceId)
        .eq('business_profile_name', businessFilter)
        .is('deleted_at', null);

      if (!data) return;

      const currencyMap = new Map<string, CurrencyStats>();
      
      data.forEach(inv => {
        const c = inv.currency || 'INR';
        if (!currencyMap.has(c)) {
          currencyMap.set(c, { currency: c, outstanding: 0, paid: 0, overdue: 0, this_month: 0, total_volume: 0, invoice_count: 0 });
        }
        const s = currencyMap.get(c)!;
        s.invoice_count++;
        s.total_volume += inv.amount || 0;
        
        const isThisMonth = new Date(inv.created_at).getMonth() === new Date().getMonth() && new Date(inv.created_at).getFullYear() === new Date().getFullYear();
        if (isThisMonth) s.this_month += inv.amount || 0;

        if (inv.type !== 'invoice') return; // We ONLY care about real invoices for revenue metrics!

        if (inv.payment_status === 'paid') s.paid += inv.amount || 0;
        if (inv.payment_status === 'unpaid') s.outstanding += inv.amount || 0;
        if (inv.payment_status === 'overdue' || (inv.payment_status === 'unpaid' && inv.due_date && new Date(inv.due_date) < new Date())) {
          s.overdue += inv.amount || 0;
          if (inv.payment_status === 'overdue') s.outstanding += inv.amount || 0;
        }
      });

      const allStats = Array.from(currencyMap.values()).sort((a, b) => b.total_volume - a.total_volume);
      setBusinessStats({ top: allStats.slice(0, 3), other: allStats.slice(3) });
    }
    loadBusinessStats();
  }, [businessFilter, activeWorkspaceId]);

  const activeTopCurrencies = businessStats ? businessStats.top : topCurrencies;
  const activeOtherCurrencies = businessStats ? businessStats.other : otherCurrencies;

  const formatCurrency = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency || 'INR',
        maximumFractionDigits: 0
      }).format(amount);
    } catch (e) {
      return `${currency} ${amount.toLocaleString()}`;
    }
  };

  const renderMetricList = (type: 'outstanding' | 'paid' | 'overdue' | 'this_month') => {
    const list = showAll ? [...activeTopCurrencies, ...activeOtherCurrencies] : activeTopCurrencies;
    
    if (list.length === 0) return <div className="text-3xl font-black text-ink-900">₹0</div>;

    // Sort to show the currency with highest value in this category first
    const sortedList = [...list].sort((a, b) => b[type] - a[type]);
    const displayedList = showAll ? sortedList : sortedList.slice(0, 3);

    const elements = displayedList.map((c, i) => {
      const val = c[type];
      if (val === 0 && displayedList.length > 1 && !showAll) return null; 
      
      return (
        <div key={c.currency} className="flex flex-col min-w-0">
          <div className={`font-bold text-ink-900 flex items-baseline gap-2 ${
            i === 0 ? 'text-3xl xl:text-4xl tracking-tight min-w-0' : 
            i === 1 ? 'text-xl text-ink-800 min-w-0' : 
            'text-base text-ink-600 min-w-0'
          }`}>
            <span className="truncate">{formatCurrency(val, c.currency)}</span>
            <span className={`font-bold text-ink-400 uppercase tracking-widest shrink-0 ${
              i === 0 ? 'text-xs' :
              i === 1 ? 'text-[10px]' :
              'text-[9px]'
            }`}>{c.currency}</span>
          </div>
        </div>
      );
    }).filter(Boolean);

    if (elements.length === 0) {
      // If we filtered out everything (e.g. all multiple currencies had 0 for this metric), show the primary currency at 0
      const primaryCurrency = list[0]?.currency || 'USD';
      elements.push(
        <div key="fallback" className="flex flex-col min-w-0">
          <div className="font-bold text-ink-900 flex items-baseline gap-2 text-3xl xl:text-4xl tracking-tight min-w-0">
            <span className="truncate">{formatCurrency(0, primaryCurrency)}</span>
            <span className="font-bold text-ink-400 uppercase tracking-widest text-xs shrink-0">{primaryCurrency}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {elements}
        {!showAll && otherCurrencies && otherCurrencies.length > 0 && (
          <button 
            onClick={() => setShowAll(true)}
            className="text-[10px] font-bold text-brand-600 uppercase tracking-widest hover:underline mt-2 bg-brand-50 px-2 py-1 rounded-md shrink-0"
          >
            + {otherCurrencies.length} more
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Outstanding Card */}
        <div className="glass-card p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-ink-500 uppercase tracking-widest">Outstanding</span>
              <HelpPopover 
                title="Outstanding" 
                content="Total amount from invoices that have been Sent but are not yet Paid or Overdue. Draft and Quote invoices are excluded." 
              />
            </div>
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
          </div>
          {renderMetricList('outstanding')}
          <div className="text-xs text-ink-400 mt-4 font-medium">Across all pending jobs</div>
        </div>

        {/* Paid Card */}
        <div className="glass-card p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-ink-500 uppercase tracking-widest">Paid (total)</span>
              <HelpPopover 
                title="Paid" 
                content="Total amount from all invoices that have been marked as Paid." 
              />
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
          </div>
          {renderMetricList('paid')}
          <div className="text-xs text-ink-400 mt-4 font-medium">Successfully completed</div>
        </div>

        {/* Overdue Card */}
        <div className="glass-card p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-ink-500 uppercase tracking-widest">Overdue</span>
              <HelpPopover 
                title="Overdue" 
                content="Total amount from invoices that have passed their due date and have been marked as Overdue." 
              />
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
          </div>
          {renderMetricList('overdue')}
          <div className="text-xs text-ink-400 mt-4 font-medium">Payment past due date</div>
        </div>

        {/* This Month Card */}
        <div className="glass-card p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-ink-500 uppercase tracking-widest">This Month</span>
              <HelpPopover 
                title="This Month" 
                content="Total value of all invoices created since the 1st of the current month, regardless of their payment status." 
              />
            </div>
            <div className="w-10 h-10 rounded-xl bg-ink-100 text-ink-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>
          </div>
          {renderMetricList('this_month')}
          <div className="text-xs text-ink-400 mt-4 font-medium">Volume since {new Date().toLocaleString('default', { month: 'long' })} 1st</div>
        </div>
      </div>

      {showAll && (
        <div className="flex justify-end">
          <button 
            onClick={() => setShowAll(false)}
            className="text-xs font-bold text-ink-500 hover:text-ink-700 bg-ink-100 px-3 py-1.5 rounded-lg"
          >
            Show top 3 only
          </button>
        </div>
      )}
    </div>
  );
}
