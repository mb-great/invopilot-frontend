"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  limitType: "invoice" | "storage";
  used?: number;
  max?: number;
}

const PRO_FEATURES = [
  "Unlimited invoices, every month",
  "Add your logo & brand colours",
  "Priority PDF generation",
  "Quote to Invoice in 1 click",
  "CSV / Excel export",
];

export default function UpgradeLimitModal({
  isOpen,
  onClose,
  limitType,
  used,
  max,
}: Props) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    router.push("/pricing");
  };

  const title =
    limitType === "invoice"
      ? `You've used all ${max ?? 5} free invoices`
      : "Storage limit reached";

  const subtitle =
    limitType === "invoice"
      ? "Your invoice is built and ready — but it's locked. Upgrade now to download it instantly and keep your billing moving."
      : `You've used all ${(used ?? 0 / (1024 * 1024)).toFixed(0)}MB of your ${max ?? 50}MB storage. Upgrade for more space.`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-ink-500" />
        </button>

        <div className="p-8 text-center">
          <div className="w-14 h-14 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>

          <h2 className="text-2xl font-bold text-ink-900 mb-3 leading-tight">
            {title}
          </h2>

          <p className="text-ink-500 text-sm leading-relaxed mb-6 max-w-sm mx-auto">
            {subtitle}
          </p>

          <ul className="text-left space-y-3 mb-8 max-w-xs mx-auto">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
                <span className="text-sm text-ink-700">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mb-6">
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-ink-900">$5</span>
              <span className="text-ink-500 text-sm">/month</span>
            </div>
            <p className="text-brand-600 text-sm font-medium mt-1">
              That&apos;s $0.16/day — less than a coffee per day.
            </p>
          </div>

          <button
            onClick={handleUpgrade}
            className="w-full py-3.5 bg-brand-500 hover:bg-brand-600 text-white font-bold rounded-xl transition-colors text-base shadow-lg shadow-brand-500/20"
          >
            Get Started with InvoPilot Pro
          </button>

          <p className="text-ink-400 text-xs mt-3">
            Cancel anytime · No long-term lock-in
          </p>
        </div>
      </div>
    </div>
  );
}
