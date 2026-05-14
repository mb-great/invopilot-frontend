import CustomTextInput from "@/components/invoice/ui/customTextInput";
import CustomNumberInput from "@/components/invoice/ui/customNumberInput";
import ImageInput from "@/components/invoice/ui/imageInput";

export const YourDetailsForm = () => (
  <div className="pt-24">
    <p className="text-2xl font-semibold pb-3">Your Details (From)</p>
    <CustomTextInput
      label="Email"
      placeholder="e.g. yourname@email.com"
      variableName="yourEmail"
    />
    <p className="pb-10 pt-3 text-xs font-medium text-neutral-500">
      We&apos;ll fill the billing details automatically if we find the your.
    </p>
    <p className="pb-2 text-sm font-medium text-neutral-500">Billing details</p>
    <CustomTextInput
      label="Your Name"
      placeholder="Name"
      variableName="yourName"
    />
    <ImageInput label="Logo" variableName="yourLogo" />
    <CustomTextInput
      label="Address"
      placeholder="Address"
      variableName="yourAddress"
    />
    <CustomTextInput
      label="City"
      placeholder="City"
      variableName="yourCity"
    />
    <CustomTextInput
      label="State"
      placeholder="State"
      variableName="yourState"
    />
    <CustomNumberInput
      label="Zip"
      placeholder="E.g. '110001'"
      variableName="yourZip"
    />
    <CustomTextInput
      label="Country"
      placeholder="India"
      variableName="yourCountry"
    />
    <CustomTextInput
      label="Tax ID"
      placeholder="GSTIN 1234"
      variableName="yourTaxId"
    />
  </div>
);
