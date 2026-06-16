import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Setup Mock for fetch
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

// Mocks for Next Navigation & Headers
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: pushMock,
    refresh: vi.fn(),
  })),
  usePathname: vi.fn(() => '/invoices/new'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(() => ({ value: 'test-workspace' })),
    getAll: vi.fn(() => []),
    set: vi.fn(),
  }),
}));

// Supabase mock setup
const mockSupabaseQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockImplementation(() => Promise.resolve({ data: {}, error: null })),
  upsert: vi.fn(),
  insert: vi.fn(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
  then: vi.fn((resolve) => resolve({ data: [], error: null })),
};

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    admin: {
      inviteUserByEmail: vi.fn(),
    },
  },
  from: vi.fn(() => mockSupabaseQuery),
  storage: {
    from: vi.fn(() => ({
      download: vi.fn(),
    })),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: mockSupabase,
}));

vi.mock('@/app/dashboard/recurring/actions', () => ({
  getRecurringTemplates: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/app/dashboard/clients/actions', () => ({
  getClients: vi.fn().mockResolvedValue([]),
}));

describe('Flow Features Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // 1. Signature Transitions Test
  it('verifies signature transitions (none -> custom -> none) in builder form state', async () => {
    const { default: InvoiceBuilder } = await import('../src/components/invoice/InvoiceBuilder');
    
    // Set up step 4 and required state
    localStorage.setItem('step', '4');
    localStorage.setItem('items', JSON.stringify([{ itemDescription: "Test Item", qty: 1, amount: 100 }]));
    localStorage.setItem('customSignatureUrl', 'data:image/webp;base64,fake');
    localStorage.setItem('signatureMode', 'none');
    
    render(<InvoiceBuilder />);

    // Wait for the step 4 to be mounted. 
    // We expect the text "Payment Details" (the h2/p title of the form) to be visible.
    // Let's just dump the Payment Details form HTML
    const paymentFormTitle = await screen.findByText("Payment Details");
    expect(paymentFormTitle).toBeInTheDocument();

    // Check if Upload is there
    const uploadLabel = await screen.findByText(/Upload Signature Image/i);
    expect(uploadLabel).toBeInTheDocument();

    // Upload an SVG to bypass canvas
    const fileInput = uploadLabel.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['<svg></svg>'], 'sig.svg', { type: 'image/svg+xml' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);

    // Wait for the Apply button
    const applyBtn = await screen.findByRole('button', { name: /Apply to Invoice/i });
    expect(applyBtn).toBeInTheDocument();

    // Click it to transition to custom mode
    fireEvent.click(applyBtn);

    // Now it should show "Currently Applied"
    const appliedText = await screen.findByText(/Currently Applied/i);
    expect(appliedText).toBeInTheDocument();

    // Verify resetting to none clears the selection
    const removeBtn = await screen.findByLabelText(/Remove applied custom signature/i);
    fireEvent.click(removeBtn);
    
    // The apply button should reappear
    const applyBtnAgain = await screen.findByRole('button', { name: /Apply to Invoice/i });
    expect(applyBtnAgain).toBeInTheDocument();
    expect(localStorage.getItem('signatureMode')).toBe('none');
  });

  // 2. PDF Download Proxy Test
  it('verifies PDF download proxy authorization and RLS bypass via share slugs', async () => {
    const { GET: downloadGet } = await import('../src/app/api/invoices/[id]/download/route');

    // Scenario A: Unauthenticated, no share token -> 401 Unauthorized
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    const req1 = new Request('http://localhost/api/invoices/test-id/download');
    const res1 = await downloadGet(req1, { params: Promise.resolve({ id: 'test-id' }) });
    expect(res1.status).toBe(401);

    // Scenario B: Public user accesses with valid share token -> 200 OK with streamed PDF
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: null } });
    mockSupabaseQuery.single.mockResolvedValueOnce({
      data: { pdf_url: 'storage/invoices/pdf-1.pdf', nickname: 'Test Invoice', invoice_number: 'INV-1' },
      error: null,
    });
    mockSupabase.storage.from.mockReturnValueOnce({
      download: vi.fn().mockResolvedValueOnce({ data: new Blob(['PDF-DATA'], { type: 'application/pdf' }), error: null }),
    });

    const req2 = new Request('http://localhost/api/invoices/test-id/download?share=valid-slug');
    const res2 = await downloadGet(req2, { params: Promise.resolve({ id: 'test-id' }) });
    expect(res2.status).toBe(200);
    expect(res2.headers.get('Content-Type')).toBe('application/pdf');
    expect(res2.headers.get('Content-Disposition')).toContain('attachment; filename="Test_Invoice.pdf"');
  });

  // 3. Admin Invitation & Pre-grant Test
  it('verifies admin user invitation permissions and pre-granted manual tier subscription', async () => {
    const { POST: invitePost } = await import('../src/app/api/admin/users/invite/route');

    // Scenario A: Caller is not an admin -> 403 Forbidden
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'caller-id' } } });
    mockSupabaseQuery.single.mockResolvedValueOnce({ data: { role: 'user' } });
    
    const req1 = new Request('http://localhost/api/admin/users/invite', {
      method: 'POST',
      body: JSON.stringify({ email: 'newuser@example.com', tier: 'pro' }),
    });
    const res1 = await invitePost(req1);
    expect(res1.status).toBe(403);

    // Scenario B: Caller is admin -> invites and pre-grants manual subscription tier
    mockSupabase.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'admin-id' } } });
    mockSupabaseQuery.single.mockResolvedValueOnce({ data: { role: 'admin' } });
    mockSupabase.auth.admin.inviteUserByEmail.mockResolvedValueOnce({
      data: { user: { id: 'new-user-uuid', email: 'newuser@example.com' } },
      error: null,
    });
    mockSupabaseQuery.upsert.mockResolvedValueOnce({ error: null });
    mockSupabaseQuery.insert.mockResolvedValueOnce({ error: null });

    const req2 = new Request('http://localhost/api/admin/users/invite', {
      method: 'POST',
      body: JSON.stringify({ email: 'newuser@example.com', tier: 'pro', duration: '1_month' }),
    });
    const res2 = await invitePost(req2);
    expect(res2.status).toBe(200);
    const body = await res2.json();
    expect(body.status).toBe('ok');
    expect(body.data.userId).toBe('new-user-uuid');
    expect(body.data.tier).toBe('pro');
  });

  // 4. Quote generated success text vs Invoice text
  it('verifies success heading text corresponds correctly to generated document type (Quote vs Invoice)', async () => {
    const { GenerateInvoiceButton } = await import('../src/components/invoice/form/downloadInvoice/generateInvoiceButton');
    const { FormProvider, useForm } = await import('react-hook-form');
    
    const Wrapper = ({ isQuoteVal }: { isQuoteVal: boolean }) => {
      const methods = useForm({
        defaultValues: {
          isQuote: isQuoteVal,
          items: [{ itemDescription: 'Test', qty: 1, amount: 100 }],
        },
      });
      return (
        <FormProvider {...methods}>
          <GenerateInvoiceButton profile={{ tier: 'free' }} />
        </FormProvider>
      );
    };

    // Scenario A: Rendering as standard Invoice
    const { unmount } = render(<Wrapper isQuoteVal={false} />);
    expect(screen.getByText(/Your invoice is ready/i)).toBeInTheDocument();
    unmount();

    // Scenario B: Rendering as Quote (when isQuote is set to true in form context)
    render(<Wrapper isQuoteVal={true} />);
    expect(screen.getByText(/Your quote is ready/i)).toBeInTheDocument();
  });
});
