'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, AlertCircle, Info, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

type ErrorLog = {
  id: string;
  level: 'error' | 'warn' | 'info';
  source: string;
  message: string;
  stack: string | null;
  metadata: any;
  created_at: string;
};

const LEVEL_ICONS = {
  error: <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />,
  warn: <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />,
  info: <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />,
};

const LEVEL_COLORS = {
  error: 'bg-red-50 border-red-100',
  warn: 'bg-amber-50 border-amber-100',
  info: 'bg-blue-50 border-blue-100',
};

const SOURCE_COLORS: Record<string, string> = {
  webhook: 'bg-purple-100 text-purple-700',
  worker: 'bg-blue-100 text-blue-700',
  api: 'bg-orange-100 text-orange-700',
  cron: 'bg-green-100 text-green-700',
  frontend: 'bg-pink-100 text-pink-700',
};

export default function ErrorLogs() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ level?: string; source?: string }>({});

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filter.level) params.set('level', filter.level);
      if (filter.source) params.set('source', filter.source);

      const res = await fetch(`/api/admin/error-logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      toast.error('Failed to load error logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filter]);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="glass-card bg-white border border-ink-100 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-ink-100 bg-ink-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-brand-500" />
          <h3 className="font-bold text-ink-900">Error Logs</h3>
          <span className="text-xs text-ink-400 font-mono">{logs.length} recent</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter.level || ''}
            onChange={(e) => setFilter(f => ({ ...f, level: e.target.value || undefined }))}
            className="text-xs border border-ink-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="">All levels</option>
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
          </select>
          <select
            value={filter.source || ''}
            onChange={(e) => setFilter(f => ({ ...f, source: e.target.value || undefined }))}
            className="text-xs border border-ink-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="">All sources</option>
            <option value="webhook">Webhook</option>
            <option value="worker">Worker</option>
            <option value="api">API</option>
            <option value="cron">Cron</option>
            <option value="frontend">Frontend</option>
          </select>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-1.5 rounded-lg border border-ink-200 hover:bg-ink-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="py-12 text-center text-ink-400 text-sm italic">
            {loading ? 'Loading...' : 'No error logs found.'}
          </div>
        ) : (
          <div className="divide-y divide-ink-50">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`px-4 py-3 cursor-pointer hover:bg-ink-50/50 transition-colors ${LEVEL_COLORS[log.level] || ''}`}
                onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
              >
                <div className="flex items-start gap-2">
                  {LEVEL_ICONS[log.level]}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${SOURCE_COLORS[log.source] || 'bg-ink-100 text-ink-600'}`}>
                        {log.source}
                      </span>
                      <span className="text-[10px] text-ink-400 font-mono">{timeAgo(log.created_at)}</span>
                    </div>
                    <p className="text-xs text-ink-700 font-medium truncate">{log.message}</p>
                    {expandedId === log.id && log.stack && (
                      <pre className="mt-2 p-2 bg-ink-900 text-ink-100 text-[10px] font-mono rounded-lg overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {log.stack}
                      </pre>
                    )}
                    {expandedId === log.id && log.metadata && (
                      <pre className="mt-2 p-2 bg-ink-50 text-ink-600 text-[10px] font-mono rounded-lg overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
