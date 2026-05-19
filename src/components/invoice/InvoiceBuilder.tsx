"use client";
import { UserInputForm } from "@/components/invoice/form/userInputForm";
import { FormSteps } from "@/components/invoice/form/step/formSteps";
import { UserDataPreview } from "@/components/invoice/UserDataPreview";
import { useForm, FormProvider } from "react-hook-form";
import { useEffect, useState } from "react";
import { useGetValue } from "@/hooks/useGetValue";
import { getInitialValue } from "@/lib/getInitialValue";
import { GenerateInvoiceButton } from "@/components/invoice/form/downloadInvoice/generateInvoiceButton";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";

export default function InvoiceBuilder() {
  const methods = useForm();
  const [isClient, setIsClient] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsClient(true);
      
      const savedItems = localStorage.getItem("items");
      const shouldReset = !savedItems || savedItems === '[{"itemDescription":""}]';
      
      if (shouldReset) {
        methods.reset({
          step: "1",
          items: [{ itemDescription: "", qty: 1, amount: 0 }],
          currency: "INR",
          taxRate: "0",
          discount: "0",
          yourCountry: "India",
          companyCountry: "India"
        });
      } else {
        const savedStep = localStorage.getItem("step") || "1";
        methods.reset({
          step: savedStep,
          yourName: localStorage.getItem("yourName") || "",
          yourEmail: localStorage.getItem("yourEmail") || "",
          yourAddress: localStorage.getItem("yourAddress") || "",
          yourCity: localStorage.getItem("yourCity") || "",
          yourState: localStorage.getItem("yourState") || "",
          yourZip: localStorage.getItem("yourZip") || "",
          yourCountry: localStorage.getItem("yourCountry") || "India",
          yourTaxId: localStorage.getItem("yourTaxId") || "",
          yourLogo: localStorage.getItem("yourLogo") || "",
          companyName: localStorage.getItem("companyName") || "",
          email: localStorage.getItem("email") || "",
          companyAddress: localStorage.getItem("companyAddress") || "",
          companyCity: localStorage.getItem("companyCity") || "",
          companyState: localStorage.getItem("companyState") || "",
          companyZip: localStorage.getItem("companyZip") || "",
          companyCountry: localStorage.getItem("companyCountry") || "India",
          companyTaxId: localStorage.getItem("companyTaxId") || "",
          companyLogo: localStorage.getItem("companyLogo") || "",
          invoiceNumber: localStorage.getItem("invoiceNumber") || "",
          issueDate: localStorage.getItem("issueDate") ? new Date(localStorage.getItem("issueDate")!) : new Date(),
          dueDate: localStorage.getItem("dueDate") ? new Date(localStorage.getItem("dueDate")!) : undefined,
          currency: localStorage.getItem("currency") || "INR",
          taxRate: localStorage.getItem("taxRate") || "0",
          discount: localStorage.getItem("discount") || "0",
          note: localStorage.getItem("note") || "",
          bankName: localStorage.getItem("bankName") || "",
          accountName: localStorage.getItem("accountName") || "",
          accountNumber: localStorage.getItem("accountNumber") || "",
          ifscCode: localStorage.getItem("ifscCode") || "",
          routingCode: localStorage.getItem("routingCode") || "",
          swiftCode: localStorage.getItem("swiftCode") || "",
          items: JSON.parse(savedItems || '[{"itemDescription":""}]'),
        });
      }
    }
  }, [methods]);

  const handleDiscard = () => {
    if (typeof window !== "undefined") {
      localStorage.clear();
      router.push("/dashboard");
    }
  };

  const handleBackClick = () => {
    router.push("/dashboard");
  };

  return (
    <>
      {isClient ? (
        <FormProvider {...methods}>
          <ConfirmationModal
            isOpen={showDiscardModal}
            onClose={() => setShowDiscardModal(false)}
            onConfirm={handleDiscard}
            title="Clear current draft?"
            message="This will permanently delete all the information you've entered in this invoice. This action cannot be undone."
            confirmLabel="Clear Draft"
            isDestructive={true}
            requirePassword={false}
          />

          <div className="h-screen w-screen flex flex-col md:flex-row bg-white overflow-hidden">
            {/* Form Side */}
            <div className="w-full md:w-[450px] lg:w-[500px] h-full overflow-y-auto bg-white border-r border-ink-100 flex flex-col p-6 md:p-10 lg:p-12 shrink-0">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-10">
                  <button 
                    onClick={handleBackClick}
                    className="flex items-center gap-2 text-ink-400 hover:text-ink-900 transition-colors group"
                  >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-bold uppercase tracking-widest">Back</span>
                  </button>
                  
                  <button 
                    onClick={() => setShowDiscardModal(true)}
                    className="flex items-center gap-2 text-ink-300 hover:text-red-500 transition-colors text-xs font-bold uppercase tracking-widest"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Draft
                  </button>
                </div>

                <div className="flex gap-3 items-center mb-10">
                  <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                    <span className="font-bold text-xl italic">I</span>
                  </div>
                  <div>
                    <p className="font-bold text-ink-900 leading-tight">InvoPilot</p>
                    <p className="text-brand-500 text-[10px] font-bold uppercase tracking-widest">Builder</p>
                  </div>
                </div>

                <div className="pb-20">
                  <UserInputFormWithGenerate />
                </div>
              </div>
              <div className="pt-6 border-t border-ink-50">
                <FormSteps />
              </div>
            </div>

            {/* Preview Side */}
            <div className="flex-1 h-full bg-ink-50 relative flex justify-center items-center p-4 md:p-12 overflow-hidden">
              <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]"></div>
              <div className="h-full w-auto shadow-2xl shadow-ink-900/10 rounded-sm">
                <UserDataPreview />
              </div>
            </div>
          </div>
        </FormProvider>
      ) : (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </>
  );
}

function UserInputFormWithGenerate() {
  const step = useGetValue("step", getInitialValue("step", "1"));

  if (step === "6") {
    return <GenerateInvoiceButton />;
  }

  return <UserInputForm />;
}
