import { describe, it, expect, beforeEach } from 'vitest';
import { shouldFireSignupCompleted, markSignupFired, NEW_USER_WINDOW_MS } from './signupOnce';

/**
 * signup_completed fired on every authenticated page load, not once at account
 * creation. One account recorded it 3x in minutes, inflating both signups and
 * unique users.
 *
 * The old guard was a useRef, which resets on every mount — per-mount, not
 * per-user. Supabase emits SIGNED_IN on each load, so each load re-fired it.
 */
const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
} as Pick<Storage, 'getItem' | 'setItem'>;

const now = Date.parse('2026-08-27T12:00:00Z');
const justNow = new Date(now - 5_000).toISOString();
const lastWeek = new Date(now - 7 * 24 * 3600_000).toISOString();

beforeEach(() => store.clear());

describe('shouldFireSignupCompleted', () => {
  it('fires for an account created seconds ago', () => {
    expect(shouldFireSignupCompleted({ userId: 'u1', createdAt: justNow, now, storage: fakeStorage })).toBe(true);
  });

  it('does NOT fire for an existing user signing in again', () => {
    expect(shouldFireSignupCompleted({ userId: 'u1', createdAt: lastWeek, now, storage: fakeStorage })).toBe(false);
  });

  it('does NOT fire twice for the same new user — the reload case that caused this bug', () => {
    const args = { userId: 'u1', createdAt: justNow, now, storage: fakeStorage };
    expect(shouldFireSignupCompleted(args)).toBe(true);
    markSignupFired('u1', fakeStorage);
    expect(shouldFireSignupCompleted(args)).toBe(false);
  });

  it('tracks each user separately', () => {
    markSignupFired('u1', fakeStorage);
    expect(shouldFireSignupCompleted({ userId: 'u2', createdAt: justNow, now, storage: fakeStorage })).toBe(true);
  });

  it('does not fire when createdAt is missing — cannot prove it is a new account', () => {
    expect(shouldFireSignupCompleted({ userId: 'u1', createdAt: undefined, now, storage: fakeStorage })).toBe(false);
  });

  it('does not fire on an unparseable createdAt', () => {
    expect(shouldFireSignupCompleted({ userId: 'u1', createdAt: 'not-a-date', now, storage: fakeStorage })).toBe(false);
  });

  it('treats the window edge as too old', () => {
    const edge = new Date(now - NEW_USER_WINDOW_MS - 1).toISOString();
    expect(shouldFireSignupCompleted({ userId: 'u1', createdAt: edge, now, storage: fakeStorage })).toBe(false);
  });

  it('survives storage being unavailable (private mode) without throwing', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Pick<Storage, 'getItem' | 'setItem'>;
    expect(() => shouldFireSignupCompleted({ userId: 'u1', createdAt: justNow, now, storage: broken })).not.toThrow();
  });
});
