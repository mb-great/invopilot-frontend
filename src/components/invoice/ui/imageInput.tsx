/* eslint-disable @next/next/no-img-element */
"use client";

import { getInitialValue } from "@/lib/getInitialValue";
import { Plus, X } from "lucide-react";
import { useRef } from "react";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import PremiumBadge from "@/components/ui/PremiumBadge";

type CustomNumberProps = {
  label: string;
  variableName: string;
  premium?: 'pro' | 'biz';
};

export const ImageInput = ({ label, variableName, premium }: CustomNumberProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  const isAcceptedFileType = (file: File) => {
    return ["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type);
  };

  const compressToWebP = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === "image/svg+xml") {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read SVG file"));
        reader.readAsDataURL(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Failed to get canvas context"));
              return;
            }
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL("image/webp", 0.8);
            resolve(dataUrl);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const getBase64SizeInBytes = (base64String: string) => {
    const stringLength = base64String.length - (base64String.indexOf(",") + 1);
    return Math.ceil(stringLength * 0.75);
  };

  return (
    <Controller
      render={({ field: { onChange, value } }) => (
        <div className="flex flex-col w-full relative">
          <div
            className="flex items-center justify-between h-[52px] cursor-pointer"
            onClick={handleButtonClick}
          >
            {label && (
              <label
                htmlFor={label}
                className="block text-sm font-medium leading-6 text-gray-900 whitespace-nowrap flex items-center"
              >
                <span>{label}</span>
                {premium && <PremiumBadge type={premium} />}
              </label>
            )}
            <div className="flex items-center gap-2">
              {value ? (
                <div className="flex items-center gap-2 mr-3 relative z-10">
                  <img
                    src={value}
                    className="h-8 rounded-md p-1 hover:bg-neutral-200 object-contain"
                    alt="company logo"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange("");
                      localStorage.removeItem(variableName);
                    }}
                    className="p-1 rounded-full hover:bg-neutral-200 text-gray-500 hover:text-red-500 transition-colors"
                    title="Remove Logo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-neutral-500/70 border rounded-full p-1.5 border-dashed"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
            <input
              accept=".png, .jpg, .jpeg, .svg, .svg+xml, .webp"
              ref={inputRef}
              type="file"
              onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (file && isAcceptedFileType(file)) {
                  try {
                    const compressedUrl = await compressToWebP(file);
                    const sizeBytes = getBase64SizeInBytes(compressedUrl);
                    if (sizeBytes > 2 * 1024 * 1024) {
                      toast.error("Image too large even after compression (limit 2MB)");
                      return;
                    }
                    onChange(compressedUrl);
                    localStorage.setItem(variableName, compressedUrl);
                  } catch (err) {
                    toast.error("Failed to process image");
                    console.error(err);
                  }
                } else if (file) {
                  toast.error("Invalid file type. Please upload PNG, JPG, WEBP, or SVG");
                }
              }}
              className={`peer w-full border-0 py-1.5 text-gray-900 focus:ring-0 sm:text-sm sm:leading-6 hidden ${
                label ? "text-right" : "p-0"
              }  placeholder:text-neutral-700/40 placeholder:font-medium caret-orange-500`}
            />
            <div
              className="absolute inset-x-0 bottom-0 border-t border-gray-300 peer-hover:border-neutral-400 peer-focus:border-t peer-focus:border-orange-500 border-dashed"
              aria-hidden="true"
            />
          </div>
          <span className="text-[10px] text-neutral-400 -mt-1 pb-1">
            Recommend square or horizontal aspect ratio. Will compress to WebP (max 2MB).
          </span>
        </div>
      )}
      name={variableName}
      defaultValue={getInitialValue(variableName)}
    />
  );
};

export default ImageInput;
