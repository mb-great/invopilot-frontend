"use client";

import { useEffect, useState, useRef } from "react";
import { useFormContext, Controller, useWatch } from "react-hook-form";
import CustomTextInput from "@/components/invoice/ui/customTextInput";
import CustomNumberInput from "@/components/invoice/ui/customNumberInput";
import ImageInput from "@/components/invoice/ui/imageInput";
import { toast } from "sonner";
import { Sparkles, Upload, X } from "lucide-react";

type BusinessProfile = {
  id: string;
  name: string;
  logoUrl?: string;
  signatureUrl?: string;
  methods?: any[];
  email?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  deletedAt?: string;
};

export const YourDetailsForm = ({ profile }: { profile: any }) => {
  const { setValue, control } = useFormContext();
  const businesses = profile?.defaults?.businesses?.filter((b: any) => !b.deletedAt) || [];
  const signatureMode = useWatch({ control, name: "signatureMode" });
  const useCustomSignature = signatureMode === "custom";

  const handleImportBusiness = (biz: BusinessProfile) => {
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
      { formField: "signatureUrl", val: biz.signatureUrl || "" },
      { formField: "bankName", val: biz.bankName || "" },
      { formField: "accountNumber", val: biz.accountNo || "" },
      { formField: "ifscCode", val: biz.ifsc || "" },
    ];

    // Handle methods array directly (not a simple string mapping)
    setValue("availableMethods", biz.methods || []);
    // Pre-select up to 2 methods automatically
    const defaultSelected = (biz.methods || []).slice(0, 2);
    setValue("selectedMethods", defaultSelected);
    if (typeof window !== "undefined") {
      localStorage.setItem("availableMethods", JSON.stringify(biz.methods || []));
      localStorage.setItem("selectedMethods", JSON.stringify(defaultSelected));
    }

    mappings.forEach(({ formField, val }) => {
      setValue(formField, val);
      if (typeof window !== "undefined") {
        if (val) localStorage.setItem(formField, val);
        else localStorage.removeItem(formField);
      }
    });
    toast.success(`Loaded profile "${biz.name}"`);
  };

  const customSigRef = useRef<HTMLInputElement>(null);
  const [uploadingCustomSig, setUploadingCustomSig] = useState(false);

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
      toast.success("Custom signature uploaded");
    } catch (err: unknown) {
      toast.error("Failed to upload signature: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingCustomSig(false);
      if (customSigRef.current) customSigRef.current.value = "";
    }
  };

  return (
    <div className="pt-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-neutral-100 mb-6 gap-4">
        <p className="text-2xl font-semibold">Your Details (From)</p>
      </div>

      {businesses.length > 0 && (
        <div className="mb-8 p-4 bg-brand-50 border border-brand-100 rounded-xl">
          <p className="text-xs font-bold text-brand-900 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-brand-500" />
            Quick Fill Profile
          </p>
          <div className="flex flex-wrap gap-2">
            {businesses.map((biz: BusinessProfile) => (
              <button
                key={biz.id}
                onClick={() => handleImportBusiness(biz)}
                className="px-3 py-1.5 bg-white border border-brand-200 text-brand-700 hover:bg-brand-50 hover:border-brand-300 text-xs font-bold rounded-lg transition-all shadow-sm"
              >
                {biz.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <CustomTextInput
        label="Email"
        placeholder="e.g. yourname@email.com"
        variableName="yourEmail"
      />
      
      <p className="pb-2 text-sm font-medium text-neutral-500 mt-6">Billing details</p>
      
      <CustomTextInput
        label="Your Name"
        placeholder="Name"
        variableName="yourName"
      />
      
      <ImageInput label="Logo" variableName="yourLogo" premium="pro" />

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-900 mb-2">Signature</p>
        <Controller
          name="signatureMode"
          defaultValue="default"
          render={({ field: { onChange, value } }) => (
            <div className="flex flex-col gap-2">
              {[
                { val: "default", label: "Use default signature (from business profile)" },
                { val: "custom", label: "Use custom signature for this invoice" },
                { val: "none", label: "No signature" },
              ].map((opt) => (
                <label key={opt.val} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="signatureMode"
                    value={opt.val}
                    checked={value === opt.val}
                    onChange={() => {
                      onChange(opt.val);
                      if (opt.val !== "custom") setValue("customSignatureUrl", "");
                    }}
                    className="w-4 h-4 border-neutral-300 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
          )}
        />
      </div>

      {useCustomSignature && (
        <Controller
          name="customSignatureUrl"
          defaultValue=""
          render={({ field: { onChange, value: sigValue } }) => (
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                {sigValue ? (
                  <div className="flex items-center gap-2">
                    <img src={sigValue} alt="Custom signature" className="h-10 rounded-md border border-neutral-200 object-contain" />
                    <button
                      type="button"
                      onClick={() => { onChange(""); localStorage.removeItem("customSignatureUrl"); }}
                      className="p-1 rounded-full hover:bg-neutral-200 text-gray-500 hover:text-red-500 transition-colors"
                      title="Remove signature"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer text-xs font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingCustomSig ? "UPLOADING..." : "UPLOAD SIGNATURE"}
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
              <span className="text-[10px] text-neutral-400">Transparent PNG recommended. Max 2MB.</span>
            </div>
          )}
        />
      )}

      <CustomTextInput
        label="Address"
        placeholder="Address"
        variableName="yourAddress"
      />
      <CustomTextInput
        label="City"
        placeholder="City"
        variableName="yourCity"
      />
      <CustomTextInput
        label="State"
        placeholder="State"
        variableName="yourState"
      />
      <CustomTextInput
        label="Zip"
        placeholder="E.g. '110001'"
        variableName="yourZip"
      />
      <CustomTextInput
        label="Country"
        placeholder="India"
        variableName="yourCountry"
      />
      <CustomTextInput
        label="Tax ID"
        placeholder="GSTIN 1234"
        variableName="yourTaxId"
      />
    </div>
  );
};
