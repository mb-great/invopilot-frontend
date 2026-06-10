"use client";

import CustomTextInput from "@/components/invoice/ui/customTextInput";
import CustomNumberInput from "@/components/invoice/ui/customNumberInput";
import { useGetValue, useItemParams } from "@/hooks/useGetValue";
import { Controller, useFormContext } from "react-hook-form";
import { getInitialValue } from "@/lib/getInitialValue";
import { AlertCircle } from "lucide-react";
import { resolvePlanAccess } from "@/lib/billing/tiers";
import PremiumBadge from "@/components/ui/PremiumBadge";
import { toast } from "sonner";
import { useEffect } from "react";

export const PaymentDetailsForm = ({ profile }: { profile: any }) => {
  const items = useItemParams();
  const discount = useGetValue("discount", "0");
  const tax = useGetValue("tax", "0");
  const { setValue } = useFormContext();

  const subtotal = items.reduce((total: number, item: any) => {
    const quantity = item.qty ? +item.qty : 1;
    const amount = item.amount ? +item.amount : 0;
    return total + quantity * amount;
  }, 0);
  const discountAmount = subtotal - (discount ? +discount : 0);
  const taxAmount = discountAmount * ((tax ? +tax : 0) / 100);
  const totalAmount = discountAmount + taxAmount;

  const isOverLimit = totalAmount > 100000;

  const access = resolvePlanAccess(profile);
  const canUseUpiQr = access.plan.canUseUpiQr || access.isAdmin;

  // Initialize showUpiQr to true if not already set in localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("showUpiQr");
      if (stored === null) {
        localStorage.setItem("showUpiQr", "true");
        setValue("showUpiQr", true);
      }
    }
  }, [setValue]);

  return (
    <div className="pt-4">
      <p className="text-2xl font-semibold pb-3">Payment Details</p>
      <CustomTextInput
        label="Bank name"
        placeholder="HSBC"
        variableName="bankName"
      />
      <CustomTextInput
        label="Account number"
        placeholder="8920804195"
        variableName="accountNumber"
      />
      <CustomTextInput
        label="Account Name"
        placeholder="Account Name/Your Name"
        variableName="accountName"
      />
      <CustomTextInput
        label="IFSC code"
        placeholder="HSBC0560002"
        variableName="ifscCode"
      />
      <CustomTextInput
        label="Routing number"
        placeholder="0804189592"
        variableName="routingCode"
      />
      <CustomTextInput
        label="Swift code"
        placeholder="HSBCINAA123"
        variableName="swiftCode"
      />
      <CustomTextInput
        label="PayPal Email / Link"
        placeholder="paypal.me/username"
        variableName="paypalEmail"
      />
      <CustomTextInput
        label="Crypto Wallet Address"
        placeholder="0x... (ERC20)"
        variableName="cryptoAddress"
      />
      
      <div className="border-t border-ink-100 my-6 pt-6">
        <h4 className="font-bold text-sm text-ink-900 mb-4 flex items-center gap-1.5">
          UPI Payment Settings
          <PremiumBadge type="pro" />
        </h4>
        
        <CustomTextInput
          label="UPI ID"
          placeholder="yourname@upi"
          variableName="upiId"
          disabled={!canUseUpiQr}
          premium="pro"
        />

        <div className="pt-4 pb-2 space-y-4">
          <Controller
            name="showUpiQr"
            defaultValue={getInitialValue("showUpiQr", "true") === "true"}
            render={({ field: { onChange, value } }) => {
              const isChecked = canUseUpiQr ? value : false;
              return (
                <label className="flex items-start gap-3 cursor-pointer group relative">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      disabled={!canUseUpiQr}
                      checked={isChecked}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        localStorage.setItem("showUpiQr", String(checked));
                        onChange(checked);
                      }}
                      className="w-4 h-4 border-gray-300 rounded text-brand-600 focus:ring-brand-600 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-semibold flex items-center gap-1.5 ${!canUseUpiQr ? 'text-gray-400' : 'text-gray-700'}`}>
                      Generate UPI QR code on invoice
                    </span>
                    <span className="text-xs text-gray-500 mt-0.5">
                      Enable to automatically display a clickable scan-to-pay QR code on your PDF and live preview.
                    </span>
                  </div>
                  {!canUseUpiQr && (
                    <div 
                      className="absolute inset-0 z-10 cursor-not-allowed bg-transparent"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toast.error("Upgrade to Pro to enable UPI QR codes on invoices.");
                      }}
                    />
                  )}
                </label>
              );
            }}
          />

          <Controller
            name="upiLockAmount"
            defaultValue={getInitialValue("upiLockAmount", "false") === "true"}
            render={({ field: { onChange, value } }) => {
              // Force disable if over limit
              const isChecked = (isOverLimit || !canUseUpiQr) ? false : value;
              return (
                <label className="flex items-start gap-3 cursor-pointer group relative">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      disabled={isOverLimit || !canUseUpiQr}
                      checked={isChecked}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        localStorage.setItem("upiLockAmount", String(checked));
                        onChange(checked);
                      }}
                      className="w-4 h-4 border-gray-300 rounded text-brand-600 focus:ring-brand-600 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-semibold ${(!canUseUpiQr || isOverLimit) ? 'text-gray-400' : 'text-gray-700'}`}>
                      Lock invoice amount in UPI QR
                    </span>
                    <span className="text-xs text-gray-500 mt-0.5">
                      If checked, payers cannot modify the amount while scanning.
                    </span>
                    {isOverLimit && canUseUpiQr && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>UPI limit exceeded (₹1,00,000+). Amount locking disabled. QR will still work for manual entry.</span>
                      </div>
                    )}
                  </div>
                  {!canUseUpiQr && (
                    <div 
                      className="absolute inset-0 z-10 cursor-not-allowed bg-transparent"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toast.error("Upgrade to Pro to lock invoice amounts in UPI QR codes.");
                      }}
                    />
                  )}
                </label>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
};
