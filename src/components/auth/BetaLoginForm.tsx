"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getFrontendUrl } from "@/lib/url";
import { Check, FileText, Loader2 } from "lucide-react";

interface Summary {
  token: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  currency: string;
  dueDate: string | null;
}

export function BetaLoginForm({ token }: { token?: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(!!token);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (!token) return;

    const fetchSummary = async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
        if (!backendUrl) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL");
        const res = await fetch(`${backendUrl}/api/funnel/pending-invoice/${token}`);
        if (!res.ok) throw new Error("Could not fetch invoice details");
        const data = await res.json();
        if (data.summary) {
          setSummary(data.summary);
        }
      } catch (err: unknown) {
        console.warn("Failed to load invoice summary for token:", token);
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [token]);

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setError(null);
    try {
      const baseUrl = getFrontendUrl();
      const nextPath = token
        ? `/api/auth/callback?token=${token}&next=/dashboard?claim=${token}`
        : `/api/auth/callback?next=/dashboard`;

      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${baseUrl}${nextPath}`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (oauthErr) throw oauthErr;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google sign in failed");
      setAuthLoading(false);
    }
  };

  const currencySymbol = summary?.currency === "INR" || !summary?.currency ? "₹" : summary?.currency;
  const formattedAmount = summary
    ? `${currencySymbol}${Number(summary.amount).toLocaleString("en-IN")}`
    : "₹58,933.92";

  return (
    <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 p-8 shadow-xl shadow-slate-100 flex flex-col items-center text-center space-y-6">
      
      {/* Top Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-bold">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        Free through September
      </div>

      {/* Heading & Subtitle */}
      <div className="space-y-2">
        <h1 className="text-3xl font-serif font-bold text-slate-900 tracking-tight leading-tight">
          One click, and your invoice is saved
        </h1>
        <p className="text-slate-500 text-sm leading-relaxed px-2">
          The invoice you just built is waiting in your dashboard. Connect to send it and start getting paid — no card, no forms.
        </p>
      </div>

      {/* Mini Invoice Preview Card */}
      <div className="w-full bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between transition-all">
        {loadingSummary ? (
          <div className="w-full py-2 flex items-center justify-center text-slate-400 gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" /> Loading saved invoice...
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex flex-col text-left min-w-0">
                <span className="font-bold text-slate-900 text-sm truncate">
                  {summary ? `${summary.invoiceNumber} · ${summary.clientName}` : "Invoice #003 · Client"}
                </span>
                <span className="text-xs text-slate-500 font-medium mt-0.5">
                  {formattedAmount} {summary?.dueDate ? `· due ${summary.dueDate}` : ""}
                </span>
              </div>
            </div>
            <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm ml-2">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="w-full text-xs font-semibold text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Primary Google Login Button */}
      <button
        disabled={authLoading}
        onClick={handleGoogleLogin}
        type="button"
        className="w-full h-13 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-base shadow-sm flex items-center justify-center gap-3 transition-all hover:border-slate-300 active:scale-[0.99] disabled:opacity-60"
      >
        {authLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin text-slate-600" /> Connecting to Google...
          </>
        ) : (
          <>
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Continue with Google
          </>
        )}
      </button>

      {/* Footer Note */}
      <p className="text-xs text-slate-400 font-medium">
        Your invoice is <strong className="text-slate-700 font-bold">already saved</strong>. You'll never retype your business details again.
      </p>

    </div>
  );
}
