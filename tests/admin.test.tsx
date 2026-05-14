import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

type QueryResult = {
  data: Array<Record<string, string | number>>;
  count: number;
};

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  then: Promise<QueryResult>['then'];
};

const { supabaseClient } = vi.hoisted(() => {
  const result = Promise.resolve({ 
    data: [{ id: 'user-1', email: 'user@example.com', full_name: 'Test User', role: 'user', created_at: new Date().toISOString() }], 
    count: 10 
  });
  const query = {} as QueryBuilder;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.single = vi.fn().mockResolvedValue({ data: { role: 'admin' } });
  query.is = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.or = vi.fn(() => query);
  query.then = result.then.bind(result);

  return {
    supabaseClient: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-user', email: 'admin@example.com' } } })
      },
      from: vi.fn(() => query)
    }
  };
});

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode, href: string }) => (
    <a href={href}>{children}</a>
  )
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  usePathname: vi.fn(() => '/admin'),
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

describe('Admin Page', () => {
  it('renders admin heading and stat cards', async () => {
    const { default: AdminPage } = await import('../src/app/admin/page');
    const ResolvedPage = await AdminPage({ searchParams: Promise.resolve({}) });
    render(ResolvedPage);
    
    expect(screen.getByText('System Admin')).toBeInTheDocument();
    expect(screen.getByText('Total Invoices')).toBeInTheDocument();
  });

  it('renders user directory', async () => {
    const { default: AdminPage } = await import('../src/app/admin/page');
    const ResolvedPage = await AdminPage({ searchParams: Promise.resolve({}) });
    render(ResolvedPage);
    
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });
});
