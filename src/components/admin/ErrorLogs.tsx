'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, AlertCircle, Info, Trash2, Calendar, CheckCircle2 } from 'lucide-react';
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
  error: 'bg-red-50/70 border-l-2 border-l-red-500 hover:bg-red-50',
  warn: 'bg-amber-50/70 border-l-2 border-l-amber-500 hover:bg-amber-50',
  info: 'bg-blue-50/70 border-l-2 border-l-blue-500 hover:bg-blue-50',
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
  const [clearing, setClearing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ level?: string; source?: string; days: string }>({
    days: '7', // Default to last 7 days
  });

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', days: filter.days });
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

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to purge error logs?')) return;
    setClearing(true);
    try {
      const res = await fetch('/api/admin/error-logs', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear logs');
      setLogs([]);
      toast.success('Error logs cleared');
    } catch {
      toast.error('Failed to clear error logs');
    } finally {
      setClearing(false);
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
    <div className="glass-card bg-white border border-ink-100 shadow-sm overflow-hidden rounded-xl">
      <div className="p-4 border-b border-ink-100 bg-ink-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-brand-500" />
          <h3 className="font-bold text-ink-900">Error Logs</h3>
          <span className="text-xs text-ink-500 font-mono bg-ink-100/80 px-2 py-0.5 rounded-full">
            {logs.length} {filter.days === 'all' ? 'total' : `in last ${filter.days === '1' ? '24h' : `${filter.days}d`}`}
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Time Window Filter */}
          <div className="flex items-center gap-1 bg-white border border-ink-200 rounded-lg px-2 py-1 shadow-2xs">
            <Calendar className="w-3 h-3 text-ink-400" />
            <select
              value={filter.days}
              onChange={(e) => setFilter(f => ({ ...f, days: e.target.value }))}
              className="text-xs bg-transparent border-0 focus:ring-0 text-ink-700 font-medium cursor-pointer"
            >
              <option value="7">Last 7 days</option>
              <option value="1">Last 24 hours</option>
              <option value="30">Last 30 days</option>
              <option value="all">All time (Lifetime)</option>
            </select>
          </div>

          {/* Level Filter */}
          <select
            value={filter.level || ''}
            onChange={(e) => setFilter(f => ({ ...f, level: e.target.value || undefined }))}
            className="text-xs border border-ink-200 rounded-lg px-2 py-1.5 bg-white text-ink-700"
          >
            <option value="">All levels</option>
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
          </select>

          {/* Source Filter */}
          <select
            value={filter.source || ''}
            onChange={(e) => setFilter(f => ({ ...f, source: e.target.value || undefined }))}
            className="text-xs border border-ink-200 rounded-lg px-2 py-1.5 bg-white text-ink-700"
          >
            <option value="">All sources</option>
            <option value="webhook">Webhook</option>
            <option value="worker">Worker</option>
            <option value="api">API</option>
            <option value="cron">Cron</option>
            <option value="frontend">Frontend</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            title="Refresh logs"
            aria-label="Refresh logs"
            className="p-1.5 rounded-lg border border-ink-200 hover:bg-ink-100/60 transition-colors bg-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-ink-600 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Clear Logs Button */}
          {logs.length > 0 && (
            <button
              onClick={clearLogs}
              disabled={clearing}
              title="Purge error logs"
              aria-label="Purge error logs"
              className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors bg-white"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Container */}
      <div className="max-h-[420px] overflow-y-auto divide-y divide-ink-50">
        {loading ? (
          <div className="py-12 text-center text-ink-400 text-sm flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-ink-400" />
            <span>Loading error logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-ink-500 text-sm flex flex-col items-center justify-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/80 stroke-1" />
            <p className="font-medium text-ink-700">No error logs in the last {filter.days === '1' ? '24 hours' : `${filter.days} days`}</p>
            <p className="text-xs text-ink-400">All background jobs and services operating smoothly.</p>
            {filter.days !== 'all' && (
              <button
                onClick={() => setFilter(f => ({ ...f, days: 'all' }))}
                className="mt-2 text-xs text-brand-600 hover:underline font-medium"
              >
                View lifetime history →
              </button>
            )}
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className={`px-4 py-3 cursor-pointer transition-colors ${LEVEL_COLORS[log.level] || 'hover:bg-ink-50/50'}`}
              onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
            >
              <div className="flex items-start gap-2.5">
                {LEVEL_ICONS[log.level]}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider ${SOURCE_COLORS[log.source] || 'bg-ink-100 text-ink-600'}`}>
                      {log.source}
                    </span>
                    <span className="text-[10px] text-ink-400 font-mono">{timeAgo(log.created_at)}</span>
                    <span className="text-[10px] text-ink-300 font-mono hidden sm:inline">
                      • {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-ink-800 font-medium break-words">{log.message}</p>
                  {expandedId === log.id && log.stack && (
                    <pre className="mt-2 p-2.5 bg-ink-900 text-emerald-300 text-[10px] font-mono rounded-lg overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {log.stack}
                    </pre>
                  )}
                  {expandedId === log.id && log.metadata && (
                    <pre className="mt-2 p-2 bg-ink-50 text-ink-700 text-[10px] font-mono rounded-lg overflow-x-auto border border-ink-100">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
