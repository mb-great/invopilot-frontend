import { CompanyDetailsPreview } from "@/components/invoice/form/companyDetails/companyDetailsPreview";
import { InvoiceDetailsPreview } from "@/components/invoice/form/invoiceDetails/invoiceDetailsPreview";
import { InvoiceTermsPreview } from "@/components/invoice/form/invoiceTerms/InvoiceTermsPreview";
import { PaymentDetailsPreview } from "@/components/invoice/form/paymentDetails/paymentDetailsPreview";
import { YourDetailsPreview } from "@/components/invoice/form/yourDetails/yourDetailsPreview";
import { GeistSans } from "geist/font/sans";
import { ChevronDown } from "lucide-react";
import { useMemo } from "react";

const A4_HEIGHT = 842;
const HEADER_APPROX = 220;
const PAYMENT_APPROX = 350;
const ITEM_ROW_APPROX = 42;
const AVAILABLE_FOR_ITEMS = A4_HEIGHT - HEADER_APPROX - PAYMENT_APPROX;

export const PreviewDetails = ({
  yourDetails,
  companyDetails,
  invoiceDetails,
  paymentDetails,
  invoiceTerms,
  onClick,
}: {
  yourDetails: YourDetails;
  companyDetails: CompanyDetails;
  invoiceDetails: InvoiceItemDetails;
  paymentDetails: PaymentDetails;
  invoiceTerms: InvoiceTerms;
  onClick?: (step: string) => void;
}) => {
  const items = invoiceDetails?.items || [];

  const { needsPageBreak, splitIndex } = useMemo(() => {
    const totalItemsHeight = items.length * ITEM_ROW_APPROX;
    const totalContentHeight = HEADER_APPROX + totalItemsHeight + PAYMENT_APPROX;

    if (totalContentHeight <= A4_HEIGHT) {
      return { needsPageBreak: false, splitIndex: items.length };
    }

    let split = items.length;
    let cumulativeHeight = 0;
    for (let i = 0; i < items.length; i++) {
      cumulativeHeight += ITEM_ROW_APPROX;
      if (cumulativeHeight > AVAILABLE_FOR_ITEMS) {
        split = i;
        break;
      }
    }

    return { needsPageBreak: true, splitIndex: split };
  }, [items.length]);

  const page1Items = needsPageBreak ? items.slice(0, splitIndex) : items;
  const page2Items = needsPageBreak ? items.slice(splitIndex) : [];

  const headerSection = (
    <div>
      <InvoiceTermsPreview {...invoiceTerms} onClick={onClick} />
      <div className="border-b grid grid-cols-2 justify-between border-dashed">
        <div
          className="py-4 px-10 border-r border-dashed cursor-pointer relative group"
          onClick={() => onClick && onClick("1")}
        >
          {!!onClick && (
            <>
              <ChevronDown className="animate-pulse w-5 h-5 text-orange-500 rotate-[135deg] group-hover:block hidden absolute top-0 left-0" />
              <ChevronDown className="animate-pulse w-5 h-5 text-orange-500 -rotate-[135deg] group-hover:block hidden absolute top-0 right-0" />
              <ChevronDown className="animate-pulse w-5 h-5 text-orange-500 rotate-45 group-hover:block hidden absolute bottom-0 left-0" />
              <ChevronDown className="animate-pulse w-5 h-5 text-orange-500 -rotate-45 group-hover:block hidden absolute bottom-0 right-0 " />
            </>
          )}
          <YourDetailsPreview {...yourDetails} />
        </div>
        <div
          className="py-4 px-10 border-dashed cursor-pointer relative group"
          onClick={() => onClick && onClick("2")}
        >
          {!!onClick && (
            <>
              <ChevronDown className="animate-pulse w-5 h-5 text-orange-500 rotate-[135deg] group-hover:block hidden absolute top-0 left-0" />
              <ChevronDown className="animate-pulse w-5 h-5 text-orange-500 -rotate-[135deg] group-hover:block hidden absolute top-0 right-0" />
              <ChevronDown className="animate-pulse w-5 h-5 text-orange-500 rotate-45 group-hover:block hidden absolute bottom-0 left-0" />
              <ChevronDown className="animate-pulse w-5 h-5 text-orange-500 -rotate-45 group-hover:block hidden absolute bottom-0 right-0 " />
            </>
          )}
          <CompanyDetailsPreview {...companyDetails} />
        </div>
      </div>
    </div>
  );

  if (!needsPageBreak) {
    return (
      <div className={`overflow-x-auto ${GeistSans.className}`}>
        <div className="w-[595px] min-h-[842px] bg-white rounded-[10px] shadow-[0_0_20px_rgba(0,0,0,0.05)] origin-top-left scale-[0.55] sm:scale-75 lg:scale-100">
          {headerSection}
          <div className="flex flex-col justify-between">
            <div className="border-b justify-between border-dashed">
              <InvoiceDetailsPreview {...invoiceDetails} onClick={onClick} />
            </div>
            <div>
              <PaymentDetailsPreview {...paymentDetails} onClick={onClick} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto flex flex-col gap-3 ${GeistSans.className}`}>
      {/* Page 1 */}
      <div className="w-[595px] h-[842px] bg-white rounded-[10px] shadow-[0_0_20px_rgba(0,0,0,0.05)] flex flex-col origin-top-left scale-[0.55] sm:scale-75 lg:scale-100">
        {headerSection}
        <div className="flex-1">
          <InvoiceDetailsPreview
            {...invoiceDetails}
            overrideItems={page1Items}
            showTotals={false}
            onClick={onClick}
          />
        </div>
      </div>

      {/* Page Break Indicator */}
      <div className="flex items-center justify-center py-1">
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 border-t-2 border-dashed border-ink-200" />
          <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest shrink-0">Page 2</span>
          <div className="flex-1 border-t-2 border-dashed border-ink-200" />
        </div>
      </div>

      {/* Page 2 */}
      <div className="w-[595px] h-[842px] bg-white rounded-[10px] shadow-[0_0_20px_rgba(0,0,0,0.05)] flex flex-col origin-top-left scale-[0.55] sm:scale-75 lg:scale-100">
        <div className="flex flex-col justify-between flex-1">
          <div className="border-b justify-between border-dashed">
            <InvoiceDetailsPreview
              {...invoiceDetails}
              overrideItems={page2Items}
              isPage2
              showTotals
              onClick={onClick}
            />
          </div>
          <div>
            <PaymentDetailsPreview {...paymentDetails} onClick={onClick} />
          </div>
        </div>
      </div>
    </div>
  );
};
