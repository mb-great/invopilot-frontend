import CustomTextInput from "@/components/invoice/ui/customTextInput";
import CustomNumberInput from "@/components/invoice/ui/customNumberInput";
import ImageInput from "@/components/invoice/ui/imageInput";

export const CompanyDetailsForm = ({ canUploadLogo = false }: { canUploadLogo?: boolean }) => (
  <div className="pt-4">
    <p className="text-2xl font-semibold pb-3">Company Details (To)</p>
    <CustomTextInput
      label="Email"
      placeholder="e.g. yourname@email.com"
      variableName="email"
    />
    <p className="pb-10 pt-3 text-xs font-medium text-neutral-500">
      We&apos;ll fill the billing details automatically if we find the company.
    </p>
    <p className="pb-2 text-sm font-medium text-neutral-500">Billing details</p>
    <CustomTextInput
      label="Company name"
      placeholder="Invopilot"
      variableName="companyName"
    />
    <ImageInput label="Logo" variableName="companyLogo" premium="pro" locked={!canUploadLogo} />
    <CustomTextInput
      label="Address"
      placeholder="Address"
      variableName="companyAddress"
    />
    <CustomTextInput
      label="City"
      placeholder="City"
      variableName="companyCity"
    />
    <CustomTextInput
      label="State"
      placeholder="State"
      variableName="companyState"
    />
    <CustomTextInput
      label="Zip"
      placeholder="E.g. '110001'"
      variableName="companyZip"
    />
    <CustomTextInput
      label="Country"
      placeholder="India"
      variableName="companyCountry"
    />
    <CustomTextInput
      label="Tax ID"
      placeholder="GSTIN 1234"
      variableName="companyTaxId"
    />
  </div>
);
