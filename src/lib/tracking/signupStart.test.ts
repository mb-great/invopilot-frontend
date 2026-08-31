import { describe, it, expect, beforeEach } from 'vitest';
import {
  shouldFireSignupStarted,
  markSignupStartedFired,
  resetSignupStartedForTests,
} from './signupStart';

describe('shouldFireSignupStarted', () => {
  beforeEach(() => resetSignupStartedForTests());

  it('fires for a direct sign-in, which previously emitted nothing at all', () => {
    expect(shouldFireSignupStarted({ funnelToken: null })).toBe(true);
    expect(shouldFireSignupStarted({ funnelToken: undefined })).toBe(true);
    expect(shouldFireSignupStarted({})).toBe(true);
  });

  it('stays silent when a funnel token is present, because invopilot-old already fired it', () => {
    expect(shouldFireSignupStarted({ funnelToken: 'a3f1c2e4-0000-4000-8000-000000000000' })).toBe(false);
  });

  it('fires once per page load, so an OAuth retry does not inflate the denominator', () => {
    expect(shouldFireSignupStarted({ funnelToken: null })).toBe(true);
    markSignupStartedFired();
    expect(shouldFireSignupStarted({ funnelToken: null })).toBe(false);
  });

  it('treats an empty-string token as no token', () => {
    expect(shouldFireSignupStarted({ funnelToken: '' })).toBe(true);
  });
});
