"use client";

import { CheckCircle2, FilePlus2, Loader2, Send, AlertCircle, Download } from "lucide-react";
import { useData } from "@/hooks/useData";
import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import UnifiedShareModal from "@/components/invoice/UnifiedShareModal";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { resolvePlanAccess } from "@/lib/billing/tiers";
import { saveRecurringTemplate } from "@/app/dashboard/recurring/actions";
import PremiumBadge from "@/components/ui/PremiumBadge";
import { toast } from "sonner";
import { clearInvoiceDraft } from "@/lib/invoiceStorage";
import { useSearchParams } from "next/navigation";

export const GenerateInvoiceButton = ({ profile }: { profile: any }) => {
  const { setValue, getValues, control } = useFormContext();
  const [status, setStatus] = useState<
    "ready" | "generating" | "polling" | "done" | "error"
  >("ready");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const searchParams = useSearchParams();
  const [isQuote, setIsQuote] = useState(searchParams?.get("type") === "quote");
  const [isRecurring, setIsRecurring] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Read isQuote from form context
  const formIsQuote = useWatch({ control, name: "isQuote" });
  
  // Use form value if available, otherwise use search param
  const effectiveIsQuote = formIsQuote !== undefined ? formIsQuote : isQuote;

  const {
    companyDetails,
    invoiceDetails,
    invoiceTerms,
    paymentDetails,
    yourDetails,
  } = useData();

  // P0 fix: clear interval on unmount to prevent background polling leak
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Broadcast generation status to form context for preview overlay
  useEffect(() => {
    setValue("generationStatus", status);
  }, [status, setValue]);

  const handleGenerate = async () => {
    setStatus("generating");
    setErrorMsg("");
    setActiveInvoiceId(null);
    setShareSlug(null);

    // Build full formData matching backend RawInvoiceData contract
    // Merge live react-hook-form values to prevent submitting stale/empty DataContext state
    const liveFormValues = getValues();
    
    const itemsList = liveFormValues.items?.length > 0 ? liveFormValues.items : invoiceDetails.items;
    
    const formData = {
      ...yourDetails,
      ...companyDetails,
      ...invoiceTerms,
      ...paymentDetails,
      ...liveFormValues, // Live data takes precedence
      items: itemsList,
      note: liveFormValues.note !== undefined ? liveFormValues.note : invoiceDetails.note,
      discount: liveFormValues.discount !== undefined ? liveFormValues.discount : invoiceDetails.discount,
      taxRate: liveFormValues.taxRate !== undefined ? liveFormValues.taxRate : invoiceDetails.taxRate,
      currency: liveFormValues.currency || invoiceDetails.currency,
      amount: itemsList.reduce((sum: number, item: any) => {
        const qty = item.qty || 1;
        const amt = item.amount || 0;
        return sum + qty * amt;
      }, 0),
      clientName: liveFormValues.companyName || companyDetails.companyName || "",
      clientEmail: liveFormValues.email || companyDetails.email || "",
      invoiceNumber: liveFormValues.invoiceNumber || invoiceTerms.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      ...(liveFormValues.signatureMode === 'custom' && liveFormValues.customSignatureUrl
        ? { signatureUrl: liveFormValues.customSignatureUrl }
        : liveFormValues.signatureMode === 'none'
        ? { signatureUrl: null }
        : {}),
    };

    if (isRecurring) {
      try {
        await saveRecurringTemplate({
          nickname: `${companyDetails.companyName || "Template"} - ${invoiceTerms.invoiceNumber || ""}`.trim() || "My Template",
          form_data: formData,
          frequency: "monthly",
          reminder_date: "1st of month",
        });
        toast.success("Saved as recurring template!");
        setStatus("done");
      } catch (e: unknown) {
        setErrorMsg(e instanceof Error ? e.message : "Failed to save template");
        setStatus("error");
      }
      return;
    }

    try {
      const res = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData,
          nickname: `${companyDetails.companyName || (effectiveIsQuote ? "Quote" : "Invoice")} - ${invoiceTerms.invoiceNumber || ""}`.trim(),
          payment_status: effectiveIsQuote ? "quote" : "draft",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to queue");
      }

      const { invoiceId } = await res.json();
      setActiveInvoiceId(invoiceId);
      setStatus("polling");

      // Poll for completion
      let attempts = 0;
      intervalRef.current = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await fetch(`/api/invoices/${invoiceId}/status`);
          if (!statusRes.ok) return;
          const data = await statusRes.json();

          if (data.status === "done" || data.status === "completed") {
            clearInterval(intervalRef.current!);
            setShareSlug(data.share_slug);
            setStatus("done");
          } else if (data.status === "failed") {
            clearInterval(intervalRef.current!);
            setErrorMsg(data.error_msg || "Generation failed");
            setStatus("error");
          }
        } catch {
          // retry silently
        }

        if (attempts > 60) {
          clearInterval(intervalRef.current!);
          setErrorMsg("Timed out waiting for PDF");
          setStatus("error");
        }
      }, 2000);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  };

  const handleShare = () => {
    if (shareSlug) {
      setIsShareOpen(true);
    }
  };

  return (
    <div className="flex flex-col py-4 md:py-8 w-full max-w-md mx-auto">
      <UnifiedShareModal 
        isOpen={isShareOpen || isEmailOpen} 
        onClose={() => { setIsShareOpen(false); setIsEmailOpen(false); }} 
        invoiceId={activeInvoiceId || ''}
        invoiceNumber={invoiceTerms.invoiceNumber || ""}
        clientEmail={companyDetails.email || ""}
        clientName={companyDetails.companyName || ""}
        senderName={yourDetails?.yourName || ""}
        shareSlug={shareSlug || undefined}
      />
      <div className="w-full text-center">
        <h1 className="text-4xl font-bold pb-4 text-ink-900">
          {status === "done" 
            ? (effectiveIsQuote ? "Quote Generated!" : "Invoice Generated!") 
            : effectiveIsQuote ? "Your quote is ready" : "Your invoice is ready"}
        </h1>
        <p className="text-ink-500 text-lg pb-8">
          {status === "done"
            ? "Your PDF has been generated and stored securely."
            : "Please review the details carefully before generating your document."}
        </p>

        {status === "ready" && (() => {
          const access = resolvePlanAccess(profile);
          const canUseRecurring = access.plan.canUseRecurring || access.isAdmin;
          return (
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between bg-ink-50 p-4 rounded-xl border border-ink-100 relative">
                <div className="flex flex-col text-left">
                  <Label htmlFor="quote-mode" className="text-ink-900 cursor-pointer font-bold text-sm flex items-center gap-1">
                    Save as Quote
                    <PremiumBadge type="pro" />
                  </Label>
                  <span className="text-[10px] text-ink-500 mt-0.5">Saves as a draft approval document</span>
                </div>
                <Switch 
                  id="quote-mode" 
                  disabled={!access.plan.canUseQuotes && !access.isAdmin}
                  checked={(access.plan.canUseQuotes || access.isAdmin) ? effectiveIsQuote : false} 
                  onCheckedChange={(val) => {
                    setIsQuote(val);
                    setValue('isQuote', val);
                    if (val) setIsRecurring(false);
                  }} 
                />
                {(!access.plan.canUseQuotes && !access.isAdmin) && (
                  <div 
                    className="absolute inset-0 z-10 cursor-not-allowed bg-transparent"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toast.error("Upgrade to Pro to save documents as Quotes.");
                    }}
                  />
                )}
              </div>
              <div className="flex items-center justify-between bg-ink-50 p-4 rounded-xl border border-ink-100 relative">
                <div className="flex flex-col text-left">
                  <Label htmlFor="recurring-mode" className="text-ink-900 cursor-pointer font-bold text-sm flex items-center gap-1">
                    Save as Recurring Template
                    <PremiumBadge type="pro" />
                  </Label>
                  <span className="text-[10px] text-ink-500 mt-0.5">Save preset to quickly generate invoices later</span>
                </div>
                <Switch 
                  id="recurring-mode" 
                  disabled={!canUseRecurring}
                  checked={canUseRecurring ? isRecurring : false} 
                  onCheckedChange={(val) => {
                    setIsRecurring(val);
                    if (val) setIsQuote(false);
                  }} 
                />
                {!canUseRecurring && (
                  <div 
                    className="absolute inset-0 z-10 cursor-not-allowed bg-transparent"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toast.error("Upgrade to Pro to save invoices as recurring templates.");
                    }}
                  />
                )}
              </div>
            </div>
          );
        })()}

        {status === "error" && (
          errorMsg.includes("Storage limit") ? (
            <div className="mb-6 p-5 bg-white border border-red-200 shadow-xl shadow-red-500/10 rounded-2xl text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-ink-900 mb-2">Storage Limit Reached</h3>
              <p className="text-sm text-ink-500 mb-4">{errorMsg}</p>
              <div className="flex gap-3 justify-center">
                <a href="/pricing" className="px-4 py-2 bg-brand-500 text-white font-bold rounded-lg hover:bg-brand-600 transition-colors">
                  Upgrade Plan
                </a>
                <a href="/dashboard" className="px-4 py-2 bg-ink-50 text-ink-700 font-bold rounded-lg hover:bg-ink-100 transition-colors">
                  Go to Dashboard
                </a>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {errorMsg}
            </div>
          )
        )}

        <button
          disabled={status === "generating" || status === "polling" || status === "done"}
          onClick={handleGenerate}
          className="w-full h-14 rounded-xl text-xl bg-brand-500 text-white font-bold hover:bg-brand-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl shadow-brand-500/20"
        >
          {status === "ready" && (
            <>
              <Send className="h-6 w-6" /> {isRecurring ? "Save Template" : `Generate ${effectiveIsQuote ? "Quote" : "Invoice"}`}
            </>
          )}
          {status === "generating" && (
            <>
              <Loader2 className="h-6 w-6 animate-spin" /> {isRecurring ? "Saving..." : "Queuing..."}
            </>
          )}
          {status === "polling" && (
            <>
              <Loader2 className="h-6 w-6 animate-spin" /> Generating PDF...
            </>
          )}
          {status === "done" && (
            <>
              <CheckCircle2 className="h-6 w-6" /> Done!
            </>
          )}
          {status === "error" && (
            <>
              <Send className="h-6 w-6" /> Try Again
            </>
          )}
        </button>

        {status === "done" && activeInvoiceId && (
          <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <a
                href={`/api/invoices/${activeInvoiceId}/download?view=1`}
                target="_blank"
                rel="noreferrer"
                className="h-12 rounded-lg bg-white border border-ink-200 text-ink-600 font-bold hover:bg-ink-50 transition-colors flex items-center justify-center gap-2"
              >
                View PDF
              </a>
              <a
                href={`/api/invoices/${activeInvoiceId}/download`}
                className="h-12 rounded-lg bg-brand-500 text-white font-bold hover:bg-brand-600 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </a>
            </div>
            
            <button 
              onClick={handleShare}
              className="w-full h-12 rounded-lg border border-brand-200 bg-brand-50/50 text-brand-600 font-bold hover:bg-brand-50 transition-colors flex items-center justify-center gap-2"
            >
              Share Link
            </button>

            <button 
              onClick={() => setIsEmailOpen(true)}
              className="w-full h-12 rounded-lg bg-ink-900 text-white font-bold hover:bg-ink-800 transition-colors flex items-center justify-center gap-2 mt-3"
            >
              <Send className="w-4 h-4" />
              Send to Client
            </button>

            <a
              href="/dashboard"
              className="block mt-6 text-sm font-medium text-ink-400 hover:text-ink-600 transition-colors underline underline-offset-4"
            >
              Go to Dashboard
            </a>
            <button
              onClick={() => {
                clearInvoiceDraft();
                window.location.href = effectiveIsQuote ? '/invoices/new?type=quote' : '/invoices/new';
              }}
              className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 transition-colors mt-4 mx-auto"
            >
              <FilePlus2 className="w-4 h-4" />
              {effectiveIsQuote ? 'New Quote' : 'New Invoice'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
