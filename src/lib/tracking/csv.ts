/**
 * Export serialisers for the tracking dashboard (T8, audit Part 5).
 *
 * Approach: browser-side Blob of the rows already loaded on screen, not a
 * server endpoint. The page's "active filters" are `days` and `page` (Visitors
 * pagination, 50/page, capped in SQL) — both are already baked into the rows
 * the RPCs returned for this render, so serialising exactly those rows
 * guarantees the export matches what's on screen with no second query to keep
 * in sync. The tradeoff (Visitors export is capped at the current page, not
 * every row ever) is the one the audit doc names explicitly as acceptable for
 * this approach.
 *
 * Pure functions only — no DOM, no fetch — so they're unit-testable without a
 * browser. The "use client" download trigger lives in
 * src/components/admin/TrackingExportButton.tsx.
 */

export type CsvValue = string | number | boolean | null | undefined;

/** Quotes a value only when it needs it — commas, quotes and newlines appear
 * in `journey` and in emails, so this can't skip any of the three. */
export function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvValue).join(','));
  return lines.join('\n') + '\n';
}

/** Deterministic filename that names the active filters — `days`, and `page`
 * where pagination applies — so the export is traceable back to what was on
 * screen when it was taken. */
export function exportFilename(kind: string, days: number, page?: number): string {
  const parts = ['tracking', kind, `${days}d`];
  if (page !== undefined) parts.push(`p${page}`);
  return `${parts.join('_')}.csv`;
}

// --- Visitors ---------------------------------------------------------

/** Subset of the Visitors RPC row this serialiser needs. */
export interface VisitorCsvInput {
  visitor: string;
  converted: boolean;
  device: string;
  country: string;
  last_event: string;
  last_step: string | null;
  events: number;
  first_seen: string;
  last_seen: string;
  journey: string;
}

/**
 * Column order matches the audit doc verbatim: visitor id or email,
 * converted, device, country, last action, step, event count, first seen,
 * last seen, event path.
 *
 * `labelFor` resolves an event key to its display label (the page's `LABELS`
 * map) — kept as a parameter so this stays a pure function independent of
 * that table.
 */
export function visitorsToCsv(
  visitors: VisitorCsvInput[],
  labelFor: (event: string) => string,
): string {
  const headers = [
    'Visitor',
    'Converted',
    'Device',
    'Country',
    'Last action',
    'Step',
    'Events',
    'First seen',
    'Last seen',
    'Event path',
  ];
  const rows = visitors.map((v) => [
    v.visitor,
    v.converted ? 'yes' : 'no',
    v.device,
    v.country,
    labelFor(v.last_event),
    v.last_step ?? '',
    v.events,
    v.first_seen,
    v.last_seen,
    v.journey,
  ]);
  return toCsv(headers, rows);
}

/**
 * Optional JSON export of the raw event trail (audit Part 5, "optionally an
 * Export JSON for the raw event trail"). `journey` is the arrow-separated
 * event path already carried on each visitor row — split back into an
 * ordered array rather than re-fetching raw events.
 */
export interface VisitorJsonRow {
  visitor: string;
  converted: boolean;
  device: string;
  country: string;
  events: number;
  first_seen: string;
  last_seen: string;
  event_path: string[];
}

/**
 * The Visitor column with any email removed.
 *
 * T12 (audit Part 9): "Handle exports containing emails as personal data; prefer
 * an email-free variant." A converted row's `visitor` IS the person's real email,
 * so the default export is personal data the moment anyone has signed up. This
 * gives the same rows with the identity stripped: every visitor becomes a stable
 * token, so behaviour is still analysable and rows still correlate across
 * exports, but the file carries no address.
 *
 * Anonymous rows are already `anon:xxxxxxxx` and pass through unchanged — they
 * never held an email in the first place.
 */
export function anonymiseVisitor(visitor: string): string {
  if (!visitor.includes('@')) return visitor;
  // Stable per email, non-reversible, and short enough to read in a spreadsheet.
  let h = 0;
  for (let i = 0; i < visitor.length; i += 1) {
    h = (h * 31 + visitor.charCodeAt(i)) | 0;
  }
  return `user:${(h >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Email-free variant of the Visitors export — same columns, same order, same
 * rows, with the Visitor column anonymised. Preferred over visitorsToCsv when
 * the file is leaving the admin's machine.
 */
export function visitorsToCsvWithoutEmails(
  visitors: VisitorCsvInput[],
  labelFor: (event: string) => string,
): string {
  return visitorsToCsv(
    visitors.map((v) => ({ ...v, visitor: anonymiseVisitor(v.visitor) })),
    labelFor,
  );
}

export function visitorsToJson(visitors: VisitorCsvInput[]): string {
  const rows: VisitorJsonRow[] = visitors.map((v) => ({
    visitor: v.visitor,
    converted: v.converted,
    device: v.device,
    country: v.country,
    events: v.events,
    first_seen: v.first_seen,
    last_seen: v.last_seen,
    event_path: v.journey ? v.journey.split(' -> ') : [],
  }));
  return JSON.stringify(rows, null, 2);
}

// --- Funnel -------------------------------------------------------------

export interface FunnelCsvRow {
  event: string;
  people: number;
  percent: number;
}

export function funnelToCsv(rows: FunnelCsvRow[], labelFor: (event: string) => string): string {
  const headers = ['Step', 'People', 'Percent of first step'];
  const csvRows = rows.map((r) => [labelFor(r.event), r.people, r.percent]);
  return toCsv(headers, csvRows);
}

// --- Where people stopped (drop-off) ------------------------------------

export interface DropoffCsvInput {
  last_event: string;
  last_step: string | null;
  viewport_bucket: string;
  country: string;
  people: number;
}

export function dropoffToCsv(
  rows: DropoffCsvInput[],
  labelFor: (event: string) => string,
): string {
  const headers = ['Last action', 'Step', 'Device', 'Country', 'People'];
  const csvRows = rows.map((r) => [
    labelFor(r.last_event),
    r.last_step ?? '',
    r.viewport_bucket,
    r.country,
    r.people,
  ]);
  return toCsv(headers, csvRows);
}
