'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useMemo, useState, useEffect } from 'react';
import { resolvePlanAccess } from '@/lib/billing/tiers';
import { toast } from 'sonner';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface Invoice {
  amount?: number;
  currency?: string;
  payment_status?: string;
  created_at: string;
  form_data?: any;
}

interface Props {
  activeWorkspaceId?: string;
  targetCurrency?: string;
  profile?: any;
  businessFilter?: string | null;
}

type RangeType = '30days' | '1year' | 'lifetime' | 'custom';

export default function RevenueChart({ activeWorkspaceId, targetCurrency = 'USD', profile, businessFilter }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rangeType, setRangeType] = useState<RangeType>('30days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    async function fetchInvoices() {
      try {
        setIsLoading(true);
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        
        const { data: { user } } = await supabase.auth.getUser();
        let targetUser = user?.id;

        const { data } = await supabase.rpc('get_revenue_chart_series', {
          target_workspace_id: activeWorkspaceId || null,
          target_user_id: !activeWorkspaceId ? targetUser : null,
          start_date: null,
          end_date: null,
          group_by: 'day',
          target_business: businessFilter || null
        });
        
        if (data) setInvoices(data as any);
      } catch (e) {
        console.error("Failed to fetch invoices for chart", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchInvoices();
  }, [activeWorkspaceId, businessFilter]);

  const currencies = useMemo(() => {
    const list = new Set<string>();
    invoices.forEach((point: any) => {
      if (point.currency) list.add(point.currency.toUpperCase());
    });
    const arr = Array.from(list);
    return arr.length > 0 ? arr : ['USD'];
  }, [invoices]);

  const [selectedCurrency, setSelectedCurrency] = useState<string>(
    targetCurrency && currencies.includes(targetCurrency.toUpperCase()) 
      ? targetCurrency.toUpperCase() 
      : currencies[0]
  );

  useEffect(() => {
    if (targetCurrency && currencies.includes(targetCurrency.toUpperCase())) {
      setSelectedCurrency(targetCurrency.toUpperCase());
    }
  }, [targetCurrency, currencies]);

  const access = resolvePlanAccess({
    role: profile?.role,
    tier: profile?.tier,
    subscription_status: profile?.subscription_status,
    subscription_period_end: profile?.subscription_period_end,
  });

  const canUseCustomRange = access.effectiveTier === 'pro' || access.effectiveTier === 'business' || access.isAdmin;

  const handleRangeChange = (type: RangeType) => {
    if (type === 'custom' && !canUseCustomRange) {
      toast.error('Upgrade to Pro or Business to use Custom Date Range charts');
      return;
    }
    setRangeType(type);
  };

  const chartData = useMemo(() => {
    const now = new Date();
    const labelUnits: { label: string; key: string; start: Date; end: Date; revenue: number }[] = [];

    if (rangeType === '30days') {
      // Daily labels for last 30 days
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 0, 0, 0);
        const nextD = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1, 0, 0, 0);
        labelUnits.push({
          label: d.toLocaleDateString('default', { month: 'short', day: 'numeric' }),
          key: d.toDateString(),
          start: d,
          end: nextD,
          revenue: 0
        });
      }
    } else if (rangeType === '1year') {
      // Monthly labels for last 12 months
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0);
        const nextM = new Date(now.getFullYear(), now.getMonth() - i + 1, 1, 0, 0, 0);
        labelUnits.push({
          label: d.toLocaleDateString('default', { month: 'short', year: '2-digit' }),
          key: `${d.getMonth()}-${d.getFullYear()}`,
          start: d,
          end: nextM,
          revenue: 0
        });
      }
    } else if (rangeType === 'lifetime') {
      // Dynamic monthly labels from earliest invoice to now
      let earliest = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0);
      if (invoices.length > 0) {
        const dates = invoices.map((i: any) => new Date(i.date).getTime());
        const minDate = new Date(Math.min(...dates));
        earliest = new Date(minDate.getFullYear(), minDate.getMonth(), 1, 0, 0, 0);
      }

      const diffMonths = (now.getFullYear() - earliest.getFullYear()) * 12 + now.getMonth() - earliest.getMonth();
      const limitMonths = Math.min(Math.max(diffMonths, 11), 60);

      for (let i = limitMonths; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1, 0, 0, 0);
        const nextM = new Date(now.getFullYear(), now.getMonth() - i + 1, 1, 0, 0, 0);
        labelUnits.push({
          label: d.toLocaleDateString('default', { month: 'short', year: '2-digit' }),
          key: `${d.getMonth()}-${d.getFullYear()}`,
          start: d,
          end: nextM,
          revenue: 0
        });
      }
    } else if (rangeType === 'custom') {
      // Custom date range daily, weekly, or monthly depending on size
      const sDate = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      const eDate = endDate ? new Date(endDate) : new Date();
      sDate.setHours(0, 0, 0, 0);
      eDate.setHours(23, 59, 59, 999);

      const diffTime = Math.abs(eDate.getTime() - sDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 31) {
        // Daily
        for (let i = 0; i < diffDays; i++) {
          const d = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate() + i, 0, 0, 0);
          const nextD = new Date(sDate.getFullYear(), sDate.getMonth(), sDate.getDate() + i + 1, 0, 0, 0);
          labelUnits.push({
            label: d.toLocaleDateString('default', { month: 'short', day: 'numeric' }),
            key: d.toDateString(),
            start: d,
            end: nextD,
            revenue: 0
          });
        }
      } else if (diffDays <= 95) {
        // Weekly
        let cursor = new Date(sDate);
        while (cursor.getTime() <= eDate.getTime()) {
          const nextW = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7, 0, 0, 0);
          labelUnits.push({
            label: `W/C ${cursor.toLocaleDateString('default', { month: 'short', day: 'numeric' })}`,
            key: cursor.toDateString(),
            start: new Date(cursor),
            end: nextW,
            revenue: 0
          });
          cursor = nextW;
        }
      } else {
        // Monthly
        const diffMonths = (eDate.getFullYear() - sDate.getFullYear()) * 12 + eDate.getMonth() - sDate.getMonth();
        const limitMonths = Math.min(diffMonths, 60);
        for (let i = 0; i <= limitMonths; i++) {
          const d = new Date(sDate.getFullYear(), sDate.getMonth() + i, 1, 0, 0, 0);
          const nextM = new Date(sDate.getFullYear(), sDate.getMonth() + i + 1, 1, 0, 0, 0);
          labelUnits.push({
            label: d.toLocaleDateString('default', { month: 'short', year: '2-digit' }),
            key: `${d.getMonth()}-${d.getFullYear()}`,
            start: d,
            end: nextM,
            revenue: 0
          });
        }
      }
    }

    // Sum revenues
    labelUnits.forEach(unit => {
      let revenue = 0;
      invoices.forEach((point: any) => {
        const pointDate = new Date(point.date);
        if (pointDate.getTime() >= unit.start.getTime() && pointDate.getTime() < unit.end.getTime()) {
          if (point.currency.toUpperCase() === selectedCurrency.toUpperCase()) {
            revenue += (point.paid + point.overdue + point.outstanding);
          }
        }
      });
      unit.revenue = revenue;
    });

    return {
      labels: labelUnits.map(u => u.label),
      datasets: [
        {
          label: 'Revenue',
          data: labelUnits.map(u => u.revenue),
          borderColor: '#F39C5B', // brand-500 color
          borderWidth: 3,
          backgroundColor: (context: any) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return null;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, 'rgba(243, 156, 91, 0.35)'); // brand-500 gradient top
            gradient.addColorStop(1, 'rgba(243, 156, 91, 0.00)'); // faded bottom
            return gradient;
          },
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#F39C5B',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#F39C5B',
          pointHoverBorderColor: '#ffffff',
          pointHoverBorderWidth: 2,
        }
      ]
    };
  }, [invoices, rangeType, startDate, endDate, selectedCurrency]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: '#1e293b',
        padding: 12,
        titleFont: { size: 12 },
        bodyFont: { size: 14, weight: 'bold' as const },
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-IN', { style: 'currency', currency: selectedCurrency, maximumFractionDigits: 0 }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: '#f1f5f9',
        },
        border: {
          dash: [4, 4],
          display: false
        },
        ticks: {
          color: '#64748b',
          font: { size: 10, weight: 'bold' as any },
          callback: function(value: any) {
            if (value === 0) return '0';
            return new Intl.NumberFormat('en-IN', { notation: 'compact', compactDisplay: 'short' }).format(value);
          }
        }
      },
      x: {
        grid: {
          display: false,
        },
        border: {
          display: false
        },
        ticks: {
          color: '#64748b',
          font: { size: 10, weight: 'bold' as any }
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="glass-card flex flex-col h-full bg-white border border-ink-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-ink-100 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <h2 className="font-bold text-ink-900 tracking-tight text-sm uppercase">Revenue Overview</h2>
        
        {/* Date presets & currency selector */}
        <div className="flex items-center gap-3">
          {currencies.length > 1 ? (
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="text-xs font-bold text-brand-600 bg-brand-50 border border-brand-100 rounded-lg px-2.5 py-1 outline-none cursor-pointer focus:ring-2 focus:ring-brand-500/20"
            >
              {currencies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-bold text-brand-600 px-2.5 py-1 bg-brand-50 rounded-lg border border-brand-100">{selectedCurrency}</span>
          )}

          <div className="flex bg-ink-50 p-0.5 rounded-lg border border-ink-100">
            {(['30days', '1year', 'lifetime', 'custom'] as const).map((range) => {
              const label = range === '30days' ? 'Last 30 Days' : range === '1year' ? '1 Year' : range === 'lifetime' ? 'Lifetime' : 'Custom Range';
              const active = rangeType === range;
              return (
                <button
                  key={range}
                  onClick={() => handleRangeChange(range)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${active ? 'bg-white text-brand-600 shadow-sm border border-ink-100' : 'text-ink-500 hover:text-ink-900'}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {rangeType === 'custom' && (
        <div className="px-6 py-3 bg-ink-50/50 border-b border-ink-100 flex flex-wrap items-center gap-4 text-xs font-bold text-ink-650 shrink-0">
          <div className="flex items-center gap-2">
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1 border border-ink-200 rounded-lg outline-none focus:border-brand-500 bg-white font-medium text-ink-800"
            />
          </div>
          <div className="flex items-center gap-2">
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1 border border-ink-200 rounded-lg outline-none focus:border-brand-500 bg-white font-medium text-ink-800"
            />
          </div>
        </div>
      )}

      <div className="p-6 flex-1 min-h-[240px] flex items-center justify-center">
        <div className="w-full">
          <Line data={chartData} options={options} />
        </div>
      </div>
    </div>
  );
}
