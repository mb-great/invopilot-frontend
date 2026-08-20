"use client";
import { UserInputForm } from "@/components/invoice/form/userInputForm";
import { FormSteps } from "@/components/invoice/form/step/formSteps";
import { UserDataPreview } from "@/components/invoice/UserDataPreview";
import { PreviewZoom } from "@/components/invoice/PreviewZoom";
import { useForm, FormProvider } from "react-hook-form";
import { useSearchParams } from "next/navigation";
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
import UpgradeLimitModal from "@/components/billing/UpgradeLimitModal";
import { toast } from "sonner";
import { clearInvoiceDraft, saveInvoiceDraft, loadInvoiceDraft } from "@/lib/invoiceStorage";
import ImportSelectionModal, { ImportItem } from "@/components/invoice/ImportSelectionModal";

export default function InvoiceBuilder() {
  const methods = useForm<any>({
    defaultValues: {
      step: "1",
      signatureMode: "none",
      signatureUrl: "",
      customSignatureUrl: "",
      businessId: "",
    }
  });
  const step = methods.watch("step");
  const [isClient, setIsClient] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isProfilesModalOpen, setIsProfilesModalOpen] = useState(false);
  const [importModalType, setImportModalType] = useState<"business" | "client" | "template" | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; type: "invoice" | "storage"; max?: number; used?: number }>({ open: false, type: "invoice" });
  const [mobileView, setMobileView] = useState<"form" | "preview">("form");
  const importRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        // Draft Isolation & 12-Hour Expiry Check
        const currentUserId = user.id;
        const storedUserId = localStorage.getItem('invopilot_draft_user_id');
        const draftTimestamp = localStorage.getItem('invopilot_draft_timestamp');
        const isExpired = draftTimestamp && (Date.now() - parseInt(draftTimestamp, 10) > 6 * 60 * 60 * 1000);

        if (storedUserId !== currentUserId || isExpired) {
          clearInvoiceDraft();
          methods.reset({
            step: "1",
            items: [{ itemDescription: "", qty: 1, amount: 0 }],
            currency: "INR", taxRate: "0", discount: "0", yourCountry: "India", companyCountry: "India",
            yourName: "", yourEmail: "", yourAddress: "", yourCity: "", yourState: "", yourZip: "", yourTaxId: "", yourLogo: "",
            companyName: "", email: "", companyAddress: "", companyCity: "", companyState: "", companyZip: "", companyTaxId: "", companyLogo: "",
            invoiceNumber: "", note: "", bankName: "", accountName: "", accountNumber: "", ifscCode: "", routingCode: "", swiftCode: "",
            signatureMode: "none", signatureUrl: "", customSignatureUrl: "", businessId: ""
          });
        }
        localStorage.setItem('invopilot_draft_user_id', currentUserId);
        localStorage.setItem('invopilot_draft_timestamp', Date.now().toString());

        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        
        // Fetch businesses from active workspace
        const getCookie = (name: string) => document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))?.[2];
        let activeWorkspaceId = getCookie('invopilot_active_workspace');
        
        let businesses: any[] = [];
        if (activeWorkspaceId) {
          const { data: ws } = await supabase.from('workspaces').select('businesses').eq('id', activeWorkspaceId).single();
          if (ws && ws.businesses) businesses = ws.businesses;
        } else {
          // Fallback to personal workspace
          const { data: wss } = await supabase.from('workspaces').select('id, businesses').eq('owner_id', user.id).limit(1);
          if (wss && wss.length > 0) {
            if (wss[0].businesses) businesses = wss[0].businesses;
            activeWorkspaceId = wss[0].id;
          }
        }
        
        const enhancedProfile = {
          ...data,
          defaults: {
            ...data?.defaults,
            businesses
          }
        };
        
        setProfile(enhancedProfile);

        // Proactive gate check: if limit reached, show upgrade modal immediately
        const access = resolvePlanAccess(enhancedProfile);
        if (!access.isAdmin && !access.plan.maxInvoices) {
          // unlimited — skip check
        } else if (!access.isAdmin) {
          const maxInv = access.plan.maxInvoices as number;
          const workspaceId = activeWorkspaceId;
          if (workspaceId) {
            const { count } = await supabase
              .from('invoices')
              .select('id', { count: 'exact', head: true })
              .eq('workspace_id', workspaceId)
              .is('deleted_at', null);
            if ((count ?? 0) >= maxInv) {
              setUpgradeModal({ open: true, type: "invoice", max: maxInv, used: count ?? 0 });
            }
          }
        }
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
    async function loadClients() {
      try {
        const { getClients } = await import("@/app/dashboard/clients/actions");
        const data = await getClients();
        setClients(data || []);
      } catch (err) {
        console.error('Error loading clients in builder:', err);
      }
    }
    loadClients();
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
    });

    // Save updated draft
    const current = loadInvoiceDraft() || {};
    const update: Record<string, any> = { ...current };
    mappings.forEach(({ formField, val }) => { update[formField] = val; });
    saveInvoiceDraft(update);

    toast.success(`Imported business profile "${biz.name}"`);
    setIsImportOpen(false);
  };

  const handleImportClient = (client: any) => {
    const mappings: { formField: string; val: any }[] = [
      { formField: "companyName", val: client.company_name || client.name || "" },
      { formField: "email", val: client.email || "" },
      { formField: "companyAddress", val: client.address || "" },
      { formField: "companyCity", val: "" },
      { formField: "companyState", val: "" },
      { formField: "companyZip", val: "" },
      { formField: "companyCountry", val: "India" },
      { formField: "companyTaxId", val: client.vat_gstin || "" },
    ];

    mappings.forEach(({ formField, val }) => {
      methods.setValue(formField, val);
    });

    // Save updated draft
    const current = loadInvoiceDraft() || {};
    const update: Record<string, any> = { ...current };
    mappings.forEach(({ formField, val }) => { update[formField] = val; });
    saveInvoiceDraft(update);

    toast.success(`Imported client "${client.name}"`);
    setIsImportOpen(false);
  };

  const handleImportTemplate = (template: any) => {
    const data = template.form_data;
    if (!data) return;

    // Set form values, but skip issueDate/dueDate (user sets these manually)
    Object.keys(data).forEach((key) => {
      if (key === "issueDate" || key === "dueDate") return;
      const val = data[key];
      methods.setValue(key, val);
    });

    if (data.items) {
      methods.setValue("items", data.items);
    }

    // Save as single draft object (without dates)
    const draftData = { ...data };
    delete draftData.issueDate;
    delete draftData.dueDate;
    saveInvoiceDraft(draftData);

    // Navigate to step 5 (Invoice Terms) so user can set dates
    methods.setValue("step", "5");
    toast.success(`Template "${template.nickname}" loaded`);
    toast.info("Please set new issue & due dates — old template dates may be outdated", { duration: Infinity });
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
      
      const draft = loadInvoiceDraft();
      
      if (!draft || !draft.items || draft.items.length === 0 || (draft.items.length === 1 && !draft.items[0].itemDescription)) {
        methods.reset({
          step: "1",
          items: [{ itemDescription: "", qty: 1, amount: 0 }],
          currency: "INR",
          taxRate: "0",
          discount: "0",
          yourCountry: "India",
          companyCountry: "India",
          signatureMode: "none",
          signatureUrl: "",
          customSignatureUrl: "",
          businessId: ""
        });
      } else {
        let savedStep = draft.step || "1";
        if (savedStep === "6") {
          savedStep = "1";
        }

        methods.reset({
          step: savedStep,
          yourName: draft.yourName || "",
          yourEmail: draft.yourEmail || "",
          yourAddress: draft.yourAddress || "",
          yourCity: draft.yourCity || "",
          yourState: draft.yourState || "",
          yourZip: draft.yourZip || "",
          yourCountry: draft.yourCountry || "India",
          yourTaxId: draft.yourTaxId || "",
          yourLogo: draft.yourLogo || "",
          companyName: draft.companyName || "",
          email: draft.email || "",
          companyAddress: draft.companyAddress || "",
          companyCity: draft.companyCity || "",
          companyState: draft.companyState || "",
          companyZip: draft.companyZip || "",
          companyCountry: draft.companyCountry || "India",
          companyTaxId: draft.companyTaxId || "",
          companyLogo: draft.companyLogo || "",
          invoiceNumber: draft.invoiceNumber || "",
          issueDate: draft.issueDate ? new Date(draft.issueDate) : new Date(),
          dueDate: draft.dueDate ? new Date(draft.dueDate) : undefined,
          currency: draft.currency || "INR",
          taxRate: draft.taxRate || "0",
          discount: draft.discount || "0",
          note: draft.note || "",
          bankName: draft.bankName || "",
          accountName: draft.accountName || "",
          accountNumber: draft.accountNumber || "",
          ifscCode: draft.ifscCode || "",
          routingCode: draft.routingCode || "",
          swiftCode: draft.swiftCode || "",
          items: draft.items || [{ itemDescription: "", qty: 1, amount: 0 }],
          selectedMethods: draft.selectedMethods || [],
          upiId: draft.upiId || "",
          upiLockAmount: draft.upiLockAmount || false,
          showUpiQr: draft.showUpiQr !== false,
          signatureMode: draft.signatureMode || "none",
          signatureUrl: draft.signatureUrl || "",
          customSignatureUrl: draft.customSignatureUrl || "",
          businessId: draft.businessId || "",
        });
      }
    }
  }, [methods]);

  // Auto-save draft whenever form values change
  useEffect(() => {
    if (!isClient) return;
    const subscription = methods.watch((values) => {
      if (values && typeof values === 'object') {
        saveInvoiceDraft(values);
      }
    });
    return () => subscription.unsubscribe();
  }, [methods, isClient]);

  // Load existing quote for editing
  const searchParams = useSearchParams();
  const editId = searchParams?.get('edit');
  
  useEffect(() => {
    if (!editId || !isClient) return;
    
    async function loadQuoteForEdit() {
      try {
        const res = await fetch(`/api/invoices/${editId}/edit`);
        if (!res.ok) throw new Error('Failed to load quote');
        const { data } = await res.json();
        if (!data?.form_data) throw new Error('No form data found');
        
        const fd = data.form_data;
        methods.reset({
          step: "5", // Start at review step
          yourName: fd.yourName || "",
          yourEmail: fd.yourEmail || "",
          yourAddress: fd.yourAddress || "",
          yourCity: fd.yourCity || "",
          yourState: fd.yourState || "",
          yourZip: fd.yourZip || "",
          yourCountry: fd.yourCountry || "India",
          yourTaxId: fd.yourTaxId || "",
          yourLogo: fd.yourLogo || "",
          companyName: fd.companyName || "",
          email: fd.email || "",
          companyAddress: fd.companyAddress || "",
          companyCity: fd.companyCity || "",
          companyState: fd.companyState || "",
          companyZip: fd.companyZip || "",
          companyCountry: fd.companyCountry || "India",
          companyTaxId: fd.companyTaxId || "",
          companyLogo: fd.companyLogo || "",
          invoiceNumber: fd.invoiceNumber || "",
          issueDate: fd.issueDate ? new Date(fd.issueDate) : new Date(),
          dueDate: fd.dueDate ? new Date(fd.dueDate) : undefined,
          currency: fd.currency || "INR",
          taxRate: fd.taxRate || "0",
          discount: fd.discount || "0",
          note: fd.note || "",
          bankName: fd.bankName || "",
          accountName: fd.accountName || "",
          accountNumber: fd.accountNumber || "",
          ifscCode: fd.ifscCode || "",
          routingCode: fd.routingCode || "",
          swiftCode: fd.swiftCode || "",
          items: fd.items || [{ itemDescription: "", qty: 1, amount: 0 }],
          selectedMethods: fd.selectedMethods || [],
          upiId: fd.upiId || "",
          upiLockAmount: fd.upiLockAmount || false,
          showUpiQr: fd.showUpiQr || false,
          nickname: fd.nickname || data.nickname || "",
          signatureMode: fd.signatureMode || "none",
          signatureUrl: fd.signatureUrl || "",
          customSignatureUrl: fd.customSignatureUrl || "",
          isQuote: true,
          businessId: fd.businessId || "",
        });
        
        // Store the edit ID for the generate button to use
        localStorage.setItem('edit_invoice_id', editId!);
        toast.success('Loaded quote for editing');
      } catch (err) {
        toast.error('Failed to load quote for editing');
        console.error(err);
      }
    }
    
    loadQuoteForEdit();
  }, [editId, isClient, methods]);

  const handleDiscard = () => {
    if (typeof window !== "undefined") {
      clearInvoiceDraft();
      methods.reset({
        step: "1",
        items: [{ itemDescription: "", qty: 1, amount: 0 }],
        currency: "INR", taxRate: "0", discount: "0", yourCountry: "India", companyCountry: "India",
        yourName: "", yourEmail: "", yourAddress: "", yourCity: "", yourState: "", yourZip: "", yourTaxId: "", yourLogo: "",
        companyName: "", email: "", companyAddress: "", companyCity: "", companyState: "", companyZip: "", companyTaxId: "", companyLogo: "",
        invoiceNumber: "", note: "", bankName: "", accountName: "", accountNumber: "", ifscCode: "", routingCode: "", swiftCode: "",
        signatureMode: "none", signatureUrl: "", customSignatureUrl: "", businessId: ""
      });
      setShowDiscardModal(false);
      toast.success("Draft cleared successfully");
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

          <UpgradeLimitModal
            isOpen={upgradeModal.open}
            onClose={() => setUpgradeModal({ open: false, type: "invoice" })}
            limitType={upgradeModal.type}
            max={upgradeModal.max}
            used={upgradeModal.used}
          />

          <div className="h-[100dvh] w-full flex flex-col md:flex-row bg-white overflow-hidden">
            {/* Mobile Toggle Bar */}
            <div className="md:hidden flex border-b border-ink-100 shrink-0">
              <button
                onClick={() => setMobileView("form")}
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                  mobileView === "form" ? "text-brand-600 border-b-2 border-brand-500 bg-brand-50/50" : "text-ink-400 hover:text-ink-600"
                }`}
              >
                Form
              </button>
              <button
                onClick={() => setMobileView("preview")}
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                  mobileView === "preview" ? "text-brand-600 border-b-2 border-brand-500 bg-brand-50/50" : "text-ink-400 hover:text-ink-600"
                }`}
              >
                Preview
              </button>
            </div>

            {/* Form Side */}
            <div className={`w-full md:w-[450px] lg:w-[500px] flex-1 min-h-0 md:flex-none md:h-full bg-white border-r border-ink-100 flex flex-col md:shrink-0 ${mobileView !== "form" ? "hidden md:flex" : ""}`}>
              
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
                    {step !== "6" && (
                      <div className="relative" ref={importRef}>
                        <button
                          onClick={() => setIsImportOpen(!isImportOpen)}
                          className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3.5 py-1.5 rounded-lg transition-colors border border-brand-100/50 shadow-sm"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Import</span>
                        </button>

                        {isImportOpen && (
                          <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-ink-150 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="p-1 divide-y divide-ink-50">
                              
                              <button
                                onClick={() => {
                                  setIsImportOpen(false);
                                  setImportModalType("business");
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-ink-50 transition-colors text-ink-700 font-medium flex items-center gap-2"
                              >
                                💼 Import Business
                              </button>

                              <button
                                onClick={() => {
                                  setIsImportOpen(false);
                                  setImportModalType("client");
                                }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-ink-50 transition-colors text-ink-700 font-medium flex items-center gap-2"
                              >
                                👤 Import Client
                              </button>

                              {!canUseRecurring ? (
                                <button
                                  onClick={() => {
                                    setIsImportOpen(false);
                                    toast.error("Upgrade to Pro to load recurring templates.");
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50/50 transition-colors text-amber-600 font-medium flex items-center justify-between"
                                >
                                  <span className="flex items-center gap-2">🔄 Load Template</span>
                                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setIsImportOpen(false);
                                    setImportModalType("template");
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-ink-50 transition-colors text-ink-700 font-medium flex items-center gap-2"
                                >
                                  🔄 Load Template
                                </button>
                              )}

                              <div className="p-1 pt-2 mt-1">
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
                    )}

                    <button 
                      onClick={() => setShowDiscardModal(true)}
                      className="flex items-center gap-2 text-ink-300 hover:text-red-500 transition-colors text-xs font-bold uppercase tracking-widest"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 items-center mb-8">
                  <img src="/logo.webp" alt="InvoPilot Logo" className="w-10 h-10 object-contain drop-shadow-sm" />
                  <div>
                    <p className="font-bold text-ink-900 leading-tight">InvoPilot</p>
                    <p className="text-brand-500 text-[10px] font-bold uppercase tracking-widest">Builder</p>
                  </div>
                </div>
              </div>

              {/* Scrollable Form Content */}
              <div className="flex-1 overflow-y-auto px-6 md:px-10 lg:px-12 pb-4">
                <UserInputFormWithGenerate profile={profile} canUploadLogo={canUploadLogo} />
              </div>

              {/* Sticky Footer */}
              <div className="p-6 md:p-10 lg:p-12 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:pb-10 lg:pb-12 border-t border-ink-50 shrink-0 bg-white">
                <FormSteps />
              </div>
            </div>

            {/* Preview Side */}
            <div className={`flex-1 min-h-0 md:h-full bg-[#f9fafb] relative overflow-hidden ${mobileView !== "preview" ? "hidden md:block" : ""}`}>
              <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"></div>
              <PreviewZoom>
                <UserDataPreview />
              </PreviewZoom>
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

          <ImportSelectionModal
            isOpen={importModalType !== null}
            onClose={() => setImportModalType(null)}
            title={
              importModalType === "business" ? "Import Business" :
              importModalType === "client" ? "Import Client" :
              importModalType === "template" ? "Load Template" : ""
            }
            items={
              importModalType === "business" 
                ? businesses.map((b: any) => ({ id: b.id, name: b.name, subtitle: b.email, icon: "💼", raw: b }))
                : importModalType === "client"
                ? clients.map((c: any) => ({ id: c.id, name: c.name || c.company_name, subtitle: c.email, icon: "👤", raw: c }))
                : importModalType === "template"
                ? templates.map((t: any) => ({ id: t.id, name: t.nickname, icon: "🔄", raw: t }))
                : []
            }
            onSelect={(item) => {
              if (importModalType === "business") handleImportBusiness(item);
              else if (importModalType === "client") handleImportClient(item);
              else if (importModalType === "template") handleImportTemplate(item);
              setImportModalType(null);
            }}
            emptyStateMessage={
              importModalType === "business" ? "No business profiles found. Go to Dashboard > Settings to add one." :
              importModalType === "client" ? "No clients found. Go to Dashboard > Clients to add one." :
              importModalType === "template" ? "No recurring templates saved." : ""
            }
          />
        </FormProvider>
      ) : (
        <div className="min-h-[100dvh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </>
  );
}

function UserInputFormWithGenerate({ profile, canUploadLogo }: { profile: any; canUploadLogo: boolean }) {
  const step = useGetValue("step", getInitialValue("step", "1"));

  if (step === "6") {
    return <GenerateInvoiceButton profile={profile} />;
  }

  return <UserInputForm profile={profile} canUploadLogo={canUploadLogo} />;
}
