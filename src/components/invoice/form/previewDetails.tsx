import { CompanyDetailsPreview } from "@/components/invoice/form/companyDetails/companyDetailsPreview";
import { InvoiceDetailsPreview } from "@/components/invoice/form/invoiceDetails/invoiceDetailsPreview";
import { InvoiceTermsPreview } from "@/components/invoice/form/invoiceTerms/InvoiceTermsPreview";
import { PaymentDetailsPreview } from "@/components/invoice/form/paymentDetails/paymentDetailsPreview";
import { YourDetailsPreview } from "@/components/invoice/form/yourDetails/yourDetailsPreview";
import { GeistSans } from "geist/font/sans";
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
  <div className={`overflow-x-auto ${GeistSans.className}`}>
    <div className="w-[595px] h-[842px] bg-white rounded-[10px] shadow-[0_0_20px_rgba(0,0,0,0.05)] justify-center items-center">
      <InvoiceTermsPreview {...invoiceTerms} onClick={onClick} />
      <div className="border-b  grid grid-cols-2 justify-between border-dashed">
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
      <div className="flex flex-col justify-between">
        <div className="border-b justify-between border-dashed">
          <InvoiceDetailsPreview {...invoiceDetails} onClick={onClick} />
        </div>
        <div className="">
          <PaymentDetailsPreview {...paymentDetails} onClick={onClick} />
        </div>
      </div>
    </div>
  </div>
);
