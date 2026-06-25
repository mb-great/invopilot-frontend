'use client';

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useMemo, useState, useEffect } from 'react';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Invoice {
  payment_status?: string;
  delivery_status?: string;
  type?: string;
  form_data?: any;
}

interface Props {
  activeWorkspaceId?: string;
  businessFilter?: string | null;
}

export default function StatusDonut({ activeWorkspaceId, businessFilter }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        setIsLoading(true);
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        
        let query = supabase
          .from('invoices')
          .select('payment_status, delivery_status, type')
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
    let due = 0;
    let overdue = 0;
    let sent = 0;
    let unsent = 0;

    invoices.forEach((inv: Invoice) => {
      if (inv.type !== 'invoice') return;

      const status = inv.payment_status;
      if (status === 'paid') paid++;
      else if (status === 'overdue') overdue++;
      else if (status === 'unpaid') due++;

      if (inv.delivery_status === 'sent') sent++;
      else unsent++;
    });

    const hasData = paid > 0 || due > 0 || overdue > 0;
    const total = paid + due + overdue;

    return {
      labels: ['Paid', 'Unpaid', 'Overdue'],
      datasets: [
        {
          data: hasData ? [paid, due, overdue] : [1],
          backgroundColor: hasData 
            ? ['#10b981', '#3b82f6', '#ef4444']
            : ['#f1f5f9'],
          borderWidth: 0,
          cutout: '75%',
        }
      ],
      hasData,
      total,
      sent,
      unsent
    };
  }, [invoices]);

  const totalDigits = String(chartData.total).length;
  const fontSize = totalDigits > 6 ? 22 : totalDigits > 4 ? 28 : 32;

  const centerTextPlugin = useMemo(() => ({
    id: 'centerText',
    afterDraw(chart: any) {
      if (!chartData.hasData) return;
      const { ctx, chartArea } = chart;
      
      const activeMeta = chart.getDatasetMeta(0);
      const centerX = (activeMeta && activeMeta.data && activeMeta.data[0]) 
        ? (activeMeta.data[0] as any).x 
        : (chartArea.left + chartArea.right) / 2;
      const centerY = (activeMeta && activeMeta.data && activeMeta.data[0]) 
        ? (activeMeta.data[0] as any).y 
        : (chartArea.top + chartArea.bottom) / 2;
      
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.fillStyle = '#0A0D14';
      ctx.fillText(chartData.total.toLocaleString(), centerX, centerY - 8);
      
      ctx.font = '700 10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#8A92A0';
      ctx.fillText('TOTAL', centerX, centerY + 16);
      
      ctx.restore();
    }
  }), [chartData.hasData, chartData.total, fontSize]);

  const options: ChartOptions<'doughnut'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 16,
          color: '#64748b',
          font: { size: 11, weight: 500 }
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

  return (
    <div className="glass-card flex flex-col bg-white border border-ink-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-ink-100">
        <h2 className="font-bold text-ink-900 tracking-tight text-sm uppercase text-center">Invoice Status</h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
        {isLoading ? (
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <div className="w-full max-w-[200px] aspect-square">
            <Doughnut data={chartData} options={options} plugins={[centerTextPlugin]} />
          </div>
        )}
        {chartData.hasData && (
          <div className="flex items-center justify-center gap-4 text-xs">
            <span className="text-green-600 font-semibold">{chartData.sent} sent</span>
            <span className="text-ink-300">|</span>
            <span className="text-ink-500 font-semibold">{chartData.unsent} unsent</span>
          </div>
        )}
      </div>
    </div>
  );
}
