'use client';

import { format } from 'date-fns';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Loader2, Search, ChevronLeft, ChevronRight, AlertCircle, Trash2, CheckCircle2, ArrowRightLeft, Download, X, Columns, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { flexRender, getCoreRowModel, useReactTable, ColumnDef, VisibilityState, SortingState } from '@tanstack/react-table';
import { ShareDialog } from './ShareDialog';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { toast } from 'sonner';
import PremiumBadge from '@/components/ui/PremiumBadge';
import { clearInvoiceDraft } from '@/lib/invoiceStorage';
import { SendInvoiceModal } from '@/components/invoice/SendInvoiceModal';

interface Invoice {
  id: string;
  nickname: string | null;
  created_at: string;
  status: string;
  payment_status: string;
  pdf_url: string | null;
  amount: number;
  currency: string;
  share_slug?: string | null;
  invoice_number?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  business_profile_name?: string | null;
  profiles?: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  form_data?: {
    [key: string]: any;
  };
}

export interface Meta {
  total?: number; 
  page: number;
  limit: number;
  totalPages?: number;
  isCapped?: boolean;
}

export default function InvoiceTable({ 
  invoices: initialInvoices, 
  initialMeta,
  showHeader = true,
  showPaymentToggle = false,
  availableCurrencies = [],
  targetUserId,
  canUseQuotes = false,
  canExportCsv = false,
  baseStatus,
  activeWorkspaceId,
  businessFilter
}: { 
  invoices: Invoice[], 
  initialMeta?: Meta,
  showHeader?: boolean,
  showPaymentToggle?: boolean,
  availableCurrencies?: string[],
  targetUserId?: string,
  canUseQuotes?: boolean,
  canExportCsv?: boolean,
  baseStatus?: string,
  activeWorkspaceId?: string,
  businessFilter?: string | null
}) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [meta, setMeta] = useState<Meta>(initialMeta || { page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const isFirstRender = useRef(true);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modal State
  const [shareData, setShareData] = useState<{ isOpen: boolean; url: string }>({ isOpen: false, url: '' });
  const [sendEmailData, setSendEmailData] = useState<{ isOpen: boolean; id: string; email?: string; invoiceNumber?: string }>({ isOpen: false, id: '' });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null; isBulk?: boolean }>({ isOpen: false, id: null });

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at.desc');
  const [page, setPage] = useState(1);
  const [mounted, setMounted] = useState(false);

  // Initialize page from session storage once mounted
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPage = sessionStorage.getItem('invoice_page');
      if (savedPage) {
        const parsed = parseInt(savedPage, 10);
        if (!isNaN(parsed) && parsed > 0) {
          setPage(parsed);
        }
      }
    }
    setMounted(true);
  }, []);

  // Date Filtering
  const [dateType, setDateType] = useState('');
  const [dateValue, setDateValue] = useState('');

  const fetchInvoices = useCallback(async () => {
    // Wait until mounted to fetch so we have the correct 'page' from sessionStorage
    if (!mounted) return;
    
    // Optimization: Skip fetching on mount if we already have initial data and defaults
    // Note: Since we now use 'mounted' and start at page 1, we only skip if sessionStorage was ALSO page 1
    if (isFirstRender.current && page === 1 && !search && !statusFilter && !currencyFilter && !dateType && !dateValue && sortBy === 'created_at.desc') {
      isFirstRender.current = false;
      return;
    }
    isFirstRender.current = false;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        search,
        status: baseStatus || statusFilter,
        currency: currencyFilter,
        dateType,
        dateValue,
        sort: sortBy,
        tzOffset: new Date().getTimezoneOffset().toString()
      });
      if (targetUserId) {
        params.append('userId', targetUserId);
      }
      if (activeWorkspaceId) {
        params.append('workspaceId', activeWorkspaceId);
      }
      if (businessFilter) {
        params.append('business', businessFilter);
      }
      const res = await fetch(`/api/invoices?${params}`);
      const result = await res.json();
      if (res.ok) {
        // Auto-correct if we are on a page that no longer exists
        const outOfBounds = (result.meta.totalPages > 0 && page > result.meta.totalPages) || (result.data.length === 0 && page > 1);
        
        if (outOfBounds) {
          setPage(1);
          return; // Skip updating state with empty data, let the effect trigger a new fetch for page 1
        }

        setInvoices(result.data);
        setMeta(prev => ({
          ...result.meta,
          totalPages: result.meta.totalPages || prev.totalPages 
        }));
        
        // Reset selection on page change
        setSelectedIds([]);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, currencyFilter, dateType, dateValue, sortBy, targetUserId, mounted, baseStatus, activeWorkspaceId, businessFilter]);

  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      sessionStorage.setItem('invoice_page', page.toString());
    }
    fetchInvoices();
  }, [statusFilter, currencyFilter, dateType, dateValue, sortBy, page, fetchInvoices, mounted]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mounted && !isFirstRender.current) {
        fetchInvoices();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchInvoices, mounted]);

  const handleUpdateStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    
    // 1. Optimistic update
    const prevInvoices = [...invoices];
    setInvoices(prev => prev.map(inv => 
      inv.id === id ? { ...inv, payment_status: newStatus } : inv
    ));

    try {
      setLoadingId(id);
      const res = await fetch(`/api/invoices/${id}/status`, { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: newStatus })
      });
      
      if (!res.ok) throw new Error('Update failed');
    } catch (err) {
      // 2. Revert on error
      setInvoices(prevInvoices);
      toast.error(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setLoadingId(null);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      setLoadingId(id);
      const res = await fetch(`/api/invoices/${id}/retry`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Retry failed');
      }
      
      setInvoices(prev => prev.map(inv => 
        inv.id === id ? { ...inv, status: 'pending' } : inv
      ));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setLoadingId(null);
    }
  };

  const handleShare = (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (inv?.share_slug) {
      const url = `${window.location.origin}/i/${inv.share_slug}`;
      setShareData({ isOpen: true, url });
    }
  };

  const handleSendEmail = (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (inv) {
      setSendEmailData({
        isOpen: true,
        id: inv.id,
        email: inv.client_email || '',
        invoiceNumber: inv.invoice_number || undefined
      });
    }
  };

  const handleDelete = async () => {
    const idsToDelete = deleteModal.isBulk ? selectedIds : [deleteModal.id];
    if (idsToDelete.length === 0) return;
    
    try {
      setLoading(true);
      
      const res = await fetch('/api/invoices/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToDelete })
      });

      if (!res.ok) throw new Error('Delete failed');
      
      setInvoices(prev => prev.filter(inv => !idsToDelete.includes(inv.id)));
      setSelectedIds([]);
      setDeleteModal({ isOpen: false, id: null });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConvert = async (id: string) => {
    try {
      setConvertingId(id);
      const res = await fetch('/api/invoices/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Conversion failed');
      
      // Mark old quote as converted in local state
      setInvoices(prev => prev.map(inv => 
        inv.id === id ? { ...inv, payment_status: 'converted' } : inv
      ));
      toast.success(`Quote converted → ${result.data.invoiceNumber}`);
      // Refresh to show new invoice
      fetchInvoices();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setConvertingId(null);
    }
  };  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [customExportDates, setCustomExportDates] = useState({ start: '', end: '' });

  const handleExportCsv = (range: string) => {
    if (!canExportCsv) {
      toast.error('Upgrade to Pro to export CSV');
      return;
    }
    
    let url = `/api/invoices/export?range=${range}`;
    if (range === 'custom') {
      if (!customExportDates.start || !customExportDates.end) {
        toast.error('Please select both start and end dates');
        return;
      }
      url += `&start=${customExportDates.start}&end=${customExportDates.end}`;
    }

    // Trigger download
    window.location.href = url;
    setIsExportDropdownOpen(false);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === invoices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(invoices.map(i => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const getPaymentStatusClass = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-500 text-white border-emerald-600';
      case 'unpaid': return 'bg-brand-500/10 text-brand-600 border-brand-500/20';
      case 'overdue': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'draft': return 'bg-ink-100 text-ink-600 border-ink-200';
      case 'converted': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      case 'quote': return 'bg-purple-500 text-white border-purple-600';
      default: return 'bg-ink-50 text-ink-400';
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: currency || 'INR',
        maximumFractionDigits: 0
      }).format(amount);
    } catch (e) {
      return `${currency} ${amount.toLocaleString()}`;
    }
  };

  const safeDate = (dateStr: string | null | undefined, formatStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return format(d, formatStr);
  };


  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);

  // Load visibility from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('invoice_cols');
      if (saved) setColumnVisibility(JSON.parse(saved));
    }
  }, []);

  // Save visibility to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && Object.keys(columnVisibility).length > 0) {
      localStorage.setItem('invoice_cols', JSON.stringify(columnVisibility));
    }
  }, [columnVisibility]);

  const columns = useMemo<ColumnDef<Invoice>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <input 
          type="checkbox" 
          checked={invoices.length > 0 && selectedIds.length === invoices.length}
          onChange={toggleSelectAll}
          className="rounded border-ink-300 text-brand-500 focus:ring-brand-500"
        />
      ),
      cell: ({ row }) => (
        <input 
          type="checkbox" 
          checked={selectedIds.includes(row.original.id)}
          onChange={() => toggleSelect(row.original.id)}
          className="rounded border-ink-300 text-brand-500 focus:ring-brand-500"
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'nickname',
      header: 'Invoice Details',
      cell: ({ row }) => {
        const title = row.original.nickname || row.original.invoice_number || 'Unnamed Invoice';
        const client = row.original.client_name || row.original.client_email;
        const business = row.original.business_profile_name;

        return (
          <div className="flex flex-col min-w-0 max-w-[250px]">
            <span className="truncate font-bold text-sm text-ink-900" title={title}>
              {title}
            </span>
            
            {client && (
              <span className="text-[12px] text-ink-600 truncate mt-0.5" title={client}>
                To: <span className="font-medium">{client}</span>
              </span>
            )}
            
            {business && (
              <span className="text-[11px] text-ink-400 truncate mt-0.5" title={business}>
                From: {business}
              </span>
            )}
            
            {row.original.nickname && row.original.invoice_number && (
              <span className="text-[10px] text-ink-400 font-mono uppercase mt-0.5">
                {row.original.invoice_number}
              </span>
            )}

            {row.original.profiles?.full_name && (
              <span className="text-[10px] text-brand-600 font-bold bg-brand-50 px-1.5 py-0.5 rounded-md mt-1 self-start">
                Made by {row.original.profiles.full_name}
              </span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => (
        <span className="font-bold text-ink-900 whitespace-nowrap">
          {formatCurrency(row.original.amount || 0, row.original.currency)}
        </span>
      )
    },
    {
      id: 'issueDate',
      header: 'Issue Date',
      accessorFn: row => row.issue_date || row.form_data?.issueDate,
      cell: ({ getValue }) => <span className="text-[11px] font-medium text-ink-700 whitespace-nowrap">{safeDate(getValue() as string, 'MMM d, yyyy')}</span>
    },
    {
      id: 'dueDate',
      header: 'Due Date',
      accessorFn: row => row.due_date || row.form_data?.dueDate,
      cell: ({ getValue }) => <span className="text-[11px] font-medium text-ink-700 whitespace-nowrap">{safeDate(getValue() as string, 'MMM d, yyyy')}</span>
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ getValue }) => <span className="text-[10px] font-medium text-ink-400 italic whitespace-nowrap">{safeDate(getValue() as string, 'MMM d, p')}</span>
    },
    {
      accessorKey: 'payment_status',
      header: 'Status',
      cell: ({ row }) => {
        const isPastDue = row.original.payment_status === 'unpaid' && row.original.due_date && new Date(row.original.due_date) < new Date();
        const displayStatus = row.original.payment_status === 'overdue' || isPastDue ? 'overdue' : row.original.payment_status;
        
        return (
          <div className="flex flex-col items-center gap-1">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border inline-block uppercase tracking-wider ${getPaymentStatusClass(displayStatus)}`}>
              {displayStatus === 'paid' ? 'Paid' : displayStatus === 'converted' ? 'Converted' : displayStatus === 'draft' ? 'Draft' : displayStatus === 'quote' ? 'Quote' : displayStatus === 'overdue' ? 'Overdue' : 'Unpaid'}
            </span>
            {row.original.status !== 'done' && (
              <span className="text-[9px] text-ink-400 italic">PDF: {row.original.status}</span>
            )}
          </div>
        );
      }
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const inv = row.original;
        return (
          <div className="flex justify-end items-center gap-1 flex-wrap min-w-[200px]">
            {inv.status === 'done' ? (
              <>
                <a href={`/api/invoices/${inv.id}/download?view=1`} target="_blank" rel="noreferrer" className="text-ink-500 hover:text-brand-600 text-[11px] font-bold px-2 py-1">View</a>
                <a href={`/api/invoices/${inv.id}/download`} className="p-1.5 text-ink-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Download PDF"><Download className="w-4 h-4" /></a>
                <button onClick={() => handleShare(inv.id)} className="text-brand-600 hover:text-brand-700 text-[11px] font-bold px-2 py-1">Share</button>
                <button onClick={() => handleSendEmail(inv.id)} className="text-brand-600 hover:text-brand-700 text-[11px] font-bold px-2 py-1">Email</button>
                {inv.payment_status === 'quote' && (
                  <button
                    onClick={() => canUseQuotes ? handleConvert(inv.id) : toast.error('Upgrade to Pro to convert quotes')}
                    disabled={convertingId === inv.id}
                    className={`text-[11px] font-bold px-2 py-1 transition-colors flex items-center gap-1 ${canUseQuotes ? 'text-purple-600 hover:text-purple-700' : 'text-ink-300 cursor-not-allowed'}`}
                    title={canUseQuotes ? 'Convert to Invoice' : 'Pro+ required'}
                  >
                    {convertingId === inv.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRightLeft className="w-3 h-3" />}
                    Convert
                  </button>
                )}
                {showPaymentToggle && (
                  <button 
                    onClick={() => handleUpdateStatus(inv.id, inv.payment_status)}
                    disabled={loadingId === inv.id}
                    className={`text-[11px] font-bold px-2 py-1 transition-colors min-w-[75px] text-center ${inv.payment_status === 'paid' ? 'text-ink-400 hover:text-ink-600' : 'text-emerald-600 hover:text-emerald-700'}`}
                  >
                    {inv.payment_status === 'paid' ? 'Unmark' : 'Mark Paid'}
                  </button>
                )}
                <button onClick={() => setDeleteModal({ isOpen: true, id: inv.id })} disabled={loadingId === inv.id} className="p-1.5 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : inv.status === 'failed' ? (
              <>
                <div className="flex items-center gap-1.5 text-red-500 mr-2"><AlertCircle className="w-3 h-3" /><span className="text-[10px] font-bold uppercase tracking-tight">Failed</span></div>
                <button onClick={() => handleRetry(inv.id)} disabled={loadingId === inv.id} className="text-brand-600 hover:text-brand-700 text-[11px] font-bold px-2 py-1">Retry</button>
                <button onClick={() => setDeleteModal({ isOpen: true, id: inv.id })} disabled={loadingId === inv.id} className="p-1.5 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
              </>
            ) : (
              <div className="flex items-center gap-2 text-ink-400 px-4"><Loader2 className="w-3 h-3 animate-spin" /><span className="text-[10px] font-medium uppercase tracking-tight">Processing</span></div>
            )}
          </div>
        );
      }
    }
  ], [invoices, selectedIds, convertingId, loadingId, canUseQuotes, showPaymentToggle]);

  const table = useReactTable({
    data: invoices,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    // Perform sorting on the client side for the current page
    getSortedRowModel: require('@tanstack/react-table').getSortedRowModel(),
  });

  // End TanStack Injection


  const renderPageNumbers = () => {
    const totalPages = meta.totalPages || 1;
    const pages = [];
    const maxVisible = 5;
    
    let start = Math.max(1, page - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => setPage(i)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            page === i 
            ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' 
            : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'
          }`}
        >
          {i}
        </button>
      );
    }
    return pages;
  };

  return (
    <div className="w-full space-y-4 min-h-[65vh] flex flex-col">
      <ShareDialog 
        isOpen={shareData.isOpen} 
        onClose={() => setShareData({ ...shareData, isOpen: false })} 
        shareUrl={shareData.url} 
      />

      {sendEmailData.isOpen && (
        <SendInvoiceModal
          isOpen={sendEmailData.isOpen}
          onClose={() => setSendEmailData({ isOpen: false, id: '' })}
          invoiceId={sendEmailData.id}
          defaultEmail={sendEmailData.email}
          invoiceNumber={sendEmailData.invoiceNumber}
        />
      )}

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title={deleteModal.isBulk ? "Bulk Delete Invoices" : "Delete Invoice"}
        message={deleteModal.isBulk 
          ? `⚠️ This will permanently delete ${selectedIds.length} invoices and all associated PDF records. This action cannot be undone.`
          : "⚠️ This will permanently delete this invoice and all associated PDF records. This action cannot be undone and may affect your tax records."
        }
        confirmLabel={deleteModal.isBulk ? `Delete ${selectedIds.length} Items` : "Confirm Delete"}
        isDestructive={true}
        requirePassword={false}
      />

      {showHeader && (
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-bold text-ink-900">Invoices</h2>
          <div className="flex items-center gap-3">
            {selectedIds.length > 0 && (
              <button
                onClick={() => setDeleteModal({ isOpen: true, id: null, isBulk: true })}
                className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-100 transition-all flex items-center gap-2 border border-red-200"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected ({selectedIds.length})
              </button>
            )}
            <a 
              href="/invoices/new"
              onClick={() => clearInvoiceDraft()}
              className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              New Invoice
            </a>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-ink-50/50 p-2 rounded-xl border border-ink-100 relative z-[40]">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2">
          <div className="relative w-full md:flex-1 md:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input 
              type="text" 
              placeholder="Search by name, email or number..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-white border border-ink-200 rounded-lg text-sm outline-none focus:border-brand-500 transition-colors"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {availableCurrencies.length > 0 && (
              <select 
                value={currencyFilter}
                onChange={(e) => { setCurrencyFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-white border border-ink-200 rounded-lg text-sm outline-none cursor-pointer font-bold text-brand-600"
              >
                <option value="">All Currencies</option>
                {availableCurrencies.map(c => (
                  <option key={c} value={c}>{c.toLocaleUpperCase()}</option>
                ))}
              </select>
            )}
            {!baseStatus && (
              <select 
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-white border border-ink-200 rounded-lg text-sm outline-none cursor-pointer"
              >
                <option value="">All Status</option>
                <option value="paid">Paid</option>
                <option value="sent">Unpaid</option>
                <option value="overdue">Overdue</option>
                <option value="draft">Draft</option>
                <option value="quote">Quote</option>
              </select>
            )}
            <select
              value={dateType}
              onChange={(e) => { setDateType(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-white border border-ink-200 rounded-lg text-sm outline-none cursor-pointer"
            >
              <option value="">All Dates</option>
              <option value="generated">Generated Date</option>
              <option value="issued">Issue Date</option>
              <option value="due">Due Date</option>
            </select>
            {dateType && (
              <input
                type="date"
                value={dateValue}
                onChange={(e) => { setDateValue(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-white border border-ink-200 rounded-lg text-sm outline-none cursor-pointer"
              />
            )}
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-white border border-ink-200 rounded-lg text-sm outline-none cursor-pointer"
            >
              <option value="created_at.desc">Newest First</option>
              <option value="created_at.asc">Oldest First</option>
              <option value="amount.desc">Highest Amount</option>
              <option value="amount.asc">Lowest Amount</option>
            </select>
            {(search || statusFilter || currencyFilter || dateType) && (
              <button
                onClick={() => { setSearch(''); setStatusFilter(''); setCurrencyFilter(''); setDateType(''); setDateValue(''); setPage(1); }}
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                title="Clear all filters"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
            
            {loading && <Loader2 className="w-4 h-4 animate-spin text-brand-600" />}
            
            {/* TanStack Column Toggle */}
            <div className="relative">
              <button 
                onClick={() => setIsColumnDropdownOpen(!isColumnDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold bg-white border border-ink-200 text-ink-600 hover:bg-ink-50 transition-all"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>View</span>
              </button>
              {isColumnDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white/80 backdrop-blur-xl border border-ink-200 rounded-xl shadow-xl z-50 p-2 text-sm flex flex-col gap-1">
                  <div className="px-2 py-1 text-xs font-bold text-ink-400 uppercase tracking-widest border-b border-ink-100 mb-1">Visible Columns</div>
                  {table.getAllLeafColumns().map(col => {
                    if (col.id === 'select' || col.id === 'actions') return null;
                    return (
                      <label key={col.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-ink-50 rounded-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={col.getIsVisible()}
                          onChange={col.getToggleVisibilityHandler()}
                          className="rounded border-ink-300 text-brand-500 focus:ring-brand-500"
                        />
                        <span className="text-ink-700 font-medium capitalize">{col.id.replace('_', ' ')}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>


            {/* CSV Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all border ${
                  canExportCsv
                    ? 'bg-white border-ink-200 text-ink-600 hover:bg-ink-50'
                    : 'bg-ink-50 border-ink-100 text-ink-300 cursor-not-allowed'
                }`}
                title={canExportCsv ? 'Export CSV Data' : 'Pro+ required'}
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
                <PremiumBadge type="pro" />
              </button>

              {isExportDropdownOpen && canExportCsv && (
                <div className="absolute right-0 mt-2 w-56 bg-white/80 backdrop-blur-xl border border-ink-200 rounded-xl shadow-xl z-[100] p-2 text-sm flex flex-col gap-1">
                  <div className="px-2 py-1 text-xs font-bold text-ink-400 uppercase tracking-widest border-b border-ink-100 mb-1">Export Range</div>
                  
                  <button onClick={() => handleExportCsv('7d')} className="text-left px-2 py-1.5 hover:bg-ink-50 rounded-lg text-ink-700 font-medium">Last 7 Days</button>
                  <button onClick={() => handleExportCsv('30d')} className="text-left px-2 py-1.5 hover:bg-ink-50 rounded-lg text-ink-700 font-medium">Last 30 Days</button>
                  <button onClick={() => handleExportCsv('month')} className="text-left px-2 py-1.5 hover:bg-ink-50 rounded-lg text-ink-700 font-medium">This Month</button>
                  <button onClick={() => handleExportCsv('lifetime')} className="text-left px-2 py-1.5 hover:bg-ink-50 rounded-lg text-ink-700 font-medium text-brand-600">Lifetime Everything</button>
                  
                  <div className="border-t border-ink-100 my-1"></div>
                  
                  <div className="px-2 py-1 flex flex-col gap-2">
                    <span className="text-[10px] uppercase font-bold text-ink-400">Custom Range</span>
                    <input type="date" value={customExportDates.start} onChange={e => setCustomExportDates(p => ({ ...p, start: e.target.value }))} className="px-2 py-1 border border-ink-200 rounded text-xs outline-none focus:border-brand-500" />
                    <input type="date" value={customExportDates.end} onChange={e => setCustomExportDates(p => ({ ...p, end: e.target.value }))} className="px-2 py-1 border border-ink-200 rounded text-xs outline-none focus:border-brand-500" />
                    <button onClick={() => handleExportCsv('custom')} className="mt-1 w-full bg-ink-900 text-white rounded-lg py-1.5 text-xs font-bold hover:bg-ink-800 transition-colors">Download</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full flex-1 overflow-hidden">
        <div className="overflow-x-auto pb-4 no-scrollbar w-full">
          
          <table className="w-full text-left border-collapse min-w-[900px] table-auto">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="text-ink-400 text-[10px] uppercase tracking-widest border-b border-ink-100 bg-ink-50/30">
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      className={`py-3 px-4 font-bold cursor-pointer hover:bg-ink-100/50 transition-colors ${header.column.getCanSort() ? 'select-none' : ''}`}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1.5">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="text-ink-300 flex-shrink-0">
                            {{
                              asc: <ArrowUp className="w-3 h-3 text-brand-500" />,
                              desc: <ArrowDown className="w-3 h-3 text-brand-500" />,
                            }[header.column.getIsSorted() as string] ?? <ArrowUpDown className="w-3 h-3" />}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-ink-50">
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className={`group hover:bg-ink-50/50 transition-colors ${selectedIds.includes(row.original.id) ? 'bg-brand-50/30' : ''}`}>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className={`py-2 px-4 ${cell.column.id === 'actions' ? 'text-right' : ''}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {invoices.length === 0 && !loading && (
            <div className="py-20 text-center text-ink-400 text-sm">No invoices found.</div>
          )}
        </div>

        {/* Pagination */}
        {(meta.totalPages || 0) > 1 && (
          <div className="flex flex-col gap-2 px-4 py-3 bg-ink-50/30 border-t border-ink-100">
            {meta.isCapped && (
              <div className="flex items-center gap-2 text-ink-500 bg-brand-50/50 p-2 rounded-lg border border-brand-100 mb-1">
                <AlertCircle className="w-3.5 h-3.5 text-brand-600" />
                <span className="text-[11px] font-medium leading-tight">
                  Displaying up to 500 records. For older invoices, please use the search or filters.
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="text-xs text-ink-400 font-medium">
                {meta.total ? (
                  `Showing ${invoices.length} of ${meta.total} invoices`
                ) : (
                  `Page ${page} of ${meta.totalPages}`
                )}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  disabled={page === 1 || loading}
                  onClick={() => setPage(p => p - 1)}
                  className="p-1.5 rounded-lg border border-ink-200 bg-white text-ink-600 disabled:opacity-50 hover:bg-ink-50 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-1 mx-1">
                  {renderPageNumbers()}
                </div>

                <button 
                  disabled={page === (meta.totalPages || 1) || meta.isCapped || loading}
                  onClick={() => setPage(p => p + 1)}
                  className="p-1.5 rounded-lg border border-ink-200 bg-white text-ink-600 disabled:opacity-50 hover:bg-ink-50 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
