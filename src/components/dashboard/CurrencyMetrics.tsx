import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CurrencyStats {
  currency: string;
  outstanding: number;
  paid: number;
  overdue: number;
  this_month: number;
  total_volume: number;
  invoice_count: number;
}

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

export default function CurrencyMetrics({ stats }: { stats: { top_currencies: CurrencyStats[], other_currencies?: CurrencyStats[] } }) {
  const [showAll, setShowAll] = useState(false);

  if (!stats || !stats.top_currencies || stats.top_currencies.length === 0) {
    return (
      <div className="py-6 text-center text-ink-400 italic text-xs border border-ink-100 rounded-xl bg-ink-50/50">
        No transaction data available yet.
      </div>
    );
  }

  const currencies = showAll 
    ? [...stats.top_currencies, ...(stats.other_currencies || [])]
    : stats.top_currencies.slice(0, 3);

  const hasMore = (stats.top_currencies.length > 3 || (stats.other_currencies && stats.other_currencies.length > 0));

  return (
    <div className="space-y-4">
      {currencies.map((c, index) => {
        // Strict Hierarchy: 1st gets h2, 2nd gets h5, 3rd gets h6, others get standard small text
        let titleClass = "font-bold text-ink-900";
        let amountClass = "font-bold text-emerald-600";
        
        if (index === 0) {
          titleClass = "text-xl font-bold text-ink-900"; // h2 equivalent in scale context
          amountClass = "text-3xl font-bold text-emerald-600 tracking-tight";
        } else if (index === 1) {
          titleClass = "text-base font-bold text-ink-800"; // h5 equivalent
          amountClass = "text-xl font-bold text-emerald-600";
        } else if (index === 2) {
          titleClass = "text-sm font-bold text-ink-700"; // h6 equivalent
          amountClass = "text-lg font-bold text-emerald-600";
        } else {
          titleClass = "text-xs font-bold text-ink-600 uppercase tracking-widest";
          amountClass = "text-base font-bold text-emerald-600";
        }

        return (
          <div key={c.currency} className={`p-5 rounded-xl border border-ink-100 bg-white shadow-sm flex flex-col ${index === 0 ? 'bg-gradient-to-br from-white to-emerald-50/30 border-emerald-100' : ''}`}>
            <div className="flex justify-between items-end mb-2">
              <h2 className={titleClass}>{c.currency} <span className="text-[10px] font-normal text-ink-400 ml-2 uppercase tracking-widest bg-ink-100 px-2 py-0.5 rounded-full">{c.invoice_count} inv</span></h2>
            </div>
            
            <div className={amountClass}>
              {formatCurrency(c.paid, c.currency)}
            </div>
            
            <div className="mt-3 pt-3 border-t border-ink-100 flex justify-between items-center text-xs">
              <span className="text-ink-500 font-medium">Outstanding</span>
              <span className="font-bold text-brand-600">{formatCurrency(c.outstanding, c.currency)}</span>
            </div>
          </div>
        );
      })}

      {hasMore && (
        <button 
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold text-ink-500 hover:text-brand-600 bg-ink-50 hover:bg-brand-50 rounded-lg transition-colors border border-ink-100"
        >
          {showAll ? (
            <>View Less <ChevronUp className="w-4 h-4" /></>
          ) : (
            <>View All Currencies <ChevronDown className="w-4 h-4" /></>
          )}
        </button>
      )}
    </div>
  );
}
