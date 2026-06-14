"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import CustomTextInput from "@/components/invoice/ui/customTextInput";
import CustomNumberInput from "@/components/invoice/ui/customNumberInput";
import ImageInput from "@/components/invoice/ui/imageInput";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

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
  const { setValue } = useFormContext();
  const businesses = profile?.defaults?.businesses?.filter((b: any) => !b.deletedAt) || [];

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
