"use client";
import { UserInputForm } from "@/components/invoice/form/userInputForm";
import { FormSteps } from "@/components/invoice/form/step/formSteps";
import { UserDataPreview } from "@/components/invoice/UserDataPreview";
import { useForm, FormProvider } from "react-hook-form";
import { useEffect, useState, useRef } from "react";
import { useGetValue } from "@/hooks/useGetValue";
import { getInitialValue } from "@/lib/getInitialValue";
import { GenerateInvoiceButton } from "@/components/invoice/form/downloadInvoice/generateInvoiceButton";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Download, Lock, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getRecurringTemplates } from "@/app/dashboard/recurring/actions";
import { resolvePlanAccess } from "@/lib/billing/tiers";
import InvoPilotBusinessProfilesModal from "@/components/dashboard/InvoPilotBusinessProfilesModal";
import { toast } from "sonner";
import { clearInvoiceDraft } from "@/lib/invoiceStorage";

export default function InvoiceBuilder() {
  const methods = useForm();
  const [isClient, setIsClient] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isProfilesModalOpen, setIsProfilesModalOpen] = useState(false);
  const importRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data);
      } catch (err) {
        console.error('Error loading profile in builder:', err);
      }
    }
    loadProfile();
  }, []);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const data = await getRecurringTemplates();
        setTemplates(data || []);
      } catch (err) {
        console.error('Error loading templates in builder:', err);
      }
    }
    loadTemplates();
  }, [profile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (importRef.current && !importRef.current.contains(event.target as Node)) {
        setIsImportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleImportBusiness = (biz: any) => {
    const mappings: { formField: string; val: any }[] = [
      { formField: "yourName", val: biz.name || "" },
      { formField: "yourEmail", val: biz.email || "" },
      { formField: "yourAddress", val: biz.address || "" },
      { formField: "yourCity", val: biz.city || "" },
      { formField: "yourState", val: biz.state || "" },
      { formField: "yourZip", val: biz.zip || "" },
      { formField: "yourCountry", val: biz.country || "India" },
      { formField: "yourTaxId", val: biz.gstin || "" },
      { formField: "yourLogo", val: biz.logoUrl || "" },
      { formField: "bankName", val: biz.bankName || "" },
      { formField: "accountNumber", val: biz.accountNo || "" },
      { formField: "ifscCode", val: biz.ifsc || "" },
    ];

    mappings.forEach(({ formField, val }) => {
      methods.setValue(formField, val);
      if (typeof window !== "undefined") {
        if (val) {
          localStorage.setItem(formField, val);
        } else {
          localStorage.removeItem(formField);
        }
      }
    });

    toast.success(`Imported business profile "${biz.name}"`);
    setIsImportOpen(false);
  };

  const handleImportTemplate = (template: any) => {
    const data = template.form_data;
    if (!data) return;

    Object.keys(data).forEach((key) => {
      if (key === "issueDate" || key === "dueDate") return;
      const val = data[key];
      methods.setValue(key, val);
      if (typeof window !== "undefined") {
        if (typeof val === "string") {
          localStorage.setItem(key, val);
        } else if (val !== null && val !== undefined) {
          localStorage.setItem(key, JSON.stringify(val));
        } else {
          localStorage.removeItem(key);
        }
      }
    });

    if (data.items) {
      methods.setValue("items", data.items);
      if (typeof window !== "undefined") {
        localStorage.setItem("items", JSON.stringify(data.items));
      }
    }

    toast.success(`Loaded template "${template.nickname}"`);
    setIsImportOpen(false);
  };

  const access = profile ? resolvePlanAccess({
    role: profile.role,
    tier: profile.tier,
    subscription_status: profile.subscription_status,
    subscription_period_end: profile.subscription_period_end,
  }) : null;

  const canUseRecurring = access ? (access.plan.canUseRecurring || access.isAdmin) : false;
  const maxBusinesses = access ? access.plan.maxBusinesses : 1;
  const canUploadLogo = access ? (access.plan.canUploadLogo || access.isAdmin) : false;
  const businesses = profile?.defaults?.businesses?.filter((b: any) => !b.deletedAt) || [];

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
        let savedStep = localStorage.getItem("step") || "1";
        // Never load directly into the "Generated" step (6). If they reload, reset to step 1 so they can edit.
        if (savedStep === "6") {
          savedStep = "1";
          localStorage.setItem("step", "1");
        }

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
      clearInvoiceDraft();
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

          <div className="h-[100dvh] w-full flex flex-col md:flex-row bg-white overflow-hidden">
            {/* Form Side */}
            <div className="w-full md:w-[450px] lg:w-[500px] h-full bg-white border-r border-ink-100 flex flex-col shrink-0">
              
              {/* Sticky Header */}
              <div className="p-6 md:p-10 lg:p-12 pb-0 shrink-0">
                <div className="flex items-center justify-between mb-8">
                  <button 
                    onClick={handleBackClick}
                    className="flex items-center gap-2 text-ink-400 hover:text-ink-900 transition-colors group"
                  >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-bold uppercase tracking-widest">Back</span>
                  </button>
                  
                  <div className="flex items-center gap-4">
                    {/* Unified Import Dropdown */}
                    <div className="relative" ref={importRef}>
                      <button
                        onClick={() => setIsImportOpen(!isImportOpen)}
                        className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3.5 py-1.5 rounded-lg transition-colors border border-brand-100/50 shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Import</span>
                      </button>

                      {isImportOpen && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-ink-150 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[350px] animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="overflow-y-auto p-1 divide-y divide-ink-50">
                            {/* Business Profiles Group */}
                            <div className="py-1">
                              <span className="block px-3 py-1 text-[9px] uppercase font-bold tracking-widest text-ink-400">Business Profiles</span>
                              {businesses.length === 0 ? (
                                <span className="block px-3 py-1.5 text-xs text-ink-400 italic">No profiles created</span>
                              ) : (
                                businesses.map((biz: any) => (
                                  <button
                                    key={biz.id}
                                    onClick={() => handleImportBusiness(biz)}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-ink-50 transition-colors text-ink-700 truncate"
                                  >
                                    💼 {biz.name}
                                  </button>
                                ))
                              )}
                            </div>

                            {/* Recurring Templates Group */}
                            <div className="py-1">
                              <div className="flex items-center justify-between px-3 py-1">
                                <span className="text-[9px] uppercase font-bold tracking-widest text-ink-400">Recurring Templates</span>
                                {!canUseRecurring && <Lock className="w-2.5 h-2.5 text-amber-500" />}
                              </div>
                              {!canUseRecurring ? (
                                <button
                                  onClick={() => {
                                    setIsImportOpen(false);
                                    toast.error("Upgrade to Pro to load recurring templates.");
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50/50 transition-colors text-amber-600 font-medium flex items-center gap-1.5"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  Unlock Templates
                                </button>
                              ) : templates.length === 0 ? (
                                <span className="block px-3 py-1.5 text-xs text-ink-400 italic">No templates saved</span>
                              ) : (
                                templates.map((t: any) => (
                                  <button
                                    key={t.id}
                                    onClick={() => handleImportTemplate(t)}
                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-ink-50 transition-colors text-ink-700 truncate"
                                  >
                                    🔄 {t.nickname}
                                  </button>
                                ))
                              )}
                            </div>

                            {/* Manage Link */}
                            <div className="p-1">
                              <button
                                onClick={() => {
                                  setIsImportOpen(false);
                                  setIsProfilesModalOpen(true);
                                }}
                                className="w-full text-center py-2 bg-ink-50 hover:bg-brand-50 hover:text-brand-700 text-ink-700 font-bold rounded-lg text-[10px] uppercase tracking-wider transition-all border border-transparent hover:border-brand-200"
                              >
                                Manage Profiles
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={() => setShowDiscardModal(true)}
                      className="flex items-center gap-2 text-ink-300 hover:text-red-500 transition-colors text-xs font-bold uppercase tracking-widest"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear Draft
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 items-center mb-8">
                  <img src="/logo.png" alt="InvoPilot Logo" className="w-10 h-10 object-contain drop-shadow-sm" />
                  <div>
                    <p className="font-bold text-ink-900 leading-tight">InvoPilot</p>
                    <p className="text-brand-500 text-[10px] font-bold uppercase tracking-widest">Builder</p>
                  </div>
                </div>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 overflow-y-auto px-6 md:px-10 lg:px-12 pb-12">
                <UserInputFormWithGenerate profile={profile} />
              </div>

              {/* Sticky Footer */}
              <div className="p-6 md:p-10 lg:p-12 pt-6 border-t border-ink-50 shrink-0 bg-white">
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
          {profile && (
            <InvoPilotBusinessProfilesModal
              isOpen={isProfilesModalOpen}
              onClose={() => setIsProfilesModalOpen(false)}
              profile={profile}
              userId={profile.id}
              maxBusinesses={maxBusinesses}
              canUploadLogo={canUploadLogo}
            />
          )}
        </FormProvider>
      ) : (
        <div className="min-h-[100dvh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </>
  );
}

function UserInputFormWithGenerate({ profile }: { profile: any }) {
  const step = useGetValue("step", getInitialValue("step", "1"));

  if (step === "6") {
    return <GenerateInvoiceButton profile={profile} />;
  }

  return <UserInputForm profile={profile} />;
}
