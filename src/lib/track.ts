"use client";

/**
 * Funnel analytics client (dashboard side). Spec: docs/ANALYTICS_FUNNEL_TRACKING.md — ADR-032.
 * Mirror of invopilot-old/app/lib/track.ts. Keep the two in sync.
 *
 * Fire-and-forget by contract: analytics must never throw into render, block
 * auth, or delay a navigation. If the backend is unreachable the app behaves
 * exactly as if this file did not exist.
 *
 * The anon_id cookie is written to the PARENT domain, derived from the backend
 * URL, so the id set on the generator survives the hop to this app. No hardcoded
 * domains anywhere.
 */

const COOKIE = "ip_anon";

function backendUrl(): string {
  return (process.env.NEXT_PUBLIC_BACKEND_URL || "").trim().replace(/\/$/, "");
}

/** api.example.com -> .example.com ; localhost -> "" (host-only cookie) */
function cookieDomain(): string {
  try {
    const host = new URL(backendUrl()).hostname;
    const labels = host.split(".");
    return labels.length > 2 ? "; domain=." + labels.slice(1).join(".") : "";
  } catch {
    return "";
  }
}

export function getAnonId(): string | null {
  if (typeof document === "undefined") return null;
  try {
    const hit = document.cookie.match(/(?:^|;\s*)ip_anon=([^;]+)/);
    if (hit) return hit[1];

    const id =
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : null;
    if (!id) return null;

    document.cookie = `${COOKIE}=${id}; path=/; max-age=31536000; SameSite=Lax${cookieDomain()}`;
    return id;
  } catch {
    return null;
  }
}

/**
 * Strictly-increasing timestamp. Date.now() is millisecond-resolution, so events
 * fired in the same tick collide and `ORDER BY created_at` becomes
 * non-deterministic — which corrupts the last-event-per-person drop-off query.
 * Mirror of invopilot-old/app/lib/track.ts.
 */
let lastStampMs = 0;
function nextStamp(): string {
  const now = Date.now();
  lastStampMs = now > lastStampMs ? now : lastStampMs + 1;
  return new Date(lastStampMs).toISOString();
}

export function track(
  event: string,
  props: Record<string, unknown> = {},
  funnelToken?: string | null
): void {
  try {
    const base = backendUrl();
    if (!base) return; // unset env — stay silent rather than guess a host

    const anonId = getAnonId();
    if (!anonId) return;

    void fetch(`${base}/api/analytics/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anon_id: anonId,
        event,
        funnel_token: funnelToken || undefined,
        // See invopilot-old/app/lib/track.ts — action time, not arrival time.
        occurred_at: nextStamp(),
        props: {
          ...(typeof window === "undefined" ? {} : { viewport_w: window.innerWidth }),
          ...props,
        },
      }),
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    /* analytics must never break the page */
  }
}

/**
 * Clear the anon_id cookie on logout so the next person on a shared device
 * starts with a fresh trail. Spec: docs/ANALYTICS_FUNNEL_TRACKING.md Step 5.
 */
export function clearAnonId(): void {
  try {
    if (typeof document === "undefined") return;
    document.cookie = `${COOKIE}=; path=/; max-age=0; SameSite=Lax${cookieDomain()}`;
  } catch {
    /* never break logout */
  }
}

/**
 * Stitches the anonymous trail to the real user after signup.
 * MUST run client-side: the anon_id lives in a browser cookie, so calling this
 * from a server route handler would silently fail to join anything.
 */
export function identifyUser(accessToken: string, funnelToken?: string | null): void {
  try {
    const base = backendUrl();
    const anonId = getAnonId();
    if (!base || !anonId) return;

    void fetch(`${base}/api/analytics/identify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ anon_id: anonId, funnel_token: funnelToken || undefined }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never break auth */
  }
}
