/**
 * ISO-3166-1 alpha-2 display helpers for the funnel tracking admin. ADR-033.
 *
 * No country-name package and no flag sprite sheet: `Intl.DisplayNames` ships in
 * the runtime and flag emoji are derived arithmetically from the code itself, so
 * all 249 regions are covered by ~20 lines with zero bundle cost and nothing to
 * keep updated when a country renames itself.
 *
 * 'ZZ' is our own sentinel for "unknown", written by the SQL RPCs where
 * analytics_events.country is NULL. It is deliberately user-assigned in the ISO
 * standard, so it can never collide with a real country code.
 */

const UNKNOWN = 'ZZ';

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/** Human-readable country name. Falls back to the raw code rather than showing nothing. */
export function countryName(code: string | null): string {
  if (!code || code === UNKNOWN) return 'Unknown';
  try {
    return regionNames.of(code.toUpperCase()) || code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

/**
 * Flag emoji from the country code. 'IN' -> 🇮🇳.
 *
 * Each letter maps to its REGIONAL INDICATOR SYMBOL; a pair of them is rendered
 * as one flag by the platform. Windows has no flag glyphs and will show the two
 * letters instead — which is why the country name is always rendered next to it
 * and never replaced by the flag.
 */
export function countryFlag(code: string | null): string {
  if (!code || code === UNKNOWN || !/^[A-Za-z]{2}$/.test(code)) return '🌐';
  const A = 0x1f1e6;
  const base = 'A'.charCodeAt(0);
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map((c) => A + c.charCodeAt(0) - base)
  );
}
