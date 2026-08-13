"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { track, identifyUser } from "@/lib/track";

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
  const firedRef = useRef(false);

  useEffect(() => {
    const supabase = createClient();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" || !session?.user) return;
      // onAuthStateChange can re-fire (token refresh, tab focus) — guard per mount.
      if (firedRef.current) return;
      firedRef.current = true;

      // The claim token, when this login came from the beta funnel.
      let funnelToken: string | null = null;
      try {
        const params = new URLSearchParams(window.location.search);
        funnelToken = params.get("claim") || params.get("token");
      } catch {
        /* ignore */
      }

      identifyUser(session.access_token, funnelToken);
      track("signup_completed", {}, funnelToken);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}
