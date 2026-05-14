import CustomTextInput from "@/components/invoice/ui/customTextInput";
import CustomNumberInput from "@/components/invoice/ui/customNumberInput";

export const PaymentDetailsForm = () => (
  <div className="pt-24">
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
    <CustomNumberInput
      label="Swift code"
      placeholder="HSBCINAA123"
      variableName="swiftCode"
    />
  </div>
);
