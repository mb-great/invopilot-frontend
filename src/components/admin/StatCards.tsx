interface StatCardsProps {
  totalInvoices: number;
  activeUsers: number;
  lifetimeGenerated: number;
  successRate: string;
}

export default function StatCards({ totalInvoices, activeUsers, lifetimeGenerated, successRate }: StatCardsProps) {
  const stats = [
    { label: 'Active Invoices', value: totalInvoices.toLocaleString(), icon: '📄' },
    { label: 'Registered Users', value: activeUsers.toLocaleString(), icon: '👤' },
    { label: 'Lifetime Generated', value: lifetimeGenerated.toLocaleString(), icon: '🚀' },
    { label: 'Health Score', value: successRate, icon: '✅' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <div key={stat.label} className="glass-card p-6 flex flex-col group hover:border-brand-500/30 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-xl group-hover:bg-brand-500/10 transition-colors">
              {stat.icon}
            </div>
          </div>
          <span className="text-muted text-xs uppercase font-bold tracking-widest mb-1">{stat.label}</span>
          <span className="text-3xl font-bold tracking-tighter text-ink-900">{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
