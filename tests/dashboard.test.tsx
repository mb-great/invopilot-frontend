import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

type QueryResult = {
  data: Array<Record<string, string | number | null>>;
  count: number;
};

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: Promise<QueryResult>['then'];
};

const { supabaseClient } = vi.hoisted(() => {
  const result = Promise.resolve({
    data: [{ id: '1', nickname: 'Test Inv', created_at: new Date().toISOString(), status: 'done', payment_status: 'draft', pdf_url: null, amount: 0, currency: 'INR' }],
    count: 1
  });
  const query = {} as QueryBuilder;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.is = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.range = vi.fn(() => query);
  query.gte = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.single = vi.fn().mockResolvedValue({ data: { role: 'admin' } });
  query.then = result.then.bind(result);

  return {
    supabaseClient: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user', email: 'test@example.com' } } })
      },
      from: vi.fn(() => query),
      rpc: vi.fn().mockResolvedValue({ 
        data: { 
          top_currencies: [{ currency: 'INR', outstanding: 100, paid: 200, overdue: 0, this_month: 300, total_volume: 300, invoice_count: 1 }], 
          other_currencies: [], 
          total_invoice_count: 1 
        } 
      })
    }
  };
});

// Mock the Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode, href: string }) => (
    <a href={href}>{children}</a>
  )
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() }))
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: vi.fn(() => []), set: vi.fn() })
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => supabaseClient)
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({ auth: { signOut: vi.fn().mockResolvedValue({}) } }))
}));

describe('Dashboard Page', () => {
  it('renders dashboard heading and new invoice button', async () => {
    // Next.js server components require resolving the component
    const { default: DashboardPage } = await import('../src/app/dashboard/page');
    const ResolvedPage = await DashboardPage({ searchParams: Promise.resolve({}) });
    render(ResolvedPage);
    
    expect(screen.getByRole('heading', { level: 1, name: /your dashboard/i })).toBeInTheDocument();
    expect(screen.getByText('New invoice')).toBeInTheDocument();
  });

  it('renders fetched invoices', async () => {
    const { default: DashboardPage } = await import('../src/app/dashboard/page');
    const ResolvedPage = await DashboardPage({ searchParams: Promise.resolve({}) });
    render(ResolvedPage);
    
    expect(screen.getByText('Test Inv')).toBeInTheDocument();
  });
});
