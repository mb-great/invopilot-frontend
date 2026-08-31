import { describe, it, expect } from 'vitest';
import { escapeCsvValue, toCsv, exportFilename, visitorsToCsv, visitorsToJson, funnelToCsv, dropoffToCsv, type VisitorCsvInput, type DropoffCsvInput, visitorsToCsvWithoutEmails, anonymiseVisitor } from './csv';

const labelFor = (event: string) =>
  ({ invoice_ready_viewed: 'Reached "invoice ready"', signup_completed: 'Finished signing up' })[
    event
  ] || event;

describe('escapeCsvValue', () => {
  it('leaves a plain value untouched', () => {
    expect(escapeCsvValue('mobile')).toBe('mobile');
  });

  it('quotes a value containing a comma', () => {
    expect(escapeCsvValue('step 1, step 2')).toBe('"step 1, step 2"');
  });

  it('quotes and doubles internal quotes', () => {
    expect(escapeCsvValue('he said "hi"')).toBe('"he said ""hi"""');
  });

  it('quotes a value containing a newline', () => {
    expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
  });

  it('quotes a value containing a carriage return', () => {
    expect(escapeCsvValue('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('renders null/undefined as an empty cell, not the literal word', () => {
    expect(escapeCsvValue(null)).toBe('');
    expect(escapeCsvValue(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('joins headers and rows with commas and newlines, trailing newline included', () => {
    const out = toCsv(['A', 'B'], [[1, 'x'], [2, 'y']]);
    expect(out).toBe('A,B\n1,x\n2,y\n');
  });
});

describe('exportFilename — reflects the active filters (days, page)', () => {
  it('includes the days filter', () => {
    expect(exportFilename('visitors', 30)).toBe('tracking_visitors_30d.csv');
  });

  it('includes the page filter when given, so paginated exports are traceable', () => {
    expect(exportFilename('visitors', 30, 1)).toBe('tracking_visitors_30d_p1.csv');
    expect(exportFilename('visitors', 7, 3)).toBe('tracking_visitors_7d_p3.csv');
  });

  it('changes with the date range, matching a different range on screen', () => {
    expect(exportFilename('funnel_tool', 7)).toBe('tracking_funnel_tool_7d.csv');
    expect(exportFilename('funnel_tool', 90)).toBe('tracking_funnel_tool_90d.csv');
  });
});

const visitorFixture: VisitorCsvInput[] = [
  {
    visitor: 'anon:ab12cd34',
    converted: false,
    device: 'mobile',
    country: 'IN',
    last_event: 'builder_step_viewed',
    last_step: '2',
    events: 4,
    first_seen: '2026-08-20T10:00:00.000Z',
    last_seen: '2026-08-20T10:05:00.000Z',
    journey: 'wp_landing_viewed -> generator_started -> builder_step_viewed',
  },
  {
    visitor: 'person@example.com',
    converted: true,
    device: 'desktop',
    country: 'US',
    last_event: 'signup_completed',
    last_step: null,
    events: 7,
    first_seen: '2026-08-21T09:00:00.000Z',
    last_seen: '2026-08-21T09:30:00.000Z',
    journey: 'wp_landing_viewed -> invoice_ready_viewed -> signup_completed',
  },
];

describe('visitorsToCsv — column order and content', () => {
  it('carries exactly the specified columns, in the specified order', () => {
    const csv = visitorsToCsv(visitorFixture, labelFor);
    const [headerLine] = csv.split('\n');
    expect(headerLine).toBe(
      'Visitor,Converted,Device,Country,Last action,Step,Events,First seen,Last seen,Event path',
    );
  });

  it('reflects only the rows passed in — i.e. exactly what filters/pagination loaded', () => {
    const csv = visitorsToCsv(visitorFixture, labelFor);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(1 + visitorFixture.length);
  });

  it('renders converted as yes/no', () => {
    const csv = visitorsToCsv(visitorFixture, labelFor);
    expect(csv).toContain('anon:ab12cd34,no,');
    expect(csv).toContain('person@example.com,yes,');
  });

  it('escapes an email-bearing row and a journey containing a comma', () => {
    const withComma: VisitorCsvInput[] = [
      {
        ...visitorFixture[1],
        visitor: 'a,b@example.com',
        journey: 'step "one", step two',
      },
    ];
    const csv = visitorsToCsv(withComma, labelFor);
    expect(csv).toContain('"a,b@example.com"');
    expect(csv).toContain('"step ""one"", step two"');
  });

  it('resolves the last action through the given label function', () => {
    const csv = visitorsToCsv(visitorFixture, labelFor);
    expect(csv).toContain('Finished signing up');
  });

  it('renders a missing step as an empty cell', () => {
    const csv = visitorsToCsv(visitorFixture, labelFor);
    const lastLine = csv.trim().split('\n')[2];
    expect(lastLine).toContain(',Finished signing up,,7,');
  });
});

describe('visitorsToJson — raw event trail', () => {
  it('splits the journey string back into an ordered array', () => {
    const json = JSON.parse(visitorsToJson(visitorFixture));
    expect(json[0].event_path).toEqual([
      'wp_landing_viewed',
      'generator_started',
      'builder_step_viewed',
    ]);
  });

  it('carries visitor identity and conversion state', () => {
    const json = JSON.parse(visitorsToJson(visitorFixture));
    expect(json[1].visitor).toBe('person@example.com');
    expect(json[1].converted).toBe(true);
  });
});

describe('funnelToCsv', () => {
  it('carries step, people and percent columns in order', () => {
    const csv = funnelToCsv(
      [
        { event: 'wp_landing_viewed', people: 31, percent: 100 },
        { event: 'invoice_ready_viewed', people: 8, percent: 25.8 },
      ],
      labelFor,
    );
    const [headerLine, row1] = csv.split('\n');
    expect(headerLine).toBe('Step,People,Percent of first step');
    expect(row1).toBe('wp_landing_viewed,31,100');
  });

  it('resolves event labels through the given function', () => {
    const csv = funnelToCsv([{ event: 'invoice_ready_viewed', people: 8, percent: 25.8 }], labelFor);
    expect(csv).toContain('"Reached ""invoice ready"""');
  });
});

describe('dropoffToCsv', () => {
  const dropoffFixture: DropoffCsvInput[] = [
    {
      last_event: 'builder_step_viewed',
      last_step: '1',
      viewport_bucket: 'mobile',
      country: 'IN',
      people: 6,
    },
    {
      last_event: 'signup_completed',
      last_step: null,
      viewport_bucket: 'desktop',
      country: 'US',
      people: 3,
    },
  ];

  it('carries last action, step, device, country and people columns in order', () => {
    const csv = dropoffToCsv(dropoffFixture, labelFor);
    const [headerLine] = csv.split('\n');
    expect(headerLine).toBe('Last action,Step,Device,Country,People');
  });

  it('reflects exactly the rows passed in', () => {
    const csv = dropoffToCsv(dropoffFixture, labelFor);
    expect(csv.trim().split('\n')).toHaveLength(1 + dropoffFixture.length);
  });

  it('renders a null step as an empty cell rather than the word null', () => {
    const csv = dropoffToCsv(dropoffFixture, labelFor);
    expect(csv).not.toContain('null');
  });
});

describe('T12 · email-free export variant (audit Part 9)', () => {
  const rows = [
    {
      visitor: 'karan@saasknot.com', converted: true, device: 'desktop', country: 'IN',
      last_event: 'signup_completed', last_step: null, events: 9,
      first_seen: '2026-08-01T00:00:00Z', last_seen: '2026-08-02T00:00:00Z', journey: 'a -> b',
    },
    {
      visitor: 'anon:11533b47', converted: false, device: 'mobile', country: 'ZZ',
      last_event: 'builder_step_viewed', last_step: '1', events: 3,
      first_seen: '2026-08-01T00:00:00Z', last_seen: '2026-08-01T00:05:00Z', journey: 'a',
    },
  ];
  const label = (e: string) => e;

  it('strips the email from a converted row', () => {
    const csv = visitorsToCsvWithoutEmails(rows, label);
    expect(csv).not.toContain('karan@saasknot.com');
    expect(csv).not.toContain('@');
  });

  it('leaves already-anonymous rows untouched', () => {
    expect(anonymiseVisitor('anon:11533b47')).toBe('anon:11533b47');
  });

  it('is stable, so the same person correlates across exports', () => {
    expect(anonymiseVisitor('a@b.com')).toBe(anonymiseVisitor('a@b.com'));
    expect(anonymiseVisitor('a@b.com')).not.toBe(anonymiseVisitor('c@d.com'));
  });

  it('keeps every other column and the column order identical', () => {
    const plain = visitorsToCsv(rows, label).split('\n');
    const safe = visitorsToCsvWithoutEmails(rows, label).split('\n');
    expect(safe[0]).toBe(plain[0]);
    expect(safe).toHaveLength(plain.length);
    expect(safe[1]).toContain('desktop');
    expect(safe[1]).toContain('IN');
  });
});
