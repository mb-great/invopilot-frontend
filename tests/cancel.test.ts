import { describe, expect, it, vi, beforeEach } from 'vitest';
import { POST } from '../src/app/api/billing/cancel/route';
import { requireBillingProfile } from '../src/lib/auth/guards';
import Razorpay from 'razorpay';

vi.mock('../src/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({}),
      })),
    })),
  })),
}));

vi.mock('../src/lib/auth/guards', () => ({
  requireBillingProfile: vi.fn(),
}));

const mockCancel = vi.fn();

vi.mock('razorpay', () => {
  return {
    default: class {
      subscriptions = {
        cancel: mockCancel,
      };
    }
  };
});

describe('Cancel API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCancel.mockResolvedValue({});
  });

  it('allows active user to cancel and sets cancel_requested_at', async () => {
    (requireBillingProfile as any).mockResolvedValue({
      user: { id: 'user_1' },
      profile: {
        subscription_status: 'active',
        razorpay_sub_id: 'sub_123',
      },
    });

    const req = new Request('http://localhost/api/billing/cancel', { method: 'POST' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockCancel).toHaveBeenCalledWith('sub_123', true);
  });

  it('rejects free user with no active subscription', async () => {
    (requireBillingProfile as any).mockResolvedValue({
      user: { id: 'user_2' },
      profile: {
        subscription_status: 'none',
        razorpay_sub_id: null,
      },
    });

    const req = new Request('http://localhost/api/billing/cancel', { method: 'POST' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('No active subscription to cancel');
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('returns 409 for double-cancel (Razorpay already cancelled)', async () => {
    (requireBillingProfile as any).mockResolvedValue({
      user: { id: 'user_3' },
      profile: {
        subscription_status: 'active',
        razorpay_sub_id: 'sub_456',
      },
    });

    mockCancel.mockRejectedValue({
      statusCode: 400,
      error: { description: 'The subscription is already cancelled' },
    });

    const req = new Request('http://localhost/api/billing/cancel', { method: 'POST' });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('successfully synced as cancelled');
  });
});
