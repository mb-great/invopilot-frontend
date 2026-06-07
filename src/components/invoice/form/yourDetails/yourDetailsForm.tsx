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
  return (
    <div className="pt-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-neutral-100 mb-6 gap-4">
        <p className="text-2xl font-semibold">Your Details (From)</p>
      </div>

      <CustomTextInput
        label="Email"
        placeholder="e.g. yourname@email.com"
        variableName="yourEmail"
      />
      <p className="pb-10 pt-3 text-xs font-medium text-neutral-500">
        We&apos;ll fill the billing details automatically if we find the your.
      </p>
      <p className="pb-2 text-sm font-medium text-neutral-500">Billing details</p>
      
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
