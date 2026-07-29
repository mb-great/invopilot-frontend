"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Check, Mail, Send, X, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface ProfileDefaults {
  beta_onboarding_seen?: number;
  beta_onboarding_last_seen?: string | null;
  pending_send_invoice_id?: string | null;
  beta_onboarding_completed?: boolean;
}

export function BetaOnboardingCard({
  claimToken,
  pendingInvoiceId: initialInvoiceId,
}: {
  claimToken?: string | null;
  pendingInvoiceId?: string | null;
}) {
  const [isVisible, setIsVisible] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [gmailConnected, setGmailConnected] = useState<boolean>(false);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(initialInvoiceId || null);
  const [invoiceName, setInvoiceName] = useState<string>("Your Invoice");
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [connectingGmail, setConnectingGmail] = useState<boolean>(false);

  const supabase = createClient();

  useEffect(() => {
    const initCard = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsVisible(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("gmail_connected, defaults")
          .eq("id", user.id)
          .maybeSingle();

        const { data: senderConfig } = await supabase
          .from("user_sender_config")
          .select("method")
          .eq("user_id", user.id)
          .maybeSingle();

        const connected = !!profile?.gmail_connected || senderConfig?.method === 'gmail' || senderConfig?.method === 'smtp';
        setGmailConnected(connected);

        const defaults: ProfileDefaults = profile?.defaults || {};

        // Only show when there's a claimed invoice (claimToken or pending_send_invoice_id)
        const targetInvId = initialInvoiceId || defaults.pending_send_invoice_id;
        if (!claimToken && !targetInvId) {
          setIsVisible(false);
          return;
        }

        // If user already completed/skipped onboarding, don't show
        if (defaults.beta_onboarding_completed) {
          setIsVisible(false);
          return;
        }

        if (targetInvId) {
          setPendingInvoiceId(targetInvId);
          const { data: inv } = await supabase
            .from("invoices")
            .select("nickname, invoice_number, client_name")
            .eq("id", targetInvId)
            .maybeSingle();

          if (inv) {
            setInvoiceName(inv.nickname || inv.invoice_number || `Invoice for ${inv.client_name}`);
          }
        }
      } catch (err) {
        console.error("Error initializing BetaOnboardingCard:", err);
      } finally {
        setLoading(false);
      }
    };

    initCard();
  }, [claimToken, initialInvoiceId]);

  const handleSkip = async () => {
    setIsVisible(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("defaults")
        .eq("id", user.id)
        .maybeSingle();

      const existingDefaults: ProfileDefaults = profile?.defaults || {};

      // Permanently dismiss — only re-appears on next claimed invoice
      await supabase
        .from("profiles")
        .update({
          defaults: {
            ...existingDefaults,
            beta_onboarding_completed: true,
            pending_send_invoice_id: null,
          },
        })
        .eq("id", user.id);
    } catch (err) {
      console.warn("Could not save skip state:", err);
    }
  };

  const handleConnectGmail = () => {
    setConnectingGmail(true);
    window.location.href = '/dashboard/settings#email-settings';
  };

  const handleSendInvoice = async () => {
    if (!pendingInvoiceId) {
      toast.error("No pending invoice found to send.");
      return;
    }

    setSendingEmail(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3002";
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`${backendUrl}/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          invoiceId: pendingInvoiceId,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send email");
      }

      toast.success("Invoice sent successfully via Gmail!");

      // Update invoice delivery_status to 'sent'
      await supabase
        .from("invoices")
        .update({ delivery_status: "sent" })
        .eq("id", pendingInvoiceId);

      // Mark onboarding as completed
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("defaults")
          .eq("id", user.id)
          .maybeSingle();

        const existingDefaults: ProfileDefaults = profile?.defaults || {};
        await supabase
          .from("profiles")
          .update({
            defaults: {
              ...existingDefaults,
              beta_onboarding_completed: true,
              pending_send_invoice_id: null,
            },
          })
          .eq("id", user.id);
      }

      // Smooth scroll to invoices table and trigger highlight
      setTimeout(() => {
        document.getElementById('invoices-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.dispatchEvent(new CustomEvent('invoice-highlight', { detail: { invoiceId: pendingInvoiceId } }));
      }, 300);

      setIsVisible(false);
    } catch (err) {
      toast.error("Failed to send invoice email. Please try again.");
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading || !isVisible) return null;

  return (
    <div className="w-full mb-8 relative rounded-3xl bg-gradient-to-r from-orange-50/90 via-white to-orange-50/50 border border-orange-200/80 p-6 md:p-8 shadow-sm transition-all animate-in fade-in slide-in-from-top-4 duration-300">
      
      {/* Top Header & Skip button */}
      <div className="flex items-start justify-between mb-6">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-widest text-orange-600">
            <Sparkles className="w-4 h-4" /> Welcome to InvoPilot
          </div>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-slate-900">
            You're 2 steps from getting paid.
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            You've already got 1 invoice ready. Let's get it sent.
          </p>
        </div>

        <button
          onClick={handleSkip}
          type="button"
          className="text-xs font-bold text-slate-400 hover:text-slate-700 bg-white/80 border border-slate-200 px-3 py-1.5 rounded-full flex items-center gap-1 transition-all hover:bg-white shadow-sm"
        >
          Skip <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3-Step Checklist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Step 1: Invoice Created */}
        <div className="bg-white/90 border border-emerald-200 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 1</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                <Check className="w-3 h-3 stroke-[3]" /> Done
              </span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Invoice Created</h4>
            <p className="text-xs text-slate-500 truncate" title={invoiceName}>
              {invoiceName}
            </p>
          </div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            ✓ Ready in dashboard
          </div>
        </div>

        {/* Step 2: Connect Gmail */}
        <div className={`bg-white/90 border rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-sm ${
          gmailConnected ? "border-emerald-200" : "border-orange-200"
        }`}>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 2</span>
              {gmailConnected ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3 stroke-[3]" /> Connected
                </span>
              ) : (
                <span className="text-[11px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                  Action needed
                </span>
              )}
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Connect Email</h4>
            <p className="text-xs text-slate-500">
              Send invoices straight from your own inbox.
            </p>
          </div>

          {gmailConnected ? (
            <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
              ✓ Email ready to send
            </div>
          ) : (
            <button
              disabled={connectingGmail}
              onClick={handleConnectGmail}
              type="button"
              className="w-full h-9 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              {connectingGmail ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5" /> Connect Email
                </>
              )}
            </button>
          )}
        </div>

        {/* Step 3: Send & Get Paid */}
        <div className={`bg-white/90 border rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-sm ${
          !gmailConnected ? "opacity-75 border-slate-200" : "border-orange-300"
        }`}>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 3</span>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                Final Step
              </span>
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Send & Get Paid</h4>
            <p className="text-xs text-slate-500">
              Pick from 50+ payment methods. Track live opens.
            </p>
          </div>

          <button
            disabled={!gmailConnected || sendingEmail}
            onClick={handleSendInvoice}
            type="button"
            className={`w-full h-9 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all ${
              gmailConnected
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {sendingEmail ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Send Now <ArrowRight className="w-3 h-3" />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
