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
  locked?: boolean;
};

export const ImageInput = ({ label, variableName, premium, locked }: CustomNumberProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    if (locked) {
      toast.error("Logo upload requires Pro plan. Upgrade at /pricing");
      return;
    }
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  const isAcceptedFileType = (file: File) => {
    return ["image/png", "image/jpeg", "image/svg+xml", "image/webp"].includes(file.type);
  };

  const compressAndResizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;
            const maxSize = 500;
            
            if (width > maxSize || height > maxSize) {
              if (width > height) {
                height = Math.round((height * maxSize) / width);
                width = maxSize;
              } else {
                width = Math.round((width * maxSize) / height);
                height = maxSize;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Failed to get canvas context"));
              return;
            }
            
            // Draw image. Transparency is preserved automatically.
            ctx.drawImage(img, 0, 0, width, height);
            
            // Output as WebP to save space in JSONB.
            // The backend PDF worker will convert it back to PNG for React-PDF.
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
                  {!locked && (
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
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className={`border rounded-full p-1.5 border-dashed ${
                    locked ? 'text-neutral-300 cursor-not-allowed' : 'text-neutral-500/70'
                  }`}
                  disabled={locked}
                >
                  {locked ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>
            <input
              accept=".png, .jpg, .jpeg, .svg, .svg+xml, .webp"
              ref={inputRef}
              type="file"
              disabled={locked}
              onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (file && isAcceptedFileType(file)) {
                  try {
                    const compressedUrl = await compressAndResizeImage(file);
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
          <span className={`text-[10px] -mt-1 pb-1 ${locked ? 'text-amber-500 font-medium' : 'text-neutral-400'}`}>
            {locked ? 'Upgrade to Pro to add logo' : 'Recommend square or horizontal aspect ratio. Will compress to WebP (max 2MB).'}
          </span>
        </div>
      )}
      name={variableName}
      defaultValue={getInitialValue(variableName)}
    />
  );
};

export default ImageInput;
