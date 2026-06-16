import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InvoiceBuilder from '../src/components/invoice/InvoiceBuilder';

// Mock useRouter
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: pushMock,
  })),
  usePathname: vi.fn(() => '/invoices/new'),
  useSearchParams: vi.fn(() => new URLSearchParams())
}));

// Mock useData for preview
vi.mock('@/hooks/useData', () => ({
  useData: vi.fn(() => ({
    yourDetails: {},
    companyDetails: {},
    invoiceTerms: {},
    invoiceDetails: { items: [] },
    paymentDetails: {},
  }))
}));

describe('Invoice Builder Navigation & Layout UX', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // JSDOM doesn't support 100vh/100vw natively, but we can verify classes
  });

  it('verifies 100vh/100vw layout classes are applied', () => {
    render(<InvoiceBuilder />);
    // The component uses h-[100dvh] w-full
    const container = document.querySelector('.h-\\[100dvh\\].w-full');
    expect(container).toBeInTheDocument();
  });

  it('Back button navigates to dashboard WITHOUT clearing draft', async () => {
    localStorage.setItem('yourName', 'Test User');
    render(<InvoiceBuilder />);
    
    const backBtn = screen.getByRole('button', { name: /Back/i });
    fireEvent.click(backBtn);
    
    expect(pushMock).toHaveBeenCalledWith('/dashboard');
    expect(localStorage.getItem('yourName')).toBe('Test User');
  });

  it('Clear Draft button shows confirmation modal', async () => {
    render(<InvoiceBuilder />);
    
    // Get the Clear Draft button in the header (which is labeled 'Clear')
    const clearBtn = screen.getByRole('button', { name: /Clear/i });
    fireEvent.click(clearBtn);
    
    expect(screen.getByText(/Clear current draft\?/i)).toBeInTheDocument();
    expect(screen.getByText(/permanently delete all the information/i)).toBeInTheDocument();
  });

  it('Confirming Clear Draft wipes localStorage and exits', async () => {
    localStorage.setItem('yourName', 'Test User');
    render(<InvoiceBuilder />);
    
    // 1. Click the header Clear button
    const clearBtn = screen.getByRole('button', { name: /Clear/i });
    fireEvent.click(clearBtn);
    
    // 2. Click the modal confirm button (confirmLabel is "Clear Draft")
    const confirmBtn = screen.getByRole('button', { name: /Clear Draft/i }); 
    fireEvent.click(confirmBtn);
    
    await waitFor(() => {
      expect(localStorage.getItem('yourName')).toBeNull();
    });
  });

  it('verifies Preview Side is height-constrained (h-full)', () => {
    render(<InvoiceBuilder />);
    const previewContainer = document.querySelector('.flex-1.h-full.bg-\\[\\#f9fafb\\]');
    expect(previewContainer).toHaveClass('overflow-hidden');
    
    const previewWrapper = previewContainer?.querySelector('.h-full.w-auto');
    expect(previewWrapper).toBeInTheDocument();
  });
});
