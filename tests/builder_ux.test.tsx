import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InvoiceBuilder from '../src/components/invoice/InvoiceBuilder';

// Mock useRouter
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: pushMock,
  })),
  usePathname: vi.fn(() => '/invoices/new')
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
    // The component uses h-screen w-screen
    const container = document.querySelector('.h-screen.w-screen');
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
    
    // Get the Clear Draft button in the header
    const clearBtn = screen.getByRole('button', { name: /Clear Draft/i });
    fireEvent.click(clearBtn);
    
    expect(screen.getByText(/Clear current draft\?/i)).toBeInTheDocument();
    expect(screen.getByText(/permanently delete all the information/i)).toBeInTheDocument();
  });

  it('Confirming Clear Draft wipes localStorage and exits', async () => {
    localStorage.setItem('yourName', 'Test User');
    render(<InvoiceBuilder />);
    
    // 1. Click the header Clear Draft button
    const clearBtn = screen.getByRole('button', { name: /Clear Draft/i });
    fireEvent.click(clearBtn);
    
    // 2. Click the modal confirm button (there will be two "Clear Draft" buttons now)
    const confirmBtn = screen.getAllByRole('button', { name: /Clear Draft/i })[0]; 
    // Usually the one in the modal appears first in the DOM or we can check parent
    fireEvent.click(confirmBtn);
    
    await waitFor(() => {
      expect(localStorage.getItem('yourName')).toBeNull();
      expect(pushMock).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('verifies Preview Side is height-constrained (h-full)', () => {
    render(<InvoiceBuilder />);
    const previewContainer = document.querySelector('.flex-1.h-full.bg-ink-50');
    expect(previewContainer).toHaveClass('overflow-hidden');
    
    const previewWrapper = previewContainer?.querySelector('.h-full.w-auto');
    expect(previewWrapper).toBeInTheDocument();
  });
});
