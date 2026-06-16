"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

export default function InviteUserForm() {
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState("pro");
  const [duration, setDuration] = useState("1_month");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      setSuccessData(null);

      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, tier, duration }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to invite user");
      }

      toast.success("User invited and tier pre-granted successfully!");
      setSuccessData(json.data);
      setEmail("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6 bg-white border border-ink-100 shadow-sm rounded-xl">
      <h3 className="font-bold text-xl text-ink-900 mb-4 flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-brand-500" />
        Invite & Grant Tier
      </h3>
      <p className="text-xs text-ink-500 mb-4">
        Invites a new user via email and pre-grants them a subscription tier immediately.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-ink-500 uppercase tracking-wider mb-1">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="w-full bg-white border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition-all"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-ink-500 uppercase tracking-wider mb-1">
              Tier Plan
            </label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="w-full bg-white border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition-all"
            >
              <option value="pro">Pro Plan</option>
              <option value="enterprise">Enterprise Plan</option>
              <option value="free">Free Plan</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-500 uppercase tracking-wider mb-1">
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full bg-white border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 transition-all"
            >
              <option value="1_month">1 Month</option>
              <option value="1_year">1 Year</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
        >
          {loading ? "Sending Invitation..." : "Invite & Grant Tier"}
        </button>
      </form>

      {successData && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs space-y-1.5 text-emerald-800 animate-in fade-in duration-200">
          <p className="font-semibold">Success Details:</p>
          <p>
            <span className="font-medium text-emerald-600">User ID:</span> {successData.userId}
          </p>
          <p>
            <span className="font-medium text-emerald-600">Email:</span> {successData.email}
          </p>
          <p>
            <span className="font-medium text-emerald-600">Tier:</span> {successData.tier}
          </p>
          <p>
            <span className="font-medium text-emerald-600">Expires:</span>{" "}
            {new Date(successData.expiresAt).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}
