import { useFormContext, useWatch } from "react-hook-form";

export const useGetValue = (
  variableName: string,
  defaultValue?: string
): string => {
  const { control } = useFormContext();
  const value = useWatch({
    control,
    name: variableName,
    defaultValue: defaultValue ?? "",
  });
  return value;
};

export const useItemParams = (): any[] => {
  const { control } = useFormContext();
  const value = useWatch({
    control,
    name: "items",
    defaultValue: [],
  });
  return value;
};
