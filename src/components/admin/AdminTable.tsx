'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { flexRender, getCoreRowModel, getExpandedRowModel, getSortedRowModel, useReactTable, SortingState, ColumnDef } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Loader2, ArrowUpDown, ChevronDown, ChevronRight as ChevronRightIcon, ExternalLink } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { toast } from 'sonner';

export interface UserStats {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  total_invoices_generated: number;
  isDeleted?: boolean;
  tier?: string;
  subscription_status?: string;
  subscription_period_start?: string;
  subscription_period_end?: string;
  subscription_source?: string;
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

interface CurrencyStats {
  currency: string;
  outstanding: number;
  paid: number;
  overdue: number;
  this_month: number;
  total_volume: number;
  invoice_count: number;
}

interface AuditLog {
  id: string;
  action: string;
  tier: string;
  reason: string;
  valid_until: string;
  amount: number;
  currency: string;
  created_at: string;
  admin: { email: string; full_name: string } | null;
}

// Removed floating hooks

// Removed ExpandedRowContent because we now route to /admin/users/[id]

export default function AdminTable({ 
  users: initialUsers,
  pagination,
  currentUserRole = 'admin'
}: { 
  users: UserStats[],
  pagination: PaginationMeta,
  currentUserRole?: string
}) {
  const [users, setUsers] = useState(initialUsers);
  const [sorting, setSorting] = useState<SortingState>([]);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => { setUsers(initialUsers); }, [initialUsers]);

  const handleUpdateUser = useCallback((updatedUser: UserStats) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
  }, []);

  const columns = useMemo<ColumnDef<UserStats>[]>(() => [
    {
      accessorKey: 'full_name',
      header: ({ column }) => (
        <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-ink-500 hover:text-ink-900">
          User <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink-900">{row.original.full_name || 'Anonymous'}</span>
            {row.original.isDeleted && <span className="text-[8px] bg-ink-900 text-white px-1.5 py-0.5 rounded uppercase">Archive</span>}
          </div>
          <span className="text-xs text-ink-400">{row.original.email}</span>
        </div>
      )
    },
    {
      accessorKey: 'tier',
      header: 'Tier',
      cell: ({ row }) => (
        <span className="text-xs font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-1 rounded">
          {row.original.tier || 'Free'}
        </span>
      )
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-ink-500">
          Joined <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ row }) => <span className="text-sm text-ink-600">{new Date(row.original.created_at).toLocaleDateString()}</span>
    },
    {
      accessorKey: 'total_invoices_generated',
      header: ({ column }) => (
        <button onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="flex items-center gap-1 font-bold text-xs uppercase tracking-wider text-ink-500 justify-end w-full">
          Invoices <ArrowUpDown className="w-3 h-3" />
        </button>
      ),
      cell: ({ row }) => <div className="text-right font-bold text-ink-900">{row.original.total_invoices_generated.toLocaleString()}</div>
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Link 
          href={`/admin/users/${row.original.id}`}
          className="px-3 py-1.5 bg-ink-100 text-ink-700 hover:bg-brand-50 hover:text-brand-700 rounded-md text-xs font-bold transition-colors inline-flex items-center gap-1"
        >
          View <ExternalLink className="w-3 h-3" />
        </Link>
      ),
      size: 80,
    }
  ], []);

  const table = useReactTable({
    data: users,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/admin?${params.toString()}`);
  };

  return (
    <div className="w-full space-y-4">
      <div className="w-full overflow-x-auto max-w-[90vw] md:max-w-full">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} className="border-b border-ink-100 bg-ink-50/30">
                {headerGroup.headers.map(header => (
                  <th key={header.id} className="py-4 px-4 align-middle" style={{ width: header.getSize() !== 150 ? header.getSize() : 'auto' }}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-ink-50">
            {table.getRowModel().rows.map(row => (
              <React.Fragment key={row.id}>
                <tr className={`hover:bg-ink-50/50 transition-colors ${row.original.isDeleted ? 'opacity-70 bg-ink-50/20' : ''}`}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="py-4 px-4 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              </React.Fragment>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={columns.length} className="py-12 text-center text-ink-400">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-ink-50/30 border-t border-ink-100 rounded-b-xl">
          <div className="text-xs text-ink-400 font-medium">
            Showing <span className="text-ink-900 font-bold">{users.length}</span> of <span className="text-ink-900 font-bold">{pagination.totalCount}</span> users
          </div>
          <div className="flex items-center gap-2">
            <button disabled={pagination.currentPage === 1} onClick={() => handlePageChange(pagination.currentPage - 1)} className="p-1.5 rounded-lg border border-ink-200 bg-white disabled:opacity-50">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-ink-900 mx-2 uppercase tracking-widest text-[10px]">Page {pagination.currentPage} / {pagination.totalPages}</span>
            <button disabled={pagination.currentPage === pagination.totalPages} onClick={() => handlePageChange(pagination.currentPage + 1)} className="p-1.5 rounded-lg border border-ink-200 bg-white disabled:opacity-50">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
