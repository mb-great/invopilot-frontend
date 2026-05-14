"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useData } from "@/hooks/useData";
import { useEffect, useState } from "react";
import { ShareDialog } from "@/components/dashboard/ShareDialog";

export const GenerateInvoiceButton = () => {
  const [status, setStatus] = useState<
    "ready" | "generating" | "polling" | "done" | "error"
  >("ready");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [shareSlug, setShareSlug] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const {
    companyDetails,
    invoiceDetails,
    invoiceTerms,
    paymentDetails,
    yourDetails,
  } = useData();

  useEffect(() => {
    if (status === "done") {
      const timer = setTimeout(() => setStatus("ready"), 10000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleGenerate = async () => {
    setStatus("generating");
    setErrorMsg("");
    setActiveInvoiceId(null);
    setShareSlug(null);

    // Build full formData matching backend RawInvoiceData contract
    const formData = {
      ...yourDetails,
      ...companyDetails,
      ...invoiceTerms,
      ...paymentDetails,
      items: invoiceDetails.items,
      note: invoiceDetails.note,
      discount: invoiceDetails.discount,
      taxRate: invoiceDetails.taxRate,
      currency: invoiceDetails.currency,
      amount: invoiceDetails.items.reduce((sum, item) => {
        const qty = item.qty || 1;
        const amt = item.amount || 0;
        return sum + qty * amt;
      }, 0),
      clientName: companyDetails.companyName || "",
      clientEmail: companyDetails.email || "",
      invoiceNumber: invoiceTerms.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
    };

    try {
      const res = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData,
          nickname: `${companyDetails.companyName || "Invoice"} - ${invoiceTerms.invoiceNumber || ""}`.trim(),
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
      const interval = setInterval(async () => {
        attempts++;
        try {
          const statusRes = await fetch(`/api/invoices/${invoiceId}/status`);
          if (!statusRes.ok) return;
          const data = await statusRes.json();

          if (data.status === "done") {
            clearInterval(interval);
            setShareSlug(data.share_slug);
            setStatus("done");
          } else if (data.status === "failed") {
            clearInterval(interval);
            setErrorMsg(data.error_msg || "Generation failed");
            setStatus("error");
          }
        } catch {
          // retry silently
        }

        if (attempts > 60) {
          clearInterval(interval);
          setErrorMsg("Timed out waiting for PDF");
          setStatus("error");
        }
      }, 2000);
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  };

  const handleShare = () => {
    if (shareSlug) {
      setIsShareOpen(true);
    }
  };

  return (
    <div className="flex h-[calc(100vh-208px)] justify-center items-center px-4">
      <ShareDialog 
        isOpen={isShareOpen} 
        onClose={() => setIsShareOpen(false)} 
        shareUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/i/${shareSlug}`} 
      />
      <div className="w-full max-w-md text-center">
        <h1 className="text-4xl font-bold pb-4 text-ink-900">
          {status === "done" ? "Invoice Generated!" : "Your invoice is ready"}
        </h1>
        <p className="text-ink-500 text-lg pb-8">
          {status === "done"
            ? "Your PDF has been generated and stored securely."
            : "Please review the details carefully before generating your invoice."}
        </p>

        {status === "error" && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {errorMsg}
          </div>
        )}

        <button
          disabled={status === "generating" || status === "polling"}
          onClick={handleGenerate}
          className="w-full h-14 rounded-xl text-xl bg-brand-500 text-white font-bold hover:bg-brand-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl shadow-brand-500/20"
        >
          {status === "ready" && (
            <>
              <Send className="h-6 w-6" /> Generate Invoice
            </>
          )}
          {status === "generating" && (
            <>
              <Loader2 className="h-6 w-6 animate-spin" /> Queuing...
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
                Download
              </a>
            </div>
            
            <button 
              onClick={handleShare}
              className="w-full h-12 rounded-lg border border-brand-200 bg-brand-50/50 text-brand-600 font-bold hover:bg-brand-50 transition-colors flex items-center justify-center gap-2"
            >
              Share Link
            </button>

            <a
              href="/dashboard"
              className="block mt-6 text-sm font-medium text-ink-400 hover:text-ink-600 transition-colors underline underline-offset-4"
            >
              Go to Dashboard
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
