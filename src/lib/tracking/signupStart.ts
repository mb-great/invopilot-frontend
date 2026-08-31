/**
 * Decides whether this sign-in click should emit `signup_started`.
 *
 * The bug this closes: the dashboard read "Auth survival 1200%" because
 * signup_started had fired ONCE in the entire dataset (2 rows all-time against
 * 46 signup_completed). Two causes, and the audit only named the first:
 *
 *   1. The event fires in invopilot-old at the moment of redirect. That path
 *      works — it uses fetch(keepalive), which survives the navigation.
 *   2. Nobody who signs in DIRECTLY ever passes through that code. Both login
 *      pages here (/login and /login/beta) emitted nothing at all, so every
 *      direct signup entered the funnel already converted, with no start.
 *
 * The rule is therefore about provenance, not timing: emit only when this
 * browser did NOT arrive carrying a funnel token. A token means the generator
 * already fired the event on the way out, and firing again here would
 * double-count the one number the funnel is least able to afford being wrong.
 */

/** Fired at most once per page load — a retry after an OAuth error is the same visit. */
let firedThisPageLoad = false;

/** Test seam. Never call from app code. */
export function resetSignupStartedForTests(): void {
  firedThisPageLoad = false;
}

export function shouldFireSignupStarted(args: { funnelToken?: string | null }): boolean {
  // Arrived from the generator: invopilot-old already emitted signup_started
  // alongside the funnel token. Staying quiet here keeps it one per journey.
  if (args.funnelToken) return false;

  if (firedThisPageLoad) return false;
  return true;
}

/** Record that the event has been emitted for this page load. */
export function markSignupStartedFired(): void {
  firedThisPageLoad = true;
}
