import React, { useEffect, useState, useMemo } from "react";
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
  paypalEmail,
  cryptoAddress,
  upiId,
  upiLockAmount,
  showUpiQr,
  currency = "INR",
  selectedMethods,
  onClick,
}) => {
  const { companyDetails, invoiceDetails } = useData();
  const [qrUrl, setQrUrl] = useState<string>("");
  const [methodQrs, setMethodQrs] = useState<Record<number, string>>({});

  const filteredMethods = useMemo(() => {
    return (selectedMethods || []).filter((m: any) => {
      const type = (m.type || m.id || '').toLowerCase();
      return type !== 'bank-details' && type !== 'bank';
    });
  }, [selectedMethods]);

  const currencyDetails = currencyList.find(
    (currencyDetails) =>
      currencyDetails.value.toLowerCase() === currency.toLowerCase()
  )?.details;

  // Calculate total amount for UPI QR code amount lock
  const subtotal = invoiceDetails?.items?.reduce((total: number, item: any) => {
    const quantity = item.qty ? +item.qty : 1;
    const amount = item.amount ? +item.amount : 0;
    return total + quantity * amount;
  }, 0) || 0;
  const discountAmount = subtotal - (invoiceDetails?.discount ? +invoiceDetails.discount : 0);
  const taxAmount = discountAmount * ((invoiceDetails?.taxRate ? +invoiceDetails.taxRate : 0) / 100);
  const totalAmount = discountAmount + taxAmount;

  useEffect(() => {
    if (upiId && showUpiQr !== false) {
      let upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(companyDetails?.companyName || 'Merchant')}&cu=INR`;
      if (upiLockAmount && totalAmount <= 100000) {
        upiUrl += `&am=${totalAmount.toFixed(2)}`;
      }
      QRCode.toDataURL(upiUrl, { margin: 1, width: 120, color: { dark: "#000000", light: "#ffffff" } })
        .then(url => setQrUrl(url))
        .catch(err => console.error("Error rendering QR:", err));
    } else {
      setQrUrl("");
    }
  }, [upiId, upiLockAmount, showUpiQr, totalAmount, companyDetails?.companyName]);

  useEffect(() => {
    filteredMethods.forEach((method: any, idx: number) => {
      if (method.qrBase64) {
        setMethodQrs(prev => ({ ...prev, [idx]: method.qrBase64 }));
      } else if (method.details && !method.qrBase64) {
        let payUrl = method.details;
        if (method.type === 'phonepe' || method.type === 'gpay' || method.type === 'paytm') {
          payUrl = `upi://pay?pa=${method.details}&pn=${encodeURIComponent(companyDetails?.companyName || 'Merchant')}&cu=INR`;
          if (totalAmount <= 100000) payUrl += `&am=${totalAmount.toFixed(2)}`;
        }
        QRCode.toDataURL(payUrl, { margin: 1, width: 120, color: { dark: "#000000", light: "#ffffff" } })
          .then(url => setMethodQrs(prev => ({ ...prev, [idx]: url })))
          .catch(() => {});
      }
    });
  }, [filteredMethods, totalAmount, companyDetails?.companyName]);

  return (
    <div
      className="grid grid-cols-2 group cursor-pointer relative"
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
      <div className="py-4 pl-10 pr-3">
        <p className="text-[11px] text-neutral-400 font-medium uppercase mb-3">
          Bank Details
        </p>
        <div className="space-y-1">
          <div className="grid grid-cols-2 items-center">
            <p className="truncate text-xs font-medium text-gray-500">
              Bank Name
            </p>
            {bankName ? (
              <p className="flex truncate text-xs font-medium text-gray-600">
                {bankName}
              </p>
            ) : (
              <div className="rounded-[3.5px] bg-neutral-100 h-4 w-full animate-pulse" />
            )}
          </div>
          <div className="mb-2 grid grid-cols-2 items-center">
            <p className="truncate text-xs font-medium text-gray-500">
              Account Number
            </p>
            {accountNumber ? (
              <p className="flex truncate text-xs font-medium text-gray-600">
                {accountNumber}
              </p>
            ) : (
              <div className="rounded-[3.5px] bg-neutral-100 h-4 w-full animate-pulse" />
            )}
          </div>
          <div className="mb-2 grid grid-cols-2 items-center">
            <p className="truncate text-xs font-medium text-gray-500">
              Account Name
            </p>
            {accountName ? (
              <p className="flex truncate text-xs font-medium text-gray-600">
                {accountName}
              </p>
            ) : (
              <div className="rounded-[3.5px] bg-neutral-100 h-4 w-full animate-pulse" />
            )}
          </div>
          <div className="mb-2 grid grid-cols-2 items-center">
            <p className="truncate text-xs font-medium text-gray-500">
              Swift Code
            </p>
            {swiftCode ? (
              <p className="flex truncate text-xs font-medium text-gray-600">
                {swiftCode}
              </p>
            ) : (
              <div className="rounded-[3.5px] bg-neutral-100 h-4 w-full animate-pulse" />
            )}
          </div>
          {routingCode && (
            <div className="mb-2 grid grid-cols-2 items-center">
              <p className="truncate text-xs font-medium text-gray-500">
                Routing Code
              </p>
              <p className="flex truncate text-xs font-medium text-gray-600">
                {routingCode}
              </p>
            </div>
          )}
          {ifscCode && (
            <div className="mb-2 grid grid-cols-2 items-center">
              <p className="truncate text-xs font-medium text-gray-500">
                IFSC Code
              </p>
              <p className="flex truncate text-xs font-medium text-gray-600">
                {ifscCode}
              </p>
            </div>
          )}
        </div>
        {/* Selected Payment Methods (Middle) */}
        {filteredMethods.length > 0 && (
          <div className="mt-4 pt-4 border-t border-dashed border-neutral-200 flex flex-col gap-3 animate-in fade-in duration-200">
            {filteredMethods.map((method: any, idx: number) => (
              <div key={idx} className="flex items-start justify-between gap-2">
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider mb-1">
                    Pay via {method.title || method.type}
                  </p>
                  <p className="text-[11px] font-medium text-gray-600 leading-tight break-all">
                    {method.details}
                  </p>
                </div>
                {methodQrs[idx] && (
                  <div className="flex flex-col items-center flex-shrink-0">
                    <img src={methodQrs[idx]} alt={`${method.title} QR`} className="w-14 h-14 object-contain" />
                    <p className="text-[7px] font-bold text-gray-400 mt-0.5 uppercase tracking-tight">{method.title}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* UPI QR Section (Bottom) */}
        {upiId?.trim() && qrUrl && showUpiQr !== false && (
          <div className="mt-4 pt-4 border-t border-dashed border-neutral-200 flex flex-col items-start animate-in fade-in duration-200">
            <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider mb-2">
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
      <div className="py-4 px-10">
        <p className="text-[11px] text-neutral-400 font-medium uppercase mb-3">
          Payable in
        </p>
        {currencyDetails && (
          <div className="flex gap-2 justify-between items-center w-full">
            <div className="flex gap-3 items-center">
              <currencyDetails.icon className="w-8 h-8 rounded-full" />
              <div>
                <p className="font-medium text-sm">
                  {currencyDetails.currencyName}
                </p>
                <p className="text-xxs text-neutral-400">
                  {currencyDetails.currencySymbol}{" "}
                  {currencyDetails.currencyShortForm}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
