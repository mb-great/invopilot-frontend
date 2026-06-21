"use client";
import CustomTextInput from "@/components/invoice/ui/customTextInput";
import DateInput from "@/components/invoice/ui/dateInput";

export const InvoiceTermsForm = () => (
  <div className="pt-4">
    <p className="text-2xl font-semibold pb-3">Invoice terms</p>
    <CustomTextInput
      label="Invoice number"
      placeholder="INVOICE-01"
      variableName="invoiceNo"
    />
    <DateInput label="Issue date" variableName="issueDate" />
    <DateInput label="Due date" variableName="dueDate" />
  </div>
);
