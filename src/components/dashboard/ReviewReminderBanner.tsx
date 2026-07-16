'use client';

import { useMemo, useState } from 'react';
import { Clock, CheckCircle, AlertTriangle, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

type Props = {
  reviewStatus: string | null;
  reviewDeadline: string | null;
  reviewSubmittedAt: string | null;
  userId: string;
};

const G2_REVIEW_URL = 'https://www.g2.com';

function isHardBanner(status: string | null, daysLeft: number | null): boolean {
  if (status === 'review_overdue') return true;
  if (daysLeft !== null && daysLeft <= 3) return true;
  return false;
}

function isDismissedSubmitted(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(`beta-review-dismissed-${userId}`) === 'true';
}

function dismissSubmitted(userId: string): void {
  sessionStorage.setItem(`beta-review-dismissed-${userId}`, 'true');
}

export default function ReviewReminderBanner({ reviewStatus, reviewDeadline, reviewSubmittedAt, userId }: Props) {
  const [status, setStatus] = useState(reviewStatus);
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(() => isDismissedSubmitted(userId));

  const info = useMemo(() => {
    if (!status) return null;

    const deadline = reviewDeadline ? new Date(reviewDeadline) : null;
    const now = new Date();
    const daysLeft = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

    const hard = isHardBanner(status, daysLeft);

    if (status === 'reviewed') {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-600" />,
        bg: 'bg-green-50 border-green-200',
        text: 'text-green-800',
        subtext: 'text-green-600',
        message: 'Thank you! Your G2 review has been recorded.',
        detail: reviewSubmittedAt ? `Confirmed on ${new Date(reviewSubmittedAt).toLocaleDateString()}` : null,
        buttons: 'none',
        hard: false,
      };
    }

    if (status === 'submitted') {
      return {
        icon: <Clock className="h-5 w-5 text-blue-600" />,
        bg: 'bg-blue-50 border-blue-200',
        text: 'text-blue-800',
        subtext: 'text-blue-600',
        message: 'Your review is being verified.',
        detail: 'Once confirmed, you will receive full access.',
        buttons: 'dismiss',
        hard: false,
      };
    }

    if (status === 'review_overdue') {
      return {
        icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
        bg: 'bg-red-50 border-red-300',
        text: 'text-red-800',
        subtext: 'text-red-600',
        message: 'Your review is overdue. Submit your G2 review to regain full access.',
        detail: 'Some features may be limited during this period.',
        buttons: 'submit-done',
        hard: true,
        g2Url: G2_REVIEW_URL,
      };
    }

    if (status === 'overdue' || (daysLeft !== null && daysLeft < 0)) {
      return {
        icon: <AlertTriangle className="h-5 w-5 text-red-600" />,
        bg: 'bg-red-50 border-red-300',
        text: 'text-red-800',
        subtext: 'text-red-600',
        message: 'Your review is overdue. Submit your G2 review to regain full access.',
        detail: 'Some features may be limited during this period.',
        buttons: 'submit-done',
        hard: true,
        g2Url: G2_REVIEW_URL,
      };
    }

    if (daysLeft !== null && daysLeft <= 3) {
      return {
        icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
        bg: 'bg-amber-50 border-amber-300',
        text: 'text-amber-800',
        subtext: 'text-amber-600',
        message: `Your G2 review is due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        detail: 'Some features may be limited during this period.',
        buttons: 'submit-done',
        hard: true,
        g2Url: G2_REVIEW_URL,
      };
    }

    if (daysLeft !== null && daysLeft <= 7) {
      return {
        icon: <Clock className="h-5 w-5 text-blue-600" />,
        bg: 'bg-blue-50 border-blue-200',
        text: 'text-blue-800',
        subtext: 'text-blue-600',
        message: `Reminder: Submit your G2 review within ${daysLeft} days.`,
        detail: 'As part of the beta program, you agreed to submit one honest review.',
        buttons: 'submit-done',
        hard: true,
        g2Url: G2_REVIEW_URL,
      };
    }

    return null;
  }, [status, reviewDeadline, reviewSubmittedAt]);

  const handleDone = async () => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('mark_review_submitted', { target_user_id: userId });
      if (error) throw error;
      setStatus('submitted');
      toast.success('Review submitted. Admin will confirm shortly.');
    } catch (err) {
      toast.error('Failed to update status. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = () => {
    dismissSubmitted(userId);
    setDismissed(true);
  };

  if (!info) return null;
  if (status === 'submitted' && dismissed) return null;

  const isHard = info.hard;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 ${info.bg} ${
        isHard ? 'border-2 shadow-md' : ''
      }`}
    >
      <div className="mt-0.5 shrink-0">{info.icon}</div>
      <div className="flex-1">
        <p className={`text-sm font-semibold ${info.text}`}>{info.message}</p>
        {info.detail && (
          <p className={`mt-0.5 text-xs ${info.subtext}`}>{info.detail}</p>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        {info.buttons === 'submit-done' && (
          <>
            <button
              onClick={handleDone}
              disabled={submitting}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Done'}
            </button>
            <a
              href={info.g2Url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-red-700"
            >
              Submit Review
            </a>
          </>
        )}
        {info.buttons === 'dismiss' && (
          <button
            onClick={handleDismiss}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
