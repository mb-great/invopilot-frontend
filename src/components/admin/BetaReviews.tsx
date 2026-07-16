'use client';

import { useState } from 'react';
import { CheckCircle, Clock, AlertTriangle, Loader2, Mail, Ban } from 'lucide-react';
import { toast } from 'sonner';

type BetaUser = {
  user_id: string;
  email: string;
  full_name: string;
  review_status: string;
  review_deadline: string | null;
  review_submitted_at: string | null;
  review_snoozed_until: string | null;
  created_at: string;
  days_since_signup: number;
  days_until_deadline: number;
};

type Props = {
  users: BetaUser[];
};

export default function BetaReviews({ users }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (userId: string, action: string, days?: number) => {
    setLoading(userId + action);
    try {
      const url = action === 'snooze'
        ? `/api/admin/beta-reviews/${userId}/snooze`
        : `/api/admin/beta-reviews/${userId}/${action}`;
      
      const body = action === 'snooze' ? { days } : undefined;
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) throw new Error('Failed');
      toast.success(action === 'mark-reviewed' ? 'Review confirmed!' : `Action completed`);
      window.location.reload();
    } catch {
      toast.error('Action failed. Try again.');
    } finally {
      setLoading(null);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'reviewed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'submitted': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'review_overdue': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      submitted: 'bg-blue-100 text-blue-800',
      reviewed: 'bg-green-100 text-green-800',
      review_overdue: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {statusIcon(status)}
        {status}
      </span>
    );
  };

  if (!users || users.length === 0) {
    return (
      <div className="py-20 text-center text-ink-400 italic">
        No beta applications yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs font-bold text-ink-500 uppercase tracking-wider">
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Deadline</th>
            <th className="px-4 py-3">Days</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isLoading = loading?.startsWith(u.user_id);
            const isOverdue = u.review_status === 'review_overdue' || (u.days_until_deadline < 0 && u.review_status === 'pending');
            const isSubmitted = u.review_status === 'submitted';
            const isReviewed = u.review_status === 'reviewed';

            return (
              <tr key={u.user_id} className="border-b border-ink-50 hover:bg-ink-50/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-semibold text-ink-900">{u.full_name || '—'}</div>
                  <div className="text-xs text-ink-500">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  {statusBadge(u.review_status)}
                  {isSubmitted && (
                    <div className="mt-1 text-[10px] text-blue-600">User clicked "Done"</div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink-600">
                  {u.review_deadline ? new Date(u.review_deadline).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold ${isOverdue ? 'text-red-600' : u.days_until_deadline <= 3 ? 'text-amber-600' : 'text-ink-600'}`}>
                    {u.days_until_deadline > 0 ? `${u.days_until_deadline}d left` : `${Math.abs(u.days_until_deadline)}d overdue`}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {!isReviewed && (
                      <button
                        onClick={() => handleAction(u.user_id, 'mark-reviewed')}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                      >
                        {loading === u.user_id + 'mark-reviewed' ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                        Confirm
                      </button>
                    )}
                    {!isReviewed && (
                      <div className="relative group">
                        <button
                          disabled={isLoading}
                          className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-700 transition-colors hover:bg-ink-50 disabled:opacity-50"
                        >
                          <Clock className="h-3 w-3" />
                          Snooze
                        </button>
                        <div className="absolute right-0 top-full z-10 mt-1 hidden w-32 rounded-lg border border-ink-200 bg-white shadow-lg group-hover:block">
                          {[3, 5, 7, 14].map((d) => (
                            <button
                              key={d}
                              onClick={() => handleAction(u.user_id, 'snooze', d)}
                              className="block w-full px-3 py-2 text-left text-xs font-semibold text-ink-700 hover:bg-ink-50 first:rounded-t-lg last:rounded-b-lg"
                            >
                              {d} days
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {!isReviewed && !isSubmitted && (
                      <button
                        onClick={() => handleAction(u.user_id, 'mark-overdue')}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        <Ban className="h-3 w-3" />
                        Overdue
                      </button>
                    )}
                    {isReviewed && (
                      <span className="text-xs text-green-600 font-semibold">✓ Confirmed</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
