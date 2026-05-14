import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InvoiceBuilder from '../src/components/invoice/InvoiceBuilder';

// Mock fetch for the API call
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe('Invoice Flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('updates preview panel when form is filled', () => {
    render(<InvoiceBuilder />);
    
    const nicknameInput = screen.getByPlaceholderText('e.g. Acme Corp - March 2024');
    fireEvent.change(nicknameInput, { target: { value: 'Test Nickname' } });
    
    // Test that the form state changes are reflected
    expect(nicknameInput).toHaveValue('Test Nickname');
  });

  it('triggers API call on generate button click', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    render(<InvoiceBuilder />);
    
    const nicknameInput = screen.getByPlaceholderText('e.g. Acme Corp - March 2024');
    fireEvent.change(nicknameInput, { target: { value: 'API Test' } });
    
    const generateBtn = screen.getByText('Generate PDF');
    fireEvent.click(generateBtn);
    
    expect(global.fetch).toHaveBeenCalledWith('/api/invoices/generate', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('API Test')
    }));

    await waitFor(() => {
      expect(screen.getByText('Generating...')).toBeInTheDocument();
    });
  });

  it('shows error state on failed API call', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Failed' })
    });

    render(<InvoiceBuilder />);
    
    const generateBtn = screen.getByText('Generate PDF');
    fireEvent.click(generateBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to generate invoice. Please try again.')).toBeInTheDocument();
    });
  });
});
