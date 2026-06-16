import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  invoiceId: 'inv-123',
  invoiceNumber: 'INV-001',
  clientEmail: 'client@example.com',
  clientName: 'Acme Corp',
  senderName: 'John Doe',
};

async function renderModal(props = {}) {
  const { default: UnifiedShareModal } = await import('@/components/invoice/UnifiedShareModal');
  return render(<UnifiedShareModal {...defaultProps} {...props} />);
}

describe('T4 — Chip input behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('comma in To field converts text to chip', async () => {
    await renderModal();
    const input = screen.getByPlaceholderText(/add email/i);
    fireEvent.change(input, { target: { value: 'test@example.com,' } });
    fireEvent.keyDown(input, { key: ',' });
    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  it('Enter in To field converts text to chip', async () => {
    await renderModal({ clientEmail: undefined });
    // To and CC both empty → both show "Add email"; To is [0]
    const inputs = screen.getAllByPlaceholderText(/add email/i);
    const toInput = inputs[0];
    fireEvent.change(toInput, { target: { value: 'enter@example.com' } });
    fireEvent.keyDown(toInput, { key: 'Enter' });
    await waitFor(() => {
      expect(screen.getByText('enter@example.com')).toBeInTheDocument();
    });
  });

  it('Backspace on empty input removes last chip', async () => {
    await renderModal();
    // clientEmail pre-filled as chip in To field
    await waitFor(() => {
      expect(screen.getByText('client@example.com')).toBeInTheDocument();
    });
    // When To has a chip, its placeholder becomes "" → only CC shows "Add email"
    // Target To input directly via its empty placeholder
    const toInput = screen.getByPlaceholderText('');
    fireEvent.keyDown(toInput, { key: 'Backspace' });
    await waitFor(() => {
      expect(screen.queryByText('client@example.com')).not.toBeInTheDocument();
    });
  });

  it('Invalid email format shows toast.error', async () => {
    const { toast } = await import('sonner');
    await renderModal({ clientEmail: undefined });
    const inputs = screen.getAllByPlaceholderText(/add email/i);
    const toInput = inputs[0];
    fireEvent.change(toInput, { target: { value: 'not-an-email' } });
    fireEvent.keyDown(toInput, { key: 'Enter' });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/invalid email/i));
    });
  });
});

describe('T5 — Send behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Send button calls fetch with correct payload', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });
    await renderModal();
    // clientEmail pre-filled as chip
    await waitFor(() => expect(screen.getByText('client@example.com')).toBeInTheDocument());

    const sendBtn = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/invoices/inv-123/email',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"toEmail":"client@example.com"'),
        })
      );
    });
  });

  it('Success response calls toast.success', async () => {
    const { toast } = await import('sonner');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });
    await renderModal();
    await waitFor(() => expect(screen.getByText('client@example.com')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });

  it('Failure response calls toast.error', async () => {
    const { toast } = await import('sonner');
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'SMTP error' }),
    });
    await renderModal();
    await waitFor(() => expect(screen.getByText('client@example.com')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('SMTP error');
    });
  });

  it('Send button disabled when To chips empty', async () => {
    await renderModal({ clientEmail: undefined });
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toBeDisabled();
  });
});
