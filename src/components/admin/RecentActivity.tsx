import { formatDistanceToNow } from 'date-fns';
import { Activity, UserPlus, FileText, CreditCard, Settings, Search } from 'lucide-react';

const icons = {
  user_signup: <UserPlus className="w-4 h-4 text-emerald-500" />,
  invoice_created: <FileText className="w-4 h-4 text-brand-500" />,
  invoice_paid: <CreditCard className="w-4 h-4 text-amber-500" />,
  settings_updated: <Settings className="w-4 h-4 text-ink-400" />,
  admin_search: <Search className="w-4 h-4 text-purple-500" />,
};

const labels = {
  user_signup: 'New user joined',
  invoice_created: 'Invoice generated',
  invoice_paid: 'Invoice marked paid',
  settings_updated: 'Settings updated',
  admin_search: 'Admin search performed',
};

export default function RecentActivity({ logs }: { logs: any[] }) {
  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-4 p-4 rounded-xl border border-ink-50 bg-white/50 hover:bg-white transition-colors">
          <div className="mt-1 p-2 rounded-lg bg-ink-50">
            {icons[log.action as keyof typeof icons] || <Activity className="w-4 h-4 text-ink-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <p className="text-sm font-bold text-ink-900 truncate">
                {labels[log.action as keyof typeof labels] || log.action}
              </p>
              <span className="text-[10px] font-medium text-ink-400 whitespace-nowrap uppercase tracking-wider">
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-xs text-ink-500 mt-0.5 truncate">
              {log.profiles?.full_name || log.profiles?.email || 'System'}
            </p>
            {log.metadata?.amount && (
              <div className="mt-2 text-[10px] font-bold text-brand-500 bg-brand-50 inline-block px-2 py-0.5 rounded uppercase">
                {log.metadata.amount} {log.metadata.currency}
              </div>
            )}
          </div>
        </div>
      ))}
      {logs.length === 0 && (
        <div className="py-12 text-center text-ink-400 italic text-sm">
          No recent activity logs.
        </div>
      )}
    </div>
  );
}
