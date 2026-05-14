import { CompanyDetailsPreview } from "@/components/invoice/form/companyDetails/companyDetailsPreview";
import { InvoiceDetailsPreview } from "@/components/invoice/form/invoiceDetails/invoiceDetailsPreview";
import { InvoiceTermsPreview } from "@/components/invoice/form/invoiceTerms/InvoiceTermsPreview";
import { PaymentDetailsPreview } from "@/components/invoice/form/paymentDetails/paymentDetailsPreview";
import { YourDetailsPreview } from "@/components/invoice/form/yourDetails/yourDetailsPreview";
import { ChevronDown } from "lucide-react";

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
}) => (
  <div className="w-full flex justify-center py-4 md:py-8">
    <div className="w-full max-w-3xl aspect-[1/1.414] bg-white shadow-2xl rounded-sm border border-ink-100 flex flex-col overflow-hidden">
      {/* Header section */}
      <div className="border-b grid grid-cols-2 border-ink-100">
        <div
          className="py-6 px-8 border-r border-ink-100 cursor-pointer relative group transition-colors hover:bg-brand-50/30"
          onClick={() => onClick && onClick("1")}
        >
          {!!onClick && (
            <div className="absolute inset-0 border-2 border-dashed border-brand-500/0 group-hover:border-brand-500/20 transition-all pointer-events-none" />
          )}
          <YourDetailsPreview {...yourDetails} />
        </div>
        <div
          className="py-6 px-8 cursor-pointer relative group transition-colors hover:bg-brand-50/30"
          onClick={() => onClick && onClick("2")}
        >
          {!!onClick && (
            <div className="absolute inset-0 border-2 border-dashed border-brand-500/0 group-hover:border-brand-500/20 transition-all pointer-events-none" />
          )}
          <CompanyDetailsPreview {...companyDetails} />
        </div>
      </div>
      
      {/* Items Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="border-b border-ink-100">
          <InvoiceDetailsPreview {...invoiceDetails} onClick={onClick} />
        </div>
        
        {/* Footer Section */}
        <div className="mt-auto grid grid-cols-2 border-t border-ink-100">
          <div className="border-r border-ink-100 bg-white">
            <PaymentDetailsPreview {...paymentDetails} onClick={onClick} />
          </div>
          <div className="bg-ink-50/30">
            <InvoiceTermsPreview {...invoiceTerms} onClick={onClick} />
          </div>
        </div>
      </div>
    </div>
  </div>
);
