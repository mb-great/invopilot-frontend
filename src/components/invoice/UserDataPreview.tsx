"use client";
import { PreviewDetails } from "@/components/invoice/form/previewDetails";
import { useData } from "@/hooks/useData";
import { useFormContext } from "react-hook-form";

export const UserDataPreview = () => {
  const {
    companyDetails,
    invoiceDetails,
    invoiceTerms,
    paymentDetails,
    yourDetails,
  } = useData();
  const { setValue, watch } = useFormContext();
  const currentStep = watch("step");
  const generationStatus = watch("generationStatus") || "ready";

  const isGenerating = generationStatus === "generating" || generationStatus === "polling";

  const onClick = currentStep === "6" ? undefined : (step: string) => {
    setValue("step", step);
    localStorage.setItem("step", step);
  };

  return (
    <div className="relative h-full">
      {isGenerating && (
        <div className="absolute inset-0 z-10 bg-white/5 backdrop-blur-[1px] flex items-end justify-center pb-8 pointer-events-none">
          <span className="bg-ink-900/80 text-ink-200 text-xs px-3 py-1.5 rounded-full font-medium animate-pulse">
            Generating PDF...
          </span>
        </div>
      )}
      <PreviewDetails
        onClick={onClick}
        companyDetails={companyDetails}
        invoiceDetails={invoiceDetails}
        invoiceTerms={invoiceTerms}
        paymentDetails={paymentDetails}
        yourDetails={yourDetails}
      />
    </div>
  );
};
