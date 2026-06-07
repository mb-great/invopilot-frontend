'use client';

import { useState } from 'react';

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
}

export default function StatCards({ topCurrencies, otherCurrencies }: StatCardsProps) {
  const [showAll, setShowAll] = useState(false);

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
    const list = showAll ? [...topCurrencies, ...otherCurrencies] : topCurrencies;
    
    if (list.length === 0) return <div className="text-3xl font-black text-ink-900">₹0</div>;

    // Sort to show the currency with highest value in this category first
    const sortedList = [...list].sort((a, b) => b[type] - a[type]);
    const displayedList = showAll ? sortedList : sortedList.slice(0, 3);

    return (
      <div className="space-y-2">
        {displayedList.map((c, i) => {
          const val = c[type];
          if (val === 0 && displayedList.length > 1 && !showAll) return null; 
          
          return (
            <div key={c.currency} className="flex flex-col">
              <div className={`font-bold text-ink-900 flex items-baseline gap-1.5 ${
                i === 0 ? 'text-3xl font-black' : 
                i === 1 ? 'text-lg font-bold text-ink-700' : 
                'text-xs font-semibold text-ink-500'
              }`}>
                {formatCurrency(val, c.currency)}
                <span className={`font-bold text-ink-400 uppercase tracking-tighter ${
                  i === 0 ? 'text-[10px]' :
                  i === 1 ? 'text-[8px]' :
                  'text-[7px]'
                }`}>{c.currency}</span>
              </div>
            </div>
          );
        })}
        {!showAll && otherCurrencies.length > 0 && (
          <button 
            onClick={() => setShowAll(true)}
            className="text-[10px] font-bold text-brand-600 uppercase tracking-tight hover:underline mt-1 bg-brand-50 px-2 py-0.5 rounded-md"
          >
            + {otherCurrencies.length} more
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Outstanding Card */}
        <div className="glass-card p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-ink-500 uppercase tracking-wider">Outstanding</span>
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
          </div>
          {renderMetricList('outstanding')}
          <div className="text-xs text-ink-400 mt-2 font-medium">Across all pending jobs</div>
        </div>

        {/* Paid Card */}
        <div className="glass-card p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-ink-500 uppercase tracking-wider">Paid (total)</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
          </div>
          {renderMetricList('paid')}
          <div className="text-xs text-ink-400 mt-2 font-medium">Successfully completed</div>
        </div>

        {/* Overdue Card */}
        <div className="glass-card p-6 hover:shadow-md transition-shadow text-red-600 bg-red-50/10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-ink-500 uppercase tracking-wider">Overdue</span>
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
          </div>
          {renderMetricList('overdue')}
          <div className="text-xs text-ink-400 mt-2 font-medium">Payment past due date</div>
        </div>

        {/* This Month Card */}
        <div className="glass-card p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-ink-500 uppercase tracking-wider">This Month</span>
            <div className="w-10 h-10 rounded-xl bg-ink-100 text-ink-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            </div>
          </div>
          {renderMetricList('this_month')}
          <div className="text-xs text-ink-400 mt-2 font-medium">Volume since {new Date().toLocaleString('default', { month: 'long' })} 1st</div>
        </div>
      </div>

      {showAll && (
        <div className="flex justify-end">
          <button 
            onClick={() => setShowAll(false)}
            className="text-xs font-bold text-ink-400 hover:text-ink-600"
          >
            Show top 3 only
          </button>
        </div>
      )}
    </div>
  );
}
