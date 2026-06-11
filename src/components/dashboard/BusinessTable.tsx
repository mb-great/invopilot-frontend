'use client';

import { useState, useMemo } from 'react';
import { flexRender, getCoreRowModel, useReactTable, getSortedRowModel, getFilteredRowModel, SortingState, ColumnDef } from '@tanstack/react-table';
import { Search, Edit2, Trash2, Image as ImageIcon, Lock, ArrowUpDown } from 'lucide-react';

export type BusinessProfile = {
  id: string;
  name: string;
  logoUrl?: string;
  email?: string;
  gstin?: string;
  createdAt?: string;
  deletedAt?: string;
};

interface BusinessTableProps {
  businesses: BusinessProfile[];
  onEdit: (biz: BusinessProfile) => void;
  onDelete: (id: string) => void;
}

export default function BusinessTable({ businesses, onEdit, onDelete }: BusinessTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const isProfileLocked = (createdAt?: string) => {
    if (!createdAt) return false;
    return Date.now() - new Date(createdAt).getTime() > 48 * 60 * 60 * 1000;
  };

  const columns = useMemo<ColumnDef<BusinessProfile>[]>(() => [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <button
          className="flex items-center gap-2 hover:text-brand-600 transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Business Name
          <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
        </button>
      ),
      cell: ({ row }) => {
        const biz = row.original;
        const locked = isProfileLocked(biz.createdAt);
        return (
          <div className="flex items-center gap-3">
            {biz.logoUrl ? (
              <div className="w-8 h-8 rounded-lg border bg-ink-50 overflow-hidden flex items-center justify-center p-0.5 shadow-sm shrink-0">
                <img src={biz.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg border border-dashed border-ink-300 bg-ink-50/30 flex items-center justify-center text-ink-300 shrink-0">
                <ImageIcon className="w-4 h-4" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-semibold text-ink-900 text-sm flex items-center gap-1.5">
                {biz.name}
                {locked && <span title="Locked from further edits"><Lock className="w-3 h-3 text-neutral-400" /></span>}
              </span>
            </div>
          </div>
        );
      }
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <span className="text-sm text-ink-500">{row.original.email || '-'}</span>
      )
    },
    {
      accessorKey: 'gstin',
      header: 'GSTIN / VAT',
      cell: ({ row }) => (
        row.original.gstin ? (
          <span className="inline-block text-[10px] uppercase font-bold text-muted bg-ink-50 px-2 py-1 rounded border border-ink-100">
            {row.original.gstin}
          </span>
        ) : <span className="text-sm text-neutral-300">-</span>
      )
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const biz = row.original;
        const locked = isProfileLocked(biz.createdAt);
        return (
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => onEdit(biz)}
              className={`p-2 rounded-lg border transition-colors ${
                locked 
                  ? 'border-neutral-100 text-neutral-300 hover:bg-neutral-50 cursor-pointer' 
                  : 'border-ink-100 text-ink-500 hover:text-brand-500 hover:bg-brand-50'
              }`}
              title={locked ? "View Details (Locked)" : "Edit Profile"}
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(biz.id)}
              className="p-2 rounded-lg border border-ink-100 text-ink-500 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete Profile"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      }
    }
  ], [onEdit, onDelete]);

  const table = useReactTable({
    data: businesses,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (businesses.length === 0) {
    return (
      <div className="text-center py-10 border border-dashed border-ink-200 rounded-xl bg-ink-50/20">
        <p className="text-ink-400 font-medium">No active business profiles created yet.</p>
        <p className="text-xs text-neutral-400 mt-1">Add one to quickly fill invoice forms.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
        <input
          type="text"
          placeholder="Search profiles..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-shadow"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-ink-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="border-b border-ink-100 bg-ink-50/50">
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="px-4 py-3 text-xs uppercase font-bold text-ink-500 tracking-wider">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="border-b border-ink-100 hover:bg-ink-50/30 transition-colors last:border-0 group">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
