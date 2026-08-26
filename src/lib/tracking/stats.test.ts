import { describe, it, expect } from 'vitest';
import { pct, ratioLabel, isLowSample, LOW_SAMPLE_THRESHOLD } from './stats';

/**
 * The dashboard showed "Auth survival 1200% — 12 of 1" because it divided
 * signup_completed (12) by signup_started (1) and trusted the result. When one
 * step is a subset of another, a ratio above 100% is impossible — it means an
 * event mis-fired, and the dashboard should say so rather than print a number
 * that looks like a triumph.
 */
describe('pct', () => {
  it('computes a normal percentage', () => {
    expect(pct(8, 23)).toBeCloseTo(34.8, 1);
  });

  it('clamps above 100 — a subset cannot exceed its superset', () => {
    expect(pct(12, 1)).toBe(100);
  });

  it('clamps below 0', () => {
    expect(pct(-5, 10)).toBe(0);
  });

  it('returns null for a zero denominator rather than Infinity or NaN', () => {
    expect(pct(5, 0)).toBeNull();
    expect(pct(0, 0)).toBeNull();
  });

  it('handles a legitimate 100%', () => {
    expect(pct(23, 23)).toBe(100);
  });
});

describe('ratioLabel', () => {
  it('renders the percentage with its sample size', () => {
    expect(ratioLabel(8, 23)).toBe('34.8%  ·  n=23');
  });

  it('flags impossible data instead of printing a wild number', () => {
    expect(ratioLabel(12, 1)).toBe('check data  ·  12 of 1');
  });

  it('renders a dash when there is nothing to divide by', () => {
    expect(ratioLabel(0, 0)).toBe('—');
  });
});

describe('isLowSample', () => {
  it('flags anything under the threshold', () => {
    expect(isLowSample(19)).toBe(true);
    expect(isLowSample(LOW_SAMPLE_THRESHOLD)).toBe(false);
    expect(isLowSample(1000)).toBe(false);
  });
});
