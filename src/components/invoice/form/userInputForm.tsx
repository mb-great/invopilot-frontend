"use client";

import { YourDetailsForm } from "@/components/invoice/form/yourDetails/yourDetailsForm";
import { CompanyDetailsForm } from "@/components/invoice/form/companyDetails/companyDetailsForm";
import { InvoiceDetailsForm } from "@/components/invoice/form/invoiceDetails/invoiceDetailsForm";
import { PaymentDetailsForm } from "@/components/invoice/form/paymentDetails/paymentDetailsForm";
import { InvoiceTermsForm } from "@/components/invoice/form/invoiceTerms/invoiceTermsForm";
import { useGetValue } from "@/hooks/useGetValue";
import { getInitialValue } from "@/lib/getInitialValue";

export const UserInputForm = () => {
  const step = useGetValue("step", getInitialValue("step", "1"));

  return (
    <div>
      <div className={step === "1" ? "block" : "hidden"}>
        <YourDetailsForm />
      </div>
      <div className={step === "2" ? "block" : "hidden"}>
        <CompanyDetailsForm />
      </div>
      <div className={step === "3" ? "block" : "hidden"}>
        <InvoiceDetailsForm />
      </div>
      <div className={step === "4" ? "block" : "hidden"}>
        <PaymentDetailsForm />
      </div>
      <div className={step === "5" ? "block" : "hidden"}>
        <InvoiceTermsForm />
      </div>
    </div>
  );
};
