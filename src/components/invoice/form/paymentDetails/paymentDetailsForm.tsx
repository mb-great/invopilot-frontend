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
import { useEffect, useState } from "react";
import PaymentMethodModal, { SelectedPaymentMethod } from "./PaymentMethodModal";

export const PaymentDetailsForm = ({ profile }: { profile: any }) => {
  const items = useItemParams();
  const discount = useGetValue("discount", "0");
  const tax = useGetValue("tax", "0");
  const { setValue } = useFormContext();
  const [showModal, setshowModal] = useState(false);

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

      {/* UPI Section — grouped together */}
      <div className="border-t border-ink-100 my-6 pt-6">
        <h4 className="font-bold text-sm text-ink-900 mb-4 flex items-center gap-1.5">
          UPI Payment
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
                      Display a scan-to-pay QR code on your PDF.
                    </span>
                  </div>
                  {!canUseUpiQr && (
                    <div 
                      className="absolute inset-0 z-10 cursor-not-allowed bg-transparent"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toast.error("Upgrade to Pro to enable UPI QR codes.");
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
                      Payers cannot modify the amount while scanning.
                    </span>
                    {isOverLimit && canUseUpiQr && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>UPI limit exceeded (₹1,00,000+). Amount locking disabled.</span>
                      </div>
                    )}
                  </div>
                  {!canUseUpiQr && (
                    <div 
                      className="absolute inset-0 z-10 cursor-not-allowed bg-transparent"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toast.error("Upgrade to Pro to lock UPI amounts.");
                      }}
                    />
                  )}
                </label>
              );
            }}
          />
        </div>
      </div>

      {/* Other Payment Methods */}
      <div className="border-t border-ink-100 my-6 pt-6">
        <h4 className="font-bold text-sm text-ink-900 mb-4 flex items-center gap-1.5">
          Other Payment Methods (Max 2)
        </h4>
        <Controller
          name="selectedMethods"
          defaultValue={JSON.parse(getInitialValue("selectedMethods", "[]"))}
          render={({ field: { onChange, value } }) => {
            const methods: SelectedPaymentMethod[] = Array.isArray(value) ? value : [];
            const handleAdd = (method: SelectedPaymentMethod) => {
              const next = [...methods, method];
              onChange(next);
              localStorage.setItem("selectedMethods", JSON.stringify(next));
            };
            const handleRemove = (index: number) => {
              const next = [...methods];
              next.splice(index, 1);
              onChange(next);
              localStorage.setItem("selectedMethods", JSON.stringify(next));
            };

            return (
              <div className="space-y-3">
                {methods.map((m, i) => (
                  <div
                    key={`${m.id}-${i}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#161618] border border-[#262629]"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white shrink-0 text-xs"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.badge}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#f4f4f5] truncate">{m.title}</p>
                      <p className="text-xs text-[#8b8b91] truncate">{m.value}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(i)}
                      className="w-7 h-7 rounded-full bg-[#262629] flex items-center justify-center text-[#8b8b91] hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                    >
                      <span className="text-xs font-bold">×</span>
                    </button>
                  </div>
                ))}
                {methods.length < 2 && (
                  <button
                    type="button"
                    onClick={() => setshowModal(true)}
                    className="w-full py-3 rounded-xl border border-dashed border-[#3a3a3e] text-[#8b8b91] text-sm font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
                  >
                    + Add payment method
                  </button>
                )}
                <PaymentMethodModal
                  open={showModal}
                  onClose={() => setshowModal(false)}
                  onAdd={handleAdd}
                  existingCount={methods.length}
                />
              </div>
            );
          }}
        />
        <span className="text-xs text-gray-500 mt-2 block">
          These methods will be displayed below your Bank Details. Min 1, Max 2 recommended.
        </span>
      </div>
    </div>
  );
};
