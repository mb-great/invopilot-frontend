"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { track, identifyUser } from "@/lib/track";
import { shouldFireSignupCompleted, markSignupFired } from "@/lib/tracking/signupOnce";

/**
 * Funnel analytics: closes the loop at signup (ADR-032).
 *
 * MUST be client-side. The anon_id lives in a browser cookie, so running this
 * from the OAuth callback route handler (src/app/api/auth/callback/route.ts)
 * would silently join nothing — that server route cannot see it.
 *
 * Note: `signup_started` is deliberately NOT fired here. It is emitted by
 * invopilot-old at the moment of redirect, because that is where the
 * funnel_token exists — the token is the fallback join key for when the
 * cross-domain cookie is blocked. Firing it here too would double-count.
 */
export function AnalyticsAuthListener() {
  useEffect(() => {
    const supabase = createClient();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" || !session?.user) return;

      // The claim token, when this login came from the beta funnel.
      let funnelToken: string | null = null;
      try {
        const params = new URLSearchParams(window.location.search);
        funnelToken = params.get("claim") || params.get("token");
      } catch {
        /* ignore */
      }

      // Always link the anonymous trail to the account — that join is not a
      // signup event and is safe to repeat.
      identifyUser(session.access_token, funnelToken);

      // signup_completed is the *creation* of an account, not a sign-in.
      // Supabase emits SIGNED_IN on every page load, so this must be bounded by
      // the account's age and a persisted per-user flag. The previous useRef
      // guard reset on every mount, which is why one account recorded three.
      if (!shouldFireSignupCompleted({ userId: session.user.id, createdAt: session.user.created_at })) return;

      markSignupFired(session.user.id);
      track("signup_completed", {}, funnelToken);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}
