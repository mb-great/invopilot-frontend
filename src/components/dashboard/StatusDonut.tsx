'use client';

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useMemo, useState, useEffect, useRef } from 'react';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Invoice {
  payment_status?: string;
  form_data?: any;
}

interface Props {
  activeWorkspaceId?: string;
  businessFilter?: string | null;
}

export default function StatusDonut({ activeWorkspaceId, businessFilter }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        setIsLoading(true);
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        
        let query = supabase
          .from('invoices')
          .select('payment_status')
          .is('deleted_at', null);
          
        if (activeWorkspaceId) {
          query = query.eq('workspace_id', activeWorkspaceId);
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) query = query.eq('user_id', user.id);
        }
        
        if (businessFilter) {
          query = query.eq('business_profile_name', businessFilter);
        }
        
        const { data } = await query;
        if (data) setInvoices(data);
      } catch (e) {
        console.error("Failed to fetch invoices for donut", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchInvoices();
  }, [activeWorkspaceId, businessFilter]);

  const chartData = useMemo(() => {
    let paid = 0;
    let outstanding = 0;
    let overdue = 0;
    let draft = 0;

    invoices.forEach((inv: Invoice) => {
      const status = inv.payment_status || 'draft';
      if (status === 'paid') paid++;
      else if (status === 'overdue') overdue++;
      else if (status === 'unpaid') outstanding++;
      else if (status === 'draft') draft++;
    });

    const hasData = paid > 0 || outstanding > 0 || overdue > 0 || draft > 0;
    const total = paid + outstanding + overdue + draft;

    return {
      labels: ['Paid', 'Outstanding', 'Overdue', 'Draft'],
      datasets: [
        {
          data: hasData ? [paid, outstanding, overdue, draft] : [1],
          backgroundColor: hasData 
            ? ['#10b981', '#3b82f6', '#ef4444', '#cbd5e1']
            : ['#f1f5f9'],
          borderWidth: 0,
          cutout: '75%',
        }
      ],
      hasData,
      total
    };
  }, [invoices]);

  const options: ChartOptions<'doughnut'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: { right: 110 }
    },
    plugins: {
      legend: {
        position: 'right',
        labels: {
          usePointStyle: true,
          padding: 20,
          color: '#64748b',
          font: { size: 12, weight: 500 }
        }
      },
      tooltip: {
        enabled: chartData.hasData,
        backgroundColor: '#1e293b',
        padding: 12,
        bodyFont: { size: 14, weight: 'bold' }
      }
    }
  }), [chartData.hasData]);

  const totalDigits = String(chartData.total).length;
  const fontSize = totalDigits > 6 ? 'text-2xl' : totalDigits > 4 ? 'text-3xl' : 'text-[32px]';

  return (
    <div className="glass-card flex flex-col h-full bg-white border border-ink-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-ink-100">
        <h2 className="font-bold text-ink-900 tracking-tight text-sm uppercase">Invoice Status</h2>
      </div>
      <div className="p-6 flex-1 min-h-[240px] flex items-center justify-center">
        {isLoading ? (
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <div ref={containerRef} className="w-full h-full relative">
            <Doughnut data={chartData} options={options} />
            {chartData.hasData && (
              <div 
                className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none"
                style={{ left: 'calc(50% - 55px - 0.5vw)' }}
              >
                <span className={`${fontSize} leading-none font-black text-ink-900 tracking-tight tabular-nums`}>
                  {chartData.total.toLocaleString()}
                </span>
                <span className="text-[10px] uppercase font-bold text-ink-400 tracking-widest mt-1">Total</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
