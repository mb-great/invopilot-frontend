import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PricingClient from '../src/components/billing/PricingClient';

const refreshMock = vi.fn();
const toastSuccessMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    refresh: refreshMock,
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (msg: string) => toastSuccessMock(msg),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('PricingClient', () => {
  beforeEach(() => {
    refreshMock.mockClear();
    toastSuccessMock.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Pro active for 30 days. No real payment was made.' }),
    }));
  });

  it('triggers checkout API on button click', async () => {
    // We mock window.location.href assignment
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://checkout.razorpay.com/test' }),
    }));

    render(<PricingClient profile={{ role: 'user', tier: 'free', subscription_status: 'none' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start Pro' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/billing/checkout', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"tier":"pro"'),
      }));
    });
  });

  it('alerts scheduled change message when upgrade fallback occurs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: 'Plan change scheduled. You will be upgraded to pro at the end of your current billing cycle.'
      }),
    }));

    render(<PricingClient profile={{ role: 'user', tier: 'free', subscription_status: 'active', razorpay_sub_id: 'sub_123' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Start Pro' }));

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Plan change scheduled. You will be upgraded to pro at the end of your current billing cycle.');
      expect(refreshMock).toHaveBeenCalled();
    });
  });
});
