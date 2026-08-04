import { BetaLoginForm } from "@/components/auth/BetaLoginForm";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claim Your Invoice — InvoPilot Beta",
  description: "One click to save your invoice and access your InvoPilot dashboard.",
};

export default async function BetaLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const resolvedParams = await searchParams;
  const token = resolvedParams?.token;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between items-center py-12 px-4">
      {/* Header Brand Mark */}
      <div className="flex items-center gap-2.5">
        <img src="/logo.webp" alt="InvoPilot Logo" className="w-8 h-8 object-contain drop-shadow-sm" />
        <span className="font-bold text-slate-900 text-lg tracking-tight">InvoPilot</span>
      </div>

      {/* Main Card Container */}
      <div className="w-full flex justify-center my-auto">
        <BetaLoginForm token={token} />
      </div>

      {/* Footer */}
      <div className="text-xs text-slate-400 font-medium">
        © {new Date().getFullYear()} InvoPilot. All rights reserved.
      </div>
    </div>
  );
}
