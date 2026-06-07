"use client";

import { Input } from "@/components/invoice/ui/input";
import { getInitialValue } from "@/lib/getInitialValue";
import { Controller } from "react-hook-form";
import PremiumBadge from "@/components/ui/PremiumBadge";
import { toast } from "sonner";

type CustomInputProps = {
  label?: string;
  placeholder: string;
  variableName: string;
  disabled?: boolean;
  premium?: 'pro' | 'biz';
};

const CustomTextInput = ({
  label,
  placeholder,
  variableName,
  disabled,
  premium,
}: CustomInputProps) => (
  <Controller
    render={({ field: { onChange, value } }) => (
      <div className="relative w-full">
        <Input
          label={
            label ? (
              <span className="flex items-center gap-1.5">
                <span>{label}</span>
                {premium && <PremiumBadge type={premium} />}
              </span>
            ) as any : undefined
          }
          placeholder={placeholder}
          value={value || ''}
          type="text"
          disabled={disabled}
          onChange={(e) => {
            const updatedValue = e.target.value;
            localStorage.setItem(variableName, updatedValue);
            onChange(updatedValue);
          }}
        />
        {disabled && (
          <div 
            className="absolute inset-0 z-20 cursor-not-allowed bg-neutral-50/10"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toast.error(`Upgrade to ${premium === 'pro' ? 'Pro' : 'Business'} to unlock this premium field.`);
            }}
            title={`Upgrade to ${premium === 'pro' ? 'Pro' : 'Business'} required`}
          />
        )}
      </div>
    )}
    name={variableName}
    defaultValue={getInitialValue(variableName)}
  />
);

export default CustomTextInput;
