import { describe, expect, it } from 'vitest';
import { canCreateInvoice, resolvePlanAccess } from '../src/lib/billing/tiers';

const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

describe('billing tiers', () => {
  it('blocks Free users after 5 lifetime PDFs', () => {
    const gate = canCreateInvoice({ role: 'user', tier: 'free' }, 5, null);

    expect(gate.allowed).toBe(false);
    expect(gate.access.effectiveTier).toBe('free');
    expect(gate.access.plan.maxInvoices).toBe(5);
  });

  it('allows Starter users until 50 PDFs per cycle', () => {
    const gate = canCreateInvoice({
      role: 'user',
      tier: 'starter',
      subscription_status: 'active',
      subscription_period_end: futureDate,
    }, 100, 49); // 100 lifetime, 49 this period

    expect(gate.allowed).toBe(true);
    expect(gate.remaining).toBe(1);
    expect(gate.access.effectiveTier).toBe('starter');
  });

  it('treats expired paid plans as Free access', () => {
    const access = resolvePlanAccess({
      role: 'user',
      tier: 'pro',
      subscription_status: 'active',
      subscription_period_end: pastDate,
    });

    expect(access.effectiveTier).toBe('free');
    expect(access.isExpired).toBe(true);
  });

  it('lets admins bypass invoice limits', () => {
    const gate = canCreateInvoice({ role: 'admin', tier: 'free' }, 10_000, 10_000);

    expect(gate.allowed).toBe(true);
    expect(gate.access.isAdmin).toBe(true);
    expect(gate.access.effectiveTier).toBe('business');
  });

  it('counts queued/processing PDFs against cap reserve', () => {
    const gate = canCreateInvoice({ role: 'user', tier: 'free' }, 4, 4, 1);

    expect(gate.allowed).toBe(false);
    expect(gate.used).toBe(5);
  });

  it('blocks invoice generation when cumulative PDF storage limit is exceeded', () => {
    // Free tier storage limit: 50MB (52,428,800 bytes)
    const gateExceeded = canCreateInvoice({ role: 'user', tier: 'free' }, 1, null, 0, 50 * 1024 * 1024);
    expect(gateExceeded.allowed).toBe(false);
    expect(gateExceeded.storageLimitExceeded).toBe(true);

    const gateAllowed = canCreateInvoice({ role: 'user', tier: 'free' }, 1, null, 0, 49 * 1024 * 1024);
    expect(gateAllowed.allowed).toBe(true);
    expect(gateAllowed.storageLimitExceeded).toBe(false);
  });

  it('allows admins to bypass cumulative storage limits', () => {
    // Admin role bypass
    const gate = canCreateInvoice({ role: 'admin', tier: 'free' }, 1, null, 0, 100 * 1024 * 1024);
    expect(gate.allowed).toBe(true);
    expect(gate.storageLimitExceeded).toBe(false); // bypassed
  });
});
