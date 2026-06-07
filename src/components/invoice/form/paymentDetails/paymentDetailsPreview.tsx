"use client";

import React, { useEffect, useState } from "react";
import { currencyList } from "@/lib/currency";
import { ChevronDown } from "lucide-react";
import { useData } from "@/hooks/useData";
import QRCode from "qrcode";

export const PaymentDetailsPreview: React.FC<
  PaymentDetails & { onClick?: (step: string) => void }
> = ({
  bankName,
  accountNumber,
  accountName,
  routingCode,
  swiftCode,
  ifscCode,
  upiId,
  upiLockAmount,
  showUpiQr,
  currency = "INR",
  onClick,
}) => {
  const { companyDetails, invoiceDetails } = useData();
  const [qrUrl, setQrUrl] = useState<string>("");

  const currencyDetails = currencyList.find(
    (currencyDetail) =>
      currencyDetail.value.toLowerCase() === currency.toLowerCase()
  )?.details;

  // Calculate total amount for UPI QR code amount lock
  const subtotal = invoiceDetails.items.reduce((total: number, item: any) => {
    const quantity = item.qty ? +item.qty : 1;
    const amount = item.amount ? +item.amount : 0;
    return total + quantity * amount;
  }, 0);
  const discountAmount = subtotal - (invoiceDetails.discount ? +invoiceDetails.discount : 0);
  const taxAmount = discountAmount * ((invoiceDetails.taxRate ? +invoiceDetails.taxRate : 0) / 100);
  const totalAmount = discountAmount + taxAmount;

  // Generate UPI QR code locally using open-source qrcode library
  useEffect(() => {
    if (upiId && showUpiQr !== false) {
      let upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(companyDetails.companyName || 'Merchant')}&cu=INR`;
      if (upiLockAmount && totalAmount <= 100000) {
        upiUrl += `&am=${totalAmount.toFixed(2)}`;
      }
      
      QRCode.toDataURL(upiUrl, {
        margin: 1,
        width: 120,
        color: { dark: "#000000", light: "#ffffff" }
      })
        .then(url => setQrUrl(url))
        .catch(err => console.error("Error rendering preview QR:", err));
    } else {
      setQrUrl("");
    }
  }, [upiId, upiLockAmount, showUpiQr, totalAmount, companyDetails.companyName]);

  return (
    <div
      className={`grid grid-cols-2 relative h-full ${onClick ? 'group cursor-pointer' : 'cursor-default'}`}
      onClick={() => onClick && onClick("4")}
    >
      {!!onClick && (
        <>
          <ChevronDown className="animate-pulse w-5 h-5 text-orange-500 rotate-[135deg] group-hover:block hidden absolute top-0 left-0" />
          <ChevronDown className="animate-pulse w-5 h-5 text-orange-500 -rotate-[135deg] group-hover:block hidden absolute top-0 right-0" />
          <ChevronDown className="animate-pulse w-5 h-5 text-orange-500 rotate-45 group-hover:block hidden absolute bottom-0 left-0" />
          <ChevronDown className="animate-pulse w-5 h-5 text-orange-500 -rotate-45 group-hover:block hidden absolute bottom-0 right-0 " />
        </>
      )}
      
      {/* Left Column: Bank Details */}
      <div className="py-3 pl-5 pr-3 border-r border-neutral-100 flex flex-col justify-between">
        <div>
          <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider mb-2">
            Bank Details
          </p>
          <div className="space-y-2">
            {[
              { label: "Bank Name", value: bankName },
              { label: "Account Number", value: accountNumber },
              { label: "Account Name", value: accountName },
              { label: "Swift Code", value: swiftCode },
              ...(routingCode ? [{ label: "Routing Code", value: routingCode }] : []),
              ...(ifscCode ? [{ label: "IFSC Code", value: ifscCode }] : []),
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[8px] text-gray-400 font-semibold uppercase tracking-wider leading-none">
                  {label}
                </p>
                {value ? (
                  <p className="text-[10px] font-bold text-gray-700 leading-tight break-all mt-0.5">
                    {value}
                  </p>
                ) : (
                  <div className="rounded-[3px] bg-neutral-100 h-3 w-3/4 animate-pulse mt-0.5" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Payable In & UPI QR Code */}
      <div className="py-3 px-5 flex flex-col justify-between">
        <div>
          <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider mb-2">
            Payable in
          </p>
          {currencyDetails && (
            <div className="flex gap-2 items-center w-full">
              <currencyDetails.icon className="w-6 h-6 rounded-full flex-shrink-0" />
              <div>
                <p className="font-bold text-xs text-gray-800 leading-tight">
                  {currencyDetails.currencyName}
                </p>
                <p className="text-[9px] font-bold text-neutral-400 mt-0.5">
                  {currencyDetails.currencySymbol}{" "}
                  {currencyDetails.currencyShortForm}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* UPI QR Section */}
        {upiId && qrUrl && showUpiQr !== false && (
          <div className="mt-4 pt-4 border-t border-dashed border-neutral-100 flex flex-col items-start animate-in fade-in duration-200">
            <p className="text-[9px] text-neutral-400 font-semibold uppercase tracking-wider mb-1.5">
              Pay via UPI
            </p>
            <div className="border border-neutral-100 p-1 rounded-md bg-white shadow-sm flex items-center justify-center">
              <img src={qrUrl} alt="UPI QR Code" className="w-16 h-16 object-contain" />
            </div>
            <p className="text-[8px] font-bold text-gray-500 mt-1 uppercase tracking-tight break-all max-w-[120px]">
              {upiId}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
