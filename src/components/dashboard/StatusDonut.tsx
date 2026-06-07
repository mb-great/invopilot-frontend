'use client';

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useMemo } from 'react';

ChartJS.register(ArcElement, Tooltip, Legend);

interface Invoice {
  payment_status?: string;
  form_data?: any;
}

interface Props {
  invoices: Invoice[];
}

export default function StatusDonut({ invoices }: Props) {
  const chartData = useMemo(() => {
    let paid = 0;
    let outstanding = 0;
    let overdue = 0;
    let draft = 0;

    invoices.forEach(inv => {
      const status = inv.payment_status || 'draft';
      if (status === 'paid') paid++;
      else if (status === 'overdue') overdue++;
      else if (status === 'sent') outstanding++;
      else if (status === 'draft') draft++;
    });

    const hasData = paid > 0 || outstanding > 0 || overdue > 0 || draft > 0;

    return {
      labels: ['Paid', 'Outstanding', 'Overdue', 'Draft'],
      datasets: [
        {
          data: hasData ? [paid, outstanding, overdue, draft] : [1],
          backgroundColor: hasData 
            ? ['#10b981', '#3b82f6', '#ef4444', '#cbd5e1'] // emerald-500, brand-500, red-500, slate-300
            : ['#f1f5f9'],
          borderWidth: 0,
          cutout: '75%',
        }
      ],
      hasData
    };
  }, [invoices]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
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
        bodyFont: { size: 14, weight: 'bold' as const }
      }
    }
  };

  return (
    <div className="glass-card flex flex-col h-full bg-white border border-ink-100 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-ink-100">
        <h2 className="font-bold text-ink-900 tracking-tight text-sm uppercase">Invoice Status</h2>
      </div>
      <div className="p-6 flex-1 min-h-[240px] flex items-center justify-center relative">
        <Doughnut data={chartData} options={options} />
        {chartData.hasData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pr-[100px]">
             <span className="text-3xl font-black text-ink-900 tracking-tight">
               {chartData.datasets[0].data.reduce((a,b) => a+b, 0)}
             </span>
             <span className="text-[10px] uppercase font-bold text-ink-400 tracking-widest">Total</span>
          </div>
        )}
      </div>
    </div>
  );
}
