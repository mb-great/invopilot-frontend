"use client";

import { CheckCircle2, FilePlus2, Loader2, Send, Download } from "lucide-react";
import { useData } from "@/hooks/useData";
import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import UnifiedShareModal from "@/components/invoice/UnifiedShareModal";
import UpgradeLimitModal from "@/components/billing/UpgradeLimitModal";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { resolvePlanAccess } from "@/lib/billing/tiers";
import { saveRecurringTemplate } from "@/app/dashboard/recurring/actions";
import PremiumBadge from "@/components/ui/PremiumBadge";
import HelpPopover from "@/components/ui/HelpPopover";
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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const searchParams = useSearchParams();
  const [isQuote, setIsQuote] = useState(searchParams?.get("type") === "quote");
  const [isRecurring, setIsRecurring] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; type: "invoice" | "storage"; max?: number; used?: number }>({ open: false, type: "invoice" });
  
  // Read isQuote from form context
  const formIsQuote = useWatch({ control, name: "isQuote" });
  const formNickname = useWatch({ control, name: "nickname" });
  
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
    localStorage.removeItem('edit_invoice_id');

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
      const finalNickname = formNickname?.trim() 
        ? formNickname.trim()
        : `${companyDetails.companyName || (effectiveIsQuote ? "Quote" : "Invoice")} - ${invoiceTerms.invoiceNumber || ""}`.trim();

      const editId = typeof window !== 'undefined' ? localStorage.getItem('edit_invoice_id') : null;
      
      const res = await fetch(editId ? `/api/invoices/${editId}/edit` : "/api/invoices/generate", {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editId 
          ? { formData, nickname: finalNickname }
          : { formData, nickname: finalNickname, payment_status: effectiveIsQuote ? "quote" : "draft" }
        ),
      });

      if (!res.ok) {
        const err = await res.json();
        if (res.status === 402 && err.code === "TIER_LIMIT_REACHED") {
          setUpgradeModal({ open: true, type: "invoice", max: err.limit, used: err.used });
          setStatus("ready");
          return;
        }
        if (res.status === 402 && err.code === "STORAGE_LIMIT_REACHED") {
          setUpgradeModal({ open: true, type: "storage" });
          setStatus("ready");
          return;
        }
        throw new Error(err.error || "Failed to queue");
      }

      const { invoiceId } = await res.json();
      const pollId = editId || invoiceId;
      setActiveInvoiceId(pollId);
      setStatus("polling");

      // Poll for completion
      let attempts = 0;
      intervalRef.current = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await fetch(`/api/invoices/${pollId}/status`);
          if (!statusRes.ok) return;
          const data = await statusRes.json();

          if (data.status === "done" || data.status === "completed") {
            clearInterval(intervalRef.current!);
            setShareSlug(data.share_slug);
            setPdfUrl(data.pdf_url);
            setStatus("done");
            clearInvoiceDraft();
            if (typeof window !== 'undefined') localStorage.removeItem('edit_invoice_id');
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
      localStorage.removeItem('edit_invoice_id');
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
    <div className="flex flex-col py-4 md:py-6 w-full max-w-md mx-auto">
      <UpgradeLimitModal
        isOpen={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false, type: "invoice" })}
        limitType={upgradeModal.type}
        max={upgradeModal.max}
        used={upgradeModal.used}
      />
      <UnifiedShareModal 
        isOpen={isShareOpen || isEmailOpen} 
        onClose={() => { setIsShareOpen(false); setIsEmailOpen(false); }} 
        invoiceId={activeInvoiceId || ''}
        invoiceNumber={invoiceTerms.invoiceNumber || ""}
        clientEmail={companyDetails.email || ""}
        clientName={companyDetails.companyName || ""}
        senderName={yourDetails?.yourName || ""}
        shareSlug={shareSlug || undefined}
        pdfUrl={pdfUrl || undefined}
      />
      <div className="w-full text-center">
        {(() => {
          const isEditing = typeof window !== 'undefined' && localStorage.getItem('edit_invoice_id');
          return (
            <>
              <h1 className="text-2xl md:text-3xl font-bold pb-2 text-ink-900">
                {status === "done" 
                  ? (isRecurring ? "Template Saved!" : effectiveIsQuote ? (isEditing ? "Quote Updated!" : "Quote Generated!") : "Invoice Generated!") 
                  : isRecurring ? "Your template is ready" : effectiveIsQuote ? "Your quote is ready" : "Your invoice is ready"}
              </h1>
              <p className="text-ink-500 text-sm pb-4">
                {status === "done"
                  ? isRecurring ? "Recurring template saved. It will auto-generate drafts on schedule." : "PDF generated and stored securely."
                  : isEditing ? "Edit the quote details and regenerate." : "Review details before generating."}
              </p>
            </>
          );
        })()}

        {status === "ready" && (() => {
          const access = resolvePlanAccess(profile);
          const canUseRecurring = access.plan.canUseRecurring || access.isAdmin;
          return (
            <div className="space-y-3 mb-5">
              <div className="flex flex-col text-left mb-2">
                <Label htmlFor="nickname" className="text-ink-900 font-bold text-sm mb-1.5 flex items-center gap-1.5">
                  Internal Nickname (Optional)
                  <HelpPopover 
                    title="Invoice Nickname"
                    content="This nickname is just handy for your reference to search later, and will be included in the filename of the generated PDF."
                  />
                </Label>
                <input
                  id="nickname"
                  type="text"
                  placeholder="e.g. Acme Q3 Retainer"
                  value={formNickname || ""}
                  onChange={(e) => setValue("nickname", e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-ink-200 text-sm focus:border-brand-500 outline-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-between bg-ink-50 p-3 rounded-xl border border-ink-100 relative">
                <div className="flex flex-col text-left">
                  <Label htmlFor="quote-mode" className="text-ink-900 cursor-pointer font-bold text-xs flex items-center gap-1">
                    Save as Quote
                    <PremiumBadge type="pro" />
                  </Label>
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
              <div className="flex items-center justify-between bg-ink-50 p-3 rounded-xl border border-ink-100 relative">
                <div className="flex flex-col text-left">
                  <Label htmlFor="recurring-mode" className="text-ink-900 cursor-pointer font-bold text-xs flex items-center gap-1">
                    Save as Recurring Template
                    <PremiumBadge type="pro" />
                  </Label>
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
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs">
            {errorMsg}
          </div>
        )}

        <button
          disabled={status === "generating" || status === "polling" || status === "done"}
          onClick={handleGenerate}
          className="w-full h-11 rounded-xl text-base bg-brand-500 text-white font-bold hover:bg-brand-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20"
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
          <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <a
                href={pdfUrl ? `/view/${encodeURIComponent(pdfUrl)}` : `/api/invoices/${activeInvoiceId}/download?view=1`}
                target="_blank"
                rel="noreferrer"
                className="h-10 rounded-lg bg-white border border-ink-200 text-ink-600 font-bold hover:bg-ink-50 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                View PDF
              </a>
              <a
                href={pdfUrl ? `/view/${encodeURIComponent(pdfUrl)}/download` : `/api/invoices/${activeInvoiceId}/download`}
                className="h-10 rounded-lg bg-brand-500 text-white font-bold hover:bg-brand-600 transition-colors flex items-center justify-center gap-2 text-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            </div>
            
            <button 
              onClick={handleShare}
              className="w-full h-10 rounded-lg border border-brand-200 bg-brand-50/50 text-brand-600 font-bold hover:bg-brand-50 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              Share Link
            </button>

            <button 
              onClick={() => setIsEmailOpen(true)}
              className="w-full h-10 rounded-lg bg-ink-900 text-white font-bold hover:bg-ink-800 transition-colors flex items-center justify-center gap-2 mt-2 text-sm"
            >
              <Send className="w-3.5 h-3.5" />
              Send to Client
            </button>

            <div className="flex items-center justify-center gap-4 mt-3">
              <a
                href="/dashboard"
                className="text-xs font-medium text-ink-400 hover:text-ink-600 transition-colors underline underline-offset-4"
              >
                Dashboard
              </a>
              <button
                onClick={() => {
                  clearInvoiceDraft();
                  window.location.href = effectiveIsQuote ? '/invoices/new?type=quote' : '/invoices/new';
                }}
                className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 transition-colors font-bold"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                {effectiveIsQuote ? 'New Quote' : 'New Invoice'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
