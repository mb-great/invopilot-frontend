'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';

export default function PricingSuccessPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push('/dashboard');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-ink-50">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-ink-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>

        <h1 className="mt-6 text-3xl font-black tracking-tight text-ink-900">
          Payment Successful!
        </h1>

        <p className="mt-3 text-base text-ink-500">
          Your subscription is being activated. You&apos;ll receive a confirmation email shortly.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm font-bold text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting to dashboard in {countdown}s...
        </div>

        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="mt-6 w-full rounded-xl bg-ink-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-ink-800"
        >
          Go to Dashboard now
        </button>
      </div>
    </div>
  );
}
