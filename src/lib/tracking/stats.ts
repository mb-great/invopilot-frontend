/**
 * Percentage helpers for the tracking dashboard.
 *
 * Written because the dashboard displayed "Auth survival 1200% — 12 of 1": it
 * divided signup_completed (12) by signup_started (1) and printed whatever came
 * out. signup_started under-fires (the OAuth redirect leaves the page before the
 * event flushes), so the denominator was wrong, not the numerator.
 *
 * When one funnel step is a subset of another, a ratio above 100% is not a
 * finding — it is proof an event mis-fired. The dashboard should say that
 * plainly instead of printing a number that reads like success.
 */

/** Below this many people, a percentage says more about luck than behaviour. */
export const LOW_SAMPLE_THRESHOLD = 20;

/**
 * Percentage of `whole` that `part` represents, clamped to 0–100.
 * Returns null when there is no denominator — callers render that as a dash
 * rather than Infinity or NaN.
 */
export function pct(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  const raw = (part / whole) * 100;
  const clamped = Math.min(100, Math.max(0, raw));
  return Math.round(clamped * 10) / 10;
}

/**
 * Display string carrying the sample size alongside the number, so 34.8% on 23
 * people never reads like 34.8% on 23,000.
 *
 * An impossible ratio (numerator larger than denominator) renders as a warning
 * with the raw counts, because those counts are the evidence of the mis-fire.
 */
export function ratioLabel(part: number, whole: number): string {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return '—';
  if (part > whole) return `check data  ·  ${part} of ${whole}`;
  const p = pct(part, whole);
  return p === null ? '—' : `${p}%  ·  n=${whole}`;
}

/** True when a percentage is drawn from too few people to lean on. */
export function isLowSample(n: number): boolean {
  return Number.isFinite(n) && n < LOW_SAMPLE_THRESHOLD;
}
