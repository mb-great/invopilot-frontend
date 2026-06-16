"use client";

import { useFormContext, Controller, useWatch } from "react-hook-form";
import { useEffect, useState, useRef } from "react";
import PaymentMethodModal, { SelectedPaymentMethod } from "./PaymentMethodModal";
import { toast } from "sonner";
import { Pencil, X, Upload } from "lucide-react";
import { resolvePlanAccess } from "@/lib/billing/tiers";
import { createClient } from "@/lib/supabase/client";

const getActiveWorkspaceId = (): string | null => {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )invopilot_active_workspace=([^;]+)"));
  return match ? match[2] : null;
};

const updateBusinessSignature = async (businessId: string, signatureUrl: string): Promise<boolean> => {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    let workspaceId = getActiveWorkspaceId();
    if (!workspaceId) {
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", user.id)
        .limit(1)
        .single();
      workspaceId = ws?.id;
    }
    if (!workspaceId) return false;

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("businesses")
      .eq("id", workspaceId)
      .single();

    if (!workspace?.businesses) return false;

    const updatedBusinesses = workspace.businesses.map((b: any) =>
      b.id === businessId ? { ...b, signatureUrl } : b
    );

    const { error } = await supabase
      .from("workspaces")
      .update({ businesses: updatedBusinesses })
      .eq("id", workspaceId);

    return !error;
  } catch {
    return false;
  }
};

export const PaymentDetailsForm = ({ profile }: { profile: any }) => {
  const { setValue, getValues, control } = useFormContext();
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const signatureMode = useWatch({ control, name: "signatureMode" });
  const signatureUrl = useWatch({ control, name: "signatureUrl" });
  const customSignatureUrl = useWatch({ control, name: "customSignatureUrl" });
  const businessId = useWatch({ control, name: "businessId" });

  const businesses = profile?.defaults?.businesses?.filter((b: any) => !b.deletedAt) || [];
  const activeBiz = businesses.find((b: any) => b.id === businessId);

  const [uploadingCustomSig, setUploadingCustomSig] = useState(false);
  const [saveTargetBusinessId, setSaveTargetBusinessId] = useState<string>("");
  const [savingSignature, setSavingSignature] = useState(false);
  const customSigRef = useRef<HTMLInputElement>(null);

  // Register these fields so useWatch reliably tracks them even if they are loaded via reset()
  useEffect(() => {
    control.register("signatureMode");
    control.register("signatureUrl");
    control.register("customSignatureUrl");
  }, [control]);

  const processImageToWebP = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === "image/svg+xml") {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read SVG"));
        reader.readAsDataURL(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) { reject(new Error("Failed to get canvas context")); return; }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/webp", 0.8));
          } catch (err) { reject(err); }
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleCustomSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setUploadingCustomSig(true);
      const dataUri = await processImageToWebP(file);
      const stringLength = dataUri.length - (dataUri.indexOf(",") + 1);
      const sizeBytes = Math.ceil(stringLength * 0.75);
      if (sizeBytes > 2 * 1024 * 1024) {
        toast.error("Compressed signature exceeds 2MB limit.");
        return;
      }
      setValue("customSignatureUrl", dataUri);
      if (typeof window !== "undefined") {
        localStorage.setItem("customSignatureUrl", dataUri);
      }
      toast.success("Custom signature uploaded");
    } catch (err: unknown) {
      toast.error("Failed to upload signature: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingCustomSig(false);
      if (customSigRef.current) customSigRef.current.value = "";
    }
  };

  const handleSaveToProfile = async () => {
    if (!saveTargetBusinessId || !customSignatureUrl) return;
    try {
      setSavingSignature(true);
      const ok = await updateBusinessSignature(saveTargetBusinessId, customSignatureUrl);
      if (ok) {
        toast.success("Signature saved to business profile successfully!");
        if (saveTargetBusinessId === businessId) {
          setValue("signatureUrl", customSignatureUrl);
          if (typeof window !== "undefined") {
            localStorage.setItem("signatureUrl", customSignatureUrl);
          }
        }
      } else {
        toast.error("Failed to save signature to profile");
      }
    } catch (err) {
      toast.error("Error saving signature");
    } finally {
      setSavingSignature(false);
    }
  };

  const access = resolvePlanAccess(profile);
  const canUseUpiQr = access.plan.canUseUpiQr || access.isAdmin;

  const [methods, setMethods] = useState<SelectedPaymentMethod[]>(() => {
    try {
      const stored = getValues("selectedMethods");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });

  const persistMethods = (next: SelectedPaymentMethod[]) => {
    setMethods(next);
    setValue("selectedMethods", next, { shouldDirty: true });
    localStorage.setItem("selectedMethods", JSON.stringify(next));
  };

  const syncBankFields = (detail: Record<string, string>) => {
    const fieldMap: Record<string, string> = {
      bankName: 'bankName',
      accountNumber: 'accountNumber',
      accountName: 'accountName',
      ifscCode: 'ifscCode',
      routingCode: 'routingCode',
      swiftCode: 'swiftCode',
    };
    for (const [key, field] of Object.entries(fieldMap)) {
      if (detail[key] !== undefined) {
        setValue(field, detail[key], { shouldDirty: true });
        localStorage.setItem(field, detail[key]);
      }
    }
  };

  const clearBankFields = () => {
    const fields = ['bankName', 'accountNumber', 'accountName', 'ifscCode', 'routingCode', 'swiftCode'];
    for (const f of fields) {
      setValue(f, '', { shouldDirty: true });
      localStorage.setItem(f, '');
    }
  };

  const syncUpiFields = (detail: { upiId: string; showQr: boolean; lockAmount: boolean }) => {
    setValue('upiId', detail.upiId, { shouldDirty: true });
    localStorage.setItem('upiId', detail.upiId);
    setValue('showUpiQr', detail.showQr, { shouldDirty: true });
    localStorage.setItem('showUpiQr', String(detail.showQr));
    setValue('upiLockAmount', detail.lockAmount, { shouldDirty: true });
    localStorage.setItem('upiLockAmount', String(detail.lockAmount));
  };

  const clearUpiFields = () => {
    setValue('upiId', '', { shouldDirty: true });
    localStorage.setItem('upiId', '');
  };

  useEffect(() => {
    const handleBankDetails = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const newMethod: SelectedPaymentMethod = {
        id: 'bank-details',
        title: 'Bank Details',
        value: [detail.accountName, detail.bankName].filter(Boolean).join(' · ') || 'Bank Details',
        color: '#1a56db',
        badge: '🏦',
      };

      const next = editingIndex !== null
        ? methods.map((m, i) => i === editingIndex ? newMethod : m)
        : [...methods, newMethod];

      persistMethods(next);
      syncBankFields(detail);
      setEditingIndex(null);
      toast.success(editingIndex !== null ? 'Bank Details updated' : 'Bank Details added');
    };

    const handleUpi = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const newMethod: SelectedPaymentMethod = {
        id: 'upi',
        title: 'UPI',
        value: detail.upiId,
        color: '#5f259f',
        badge: 'UPI',
      };

      const next = editingIndex !== null
        ? methods.map((m, i) => i === editingIndex ? newMethod : m)
        : [...methods, newMethod];

      persistMethods(next);
      syncUpiFields(detail);
      setEditingIndex(null);
      toast.success(editingIndex !== null ? 'UPI updated' : 'UPI added');
    };

    window.addEventListener('paymentMethod:bankDetails', handleBankDetails);
    window.addEventListener('paymentMethod:upi', handleUpi);
    return () => {
      window.removeEventListener('paymentMethod:bankDetails', handleBankDetails);
      window.removeEventListener('paymentMethod:upi', handleUpi);
    };
  }, [methods, editingIndex]);

  const handleAdd = (method: SelectedPaymentMethod) => {
    if (editingIndex !== null) {
      const next = [...methods];
      const oldMethod = next[editingIndex];
      next[editingIndex] = method;
      persistMethods(next);

      if (oldMethod?.id === 'bank-details' && method.id !== 'bank-details') clearBankFields();
      if (oldMethod?.id === 'upi' && method.id !== 'upi') clearUpiFields();
      if (method.id === 'bank-details') {
        try {
          const detail = JSON.parse(method.value);
          syncBankFields(detail);
        } catch {}
      }
      if (method.id === 'upi') {
        syncUpiFields({ upiId: method.value, showQr: true, lockAmount: false });
      }
      setEditingIndex(null);
    } else {
      const next = [...methods, method];
      persistMethods(next);
      if (method.id === 'bank-details') {
        try {
          const detail = JSON.parse(method.value);
          syncBankFields(detail);
        } catch {}
      }
      if (method.id === 'upi') {
        syncUpiFields({ upiId: method.value, showQr: true, lockAmount: false });
      }
    }
  };

  const handleRemove = (index: number) => {
    const method = methods[index];
    const next = [...methods];
    next.splice(index, 1);
    persistMethods(next);

    if (method?.id === 'bank-details') clearBankFields();
    if (method?.id === 'upi') clearUpiFields();
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setShowModal(true);
  };

  return (
    <div className="pt-4 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-neutral-100 mb-6 gap-4">
        <p className="text-2xl font-semibold">Payment Details</p>
      </div>

      <div className="space-y-3">
        <h4 className="font-bold text-sm text-ink-900 flex items-center gap-1.5">
          Payment Methods
          <span className="text-[11px] font-normal text-ink-500">(Max 3)</span>
        </h4>

        {methods.map((m, i) => (
          <div
            key={`${m.id}-${i}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-white border border-ink-200 shadow-sm"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white shrink-0 text-xs"
              style={{ backgroundColor: m.color }}
            >
              {m.badge}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900 truncate">{m.title}</p>
              <p className="text-xs text-ink-500 truncate">{m.value}</p>
            </div>
            <button
              type="button"
              onClick={() => handleEdit(i)}
              className="w-7 h-7 rounded-full bg-ink-50 flex items-center justify-center text-ink-500 hover:text-brand-600 hover:bg-brand-50 transition-colors shrink-0"
              title="Edit"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="w-7 h-7 rounded-full bg-ink-50 flex items-center justify-center text-ink-500 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {methods.length < 3 && (
          <button
            type="button"
            onClick={() => {
              setEditingIndex(null);
              setShowModal(true);
            }}
            className="w-full py-3 rounded-xl border border-dashed border-ink-300 text-ink-600 text-sm font-semibold hover:border-brand-500 hover:text-brand-600 transition-colors bg-ink-50 hover:bg-brand-50/50"
          >
            + Add Payment Method
          </button>
        )}

        <PaymentMethodModal
          open={showModal}
          onClose={() => { setShowModal(false); setEditingIndex(null); }}
          onAdd={handleAdd}
          existingCount={methods.length}
          isPremium={canUseUpiQr}
        />

        {methods.length > 0 && (
          <span className="text-xs text-ink-500 mt-1 block">
            {methods.length}/3 methods added.
          </span>
        )}
      </div>

      {/* Signature Section */}
      <div className="mt-12 pt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-neutral-100 mb-6 gap-4">
          <p className="text-2xl font-semibold">Signature</p>
        </div>

        {/* Quick Fill Signature if available for active business */}
        {activeBiz && activeBiz.signatureUrl && (
          <div className="mb-6 p-4 bg-brand-50 border border-brand-100 rounded-xl">
            <p className="text-xs font-bold text-brand-900 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-brand-500" />
              Business Profile Signature
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-brand-200">
                <img
                  src={activeBiz.signatureUrl}
                  alt="Business signature"
                  className="h-10 rounded-md object-contain"
                />
              </div>
              {signatureMode !== "default" ? (
                <button
                  type="button"
                  onClick={() => {
                    setValue("signatureMode", "default");
                    setValue("signatureUrl", activeBiz.signatureUrl);
                    if (typeof window !== "undefined") {
                      localStorage.setItem("signatureMode", "default");
                      localStorage.setItem("signatureUrl", activeBiz.signatureUrl);
                    }
                    toast.success("Applied business profile signature");
                  }}
                  className="px-4 py-2 bg-white border border-brand-200 text-brand-700 hover:bg-brand-50 text-xs font-bold rounded-lg shadow-sm transition-all"
                >
                  Use This Signature
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-brand-700 bg-brand-100 px-3 py-1.5 rounded-md">
                    ✓ Currently Applied
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setValue("signatureMode", "none");
                      if (typeof window !== "undefined") {
                        localStorage.setItem("signatureMode", "none");
                      }
                    }}
                    className="p-1.5 text-brand-600 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h4 className="font-bold text-sm text-ink-900">Custom Signature</h4>
          <div className="p-4 bg-white border border-ink-200 rounded-xl shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {customSignatureUrl ? (
                <div className="flex-1 flex items-center justify-between">
                  <div className="flex items-center gap-3 p-2 bg-ink-50 rounded-lg border border-ink-200">
                    <img
                      src={customSignatureUrl}
                      alt="Custom signature"
                      className="h-10 rounded-md object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setValue("customSignatureUrl", "");
                        if (signatureMode === "custom") {
                          setValue("signatureMode", "none");
                        }
                        if (typeof window !== "undefined") {
                          localStorage.removeItem("customSignatureUrl");
                          if (signatureMode === "custom") localStorage.setItem("signatureMode", "none");
                        }
                        toast.success("Custom signature removed");
                      }}
                      className="p-1.5 rounded-full hover:bg-red-50 text-ink-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {signatureMode !== "custom" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setValue("signatureMode", "custom");
                        if (typeof window !== "undefined") {
                          localStorage.setItem("signatureMode", "custom");
                        }
                      }}
                      className="px-4 py-2 bg-brand-500 text-white hover:bg-brand-600 text-xs font-bold rounded-lg shadow-sm transition-all"
                    >
                      Apply to Invoice
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-brand-700 bg-brand-100 px-3 py-1.5 rounded-md">
                        ✓ Currently Applied
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setValue("signatureMode", "none");
                          if (typeof window !== "undefined") {
                            localStorage.setItem("signatureMode", "none");
                          }
                        }}
                        className="p-1.5 text-ink-400 hover:text-red-500 transition-colors"
                        aria-label="Remove applied custom signature"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <label className="cursor-pointer flex-1 py-4 rounded-xl border border-dashed border-ink-300 bg-ink-50 text-ink-600 text-sm font-semibold hover:border-brand-500 hover:text-brand-600 hover:bg-brand-50/50 transition-colors flex flex-col items-center justify-center gap-2">
                  <Upload className="w-5 h-5" />
                  {uploadingCustomSig ? "Uploading..." : "Upload Signature Image"}
                  <span className="text-[10px] text-ink-400 font-normal">Transparent PNG/SVG recommended. Max 2MB.</span>
                  <input
                    ref={customSigRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleCustomSignatureUpload}
                    disabled={uploadingCustomSig}
                  />
                </label>
              )}
            </div>

            {/* Save to Business Profile (only if they uploaded a custom one) */}
            {customSignatureUrl && businesses.length > 0 && (
              <div className="mt-4 pt-4 border-t border-ink-100 flex flex-col gap-2">
                <label className="text-xs font-semibold text-ink-600">
                  Save this custom signature to a business profile?
                </label>
                <div className="flex gap-2">
                  <select
                    value={saveTargetBusinessId}
                    onChange={(e) => setSaveTargetBusinessId(e.target.value)}
                    className="flex-1 bg-white border border-ink-200 rounded-lg text-sm text-ink-900 px-3 py-2 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">-- Select Profile --</option>
                    {businesses.map((biz: any) => (
                      <option key={biz.id} value={biz.id}>
                        {biz.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSaveToProfile}
                    disabled={savingSignature || !saveTargetBusinessId}
                    className="px-4 py-2 bg-ink-900 text-white text-xs font-bold rounded-lg hover:bg-ink-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingSignature ? "Saving..." : "Save to Profile"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
