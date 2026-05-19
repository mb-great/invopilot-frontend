import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InvoiceBuilder from '../src/components/invoice/InvoiceBuilder';

// Mock fetch for the API call
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn()
  })),
  usePathname: vi.fn(() => '/invoices/new')
}));

describe('Invoice Flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it('updates form state when input is filled', async () => {
    render(<InvoiceBuilder />);
    
    // We start at step 1: Your Details
    const emailInput = await screen.findByLabelText(/Email/i);
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    
    expect(emailInput).toHaveValue('test@example.com');
  });

  it('triggers API call on generate button click from step 6', async () => {
    fetchMock.mockImplementation((url) => {
      if (url === '/api/invoices/generate') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, invoiceId: 'test-id' })
        });
      }
      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'done', share_slug: 'test-slug' })
        });
      }
      return Promise.resolve({ ok: false });
    });

    // Start directly at step 6 to show the Generate PDF button
    // Must set items so it doesn't trigger shouldReset
    localStorage.setItem('items', JSON.stringify([{itemDescription: 'Test'}]));
    localStorage.setItem('step', '6');
    render(<InvoiceBuilder />);
    
    const generateBtn = await screen.findByRole('button', { name: /Generate Invoice/i });
    fireEvent.click(generateBtn);
    
    expect(global.fetch).toHaveBeenCalledWith('/api/invoices/generate', expect.objectContaining({
      method: 'POST'
    }));

    await waitFor(() => {
      expect(screen.getByText(/Done!/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows error state on failed API call from step 6', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed' })
    });

    localStorage.setItem('items', JSON.stringify([{itemDescription: 'Test'}]));
    localStorage.setItem('step', '6');
    render(<InvoiceBuilder />);
    
    const generateBtn = await screen.findByRole('button', { name: /Generate Invoice/i });
    fireEvent.click(generateBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
