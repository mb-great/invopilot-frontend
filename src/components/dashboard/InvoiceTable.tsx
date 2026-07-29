'use client';

import { format } from 'date-fns';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Search, ChevronLeft, ChevronRight, AlertCircle, Trash2, CheckCircle2, ArrowRightLeft, Download, X, Columns, ArrowUpDown, ArrowUp, ArrowDown, Link2, Pencil, MoreVertical, MoreHorizontal, Eye, Send, Share2, Mail, Copy, RotateCcw, Inbox } from 'lucide-react';
import { flexRender, getCoreRowModel, useReactTable, ColumnDef, VisibilityState, SortingState } from '@tanstack/react-table';
import UnifiedShareModal from '@/components/invoice/UnifiedShareModal';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { toast } from 'sonner';
import PremiumBadge from '@/components/ui/PremiumBadge';
import { clearInvoiceDraft } from '@/lib/invoiceStorage';

const pendingStatusChanges = new Map<string, string>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function flushPendingStatus() {
  if (pendingStatusChanges.size === 0) return;
  const changes = Array.from(pendingStatusChanges.entries());
  pendingStatusChanges.clear();
  const payload = JSON.stringify(changes.map(([id, status]) => ({ id, delivery_status: status })));
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    for (const [id, status] of changes) {
      navigator.sendBeacon(`/api/invoices/${id}/status`, new Blob([JSON.stringify({ delivery_status: status })], { type: 'application/json' }));
    }
  } else {
    for (const [id, status] of changes) {
      fetch(`/api/invoices/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delivery_status: status }) });
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPendingStatus);
}

interface Invoice {
  id: string;
  nickname: string | null;
  created_at: string;
  status: string;
  type: string;
  payment_status: string;
  delivery_status: string;
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
  showActions = true,
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
  showActions?: boolean,
  availableCurrencies?: string[],
  targetUserId?: string,
  canUseQuotes?: boolean,
  canExportCsv?: boolean,
  baseStatus?: string,
  activeWorkspaceId?: string,
  businessFilter?: string | null
}) {
  const router = useRouter();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [meta, setMeta] = useState<Meta>(initialMeta || { page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const isFirstRender = useRef(true);
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modal State
  const [unifiedModal, setUnifiedModal] = useState<{ isOpen: boolean; invoiceId: string; invoiceNumber: string; clientEmail: string; shareSlug?: string; pdfUrl?: string; initialTab?: 'email' | 'share' }>({ isOpen: false, invoiceId: '', invoiceNumber: '', clientEmail: '' });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null; isBulk?: boolean }>({ isOpen: false, id: null });
  const [mobileActionsId, setMobileActionsId] = useState<string | null>(null);
  const [highlightedInvoiceId, setHighlightedInvoiceId] = useState<string | null>(null);
  const menuRef = useRef<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const handleHighlight = (e: any) => {
      const { invoiceId } = e.detail || {};
      if (invoiceId) {
        setHighlightedInvoiceId(invoiceId);
        const timer = setTimeout(() => {
          setHighlightedInvoiceId(null);
        }, 2500);
        return () => clearTimeout(timer);
      }
    };
    window.addEventListener('invoice-highlight', handleHighlight as EventListener);
    return () => window.removeEventListener('invoice-highlight', handleHighlight as EventListener);
  }, []);

  // Single global click handler — closes menu if click is outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!menuRef.current) return;
      const inside = e.composedPath().some(el =>
        el instanceof HTMLElement && (el.hasAttribute('data-overflow-menu') || el.hasAttribute('data-overflow-trigger'))
      );
      if (!inside) {
        menuRef.current = null;
        setMobileActionsId(null);
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuRef.current) {
        menuRef.current = null;
        setMobileActionsId(null);
      }
    };
    document.addEventListener('click', handler);
    document.addEventListener('keydown', escHandler);
    return () => { document.removeEventListener('click', handler); document.removeEventListener('keydown', escHandler); };
  }, []);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  }, []);

  useEffect(() => {
    // Initial check with a small delay to ensure DOM is fully painted
    const timer = setTimeout(checkScroll, 100);
    
    window.addEventListener('resize', checkScroll);
    
    // Use ResizeObserver to detect changes in the table container size itself
    let resizeObserver: ResizeObserver | null = null;
    if (scrollContainerRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        checkScroll();
      });
      resizeObserver.observe(scrollContainerRef.current);
      // Also observe the inner table to detect content changes
      const tableEl = scrollContainerRef.current.querySelector('table');
      if (tableEl) resizeObserver.observe(tableEl);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [checkScroll, invoices]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Tooltip hover controller — show only the hovered icon's tooltip
  useEffect(() => {
    const show = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement | null;
      if (!btn) return;
      const tip = btn.querySelector<HTMLElement>('.icon-tip');
      if (tip) tip.style.opacity = '1';
    };
    const hide = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement | null;
      if (!btn) return;
      const tip = btn.querySelector<HTMLElement>('.icon-tip');
      if (tip) tip.style.opacity = '0';
    };
    document.addEventListener('mouseover', show);
    document.addEventListener('mouseout', hide);
    return () => { document.removeEventListener('mouseover', show); document.removeEventListener('mouseout', hide); };
  }, []);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
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
        type: typeFilter,
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
  }, [page, search, statusFilter, currencyFilter, typeFilter, dateType, dateValue, sortBy, targetUserId, mounted, baseStatus, activeWorkspaceId, businessFilter]);

  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      sessionStorage.setItem('invoice_page', page.toString());
    }
    fetchInvoices();
  }, [statusFilter, currencyFilter, typeFilter, dateType, dateValue, sortBy, page, fetchInvoices, mounted]);

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
      router.refresh();
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
    if (inv) {
      setUnifiedModal({ isOpen: true, invoiceId: inv.id, invoiceNumber: inv.invoice_number || '', clientEmail: inv.client_email || '', shareSlug: inv.share_slug || undefined, pdfUrl: inv.pdf_url || undefined, initialTab: 'share' });
    }
  };

  const handleSendEmail = (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (inv) {
      setUnifiedModal({ isOpen: true, invoiceId: inv.id, invoiceNumber: inv.invoice_number || '', clientEmail: inv.client_email || '', shareSlug: inv.share_slug || undefined, pdfUrl: inv.pdf_url || undefined, initialTab: 'email' });
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
        body: JSON.stringify({ ids: idsToDelete, workspaceId: activeWorkspaceId })
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

  const allColumns = useMemo<ColumnDef<Invoice>[]>(() => [
    {
      id: 'select',
      meta: { className: 'w-[40px]' },
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
      meta: { className: 'w-[40%] lg:w-auto min-w-[200px]' },
      cell: ({ row }) => {
        const title = row.original.nickname || row.original.invoice_number || 'Unnamed Invoice';
        const client = row.original.client_name || row.original.client_email;
        const business = row.original.business_profile_name;

        return (
          <div className="flex flex-col min-w-0 max-w-[250px]">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14.5px] font-[800] text-ink-900" title={title}>
                {title}
              </span>
              {row.original.type === 'quote' && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 uppercase shrink-0">Quote</span>
              )}
            </div>
            
            {client && (
              <span className="text-[12px] text-slate-500 truncate mt-[3px] leading-relaxed" title={client}>
                To: <span className="font-medium">{client}</span>
              </span>
            )}
            
            {row.original.nickname && row.original.invoice_number && (
              <span className="text-[12px] text-slate-400 font-mono mt-[3px] leading-relaxed">
                {row.original.invoice_number}
              </span>
            )}

            {row.original.profiles?.full_name && (
              <span className="text-[12px] text-slate-400 italic mt-[3px] leading-relaxed">
                by {row.original.profiles.full_name}
              </span>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      meta: { className: 'w-[15%] lg:w-[110px]' },
      cell: ({ row }) => (
        <span className="text-[15px] font-[800] text-ink-900 whitespace-nowrap">
          {formatCurrency(row.original.amount || 0, row.original.currency)}
        </span>
      )
    },
    {
      id: 'issueDate',
      header: 'Issue Date',
      accessorFn: row => row.issue_date || row.form_data?.issueDate,
      meta: { className: 'hidden md:table-cell w-[10%] lg:w-[104px]' },
      cell: ({ getValue }) => <span className="text-[13px] text-slate-500 whitespace-nowrap">{safeDate(getValue() as string, 'MMM d, yyyy')}</span>
    },
    {
      id: 'dueDate',
      header: 'Due Date',
      accessorFn: row => row.due_date || row.form_data?.dueDate,
      meta: { className: 'hidden sm:table-cell w-[10%] lg:w-[104px]' },
      cell: ({ getValue }) => <span className="text-[13px] text-slate-500 whitespace-nowrap">{safeDate(getValue() as string, 'MMM d, yyyy')}</span>
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      meta: { className: 'hidden lg:table-cell w-[124px]' },
      cell: ({ getValue }) => <span className="text-[12px] text-slate-400 italic whitespace-nowrap">{safeDate(getValue() as string, 'MMM d, p')}</span>
    },
    {
      accessorKey: 'payment_status',
      header: 'Status',
      meta: { className: 'w-[15%] lg:w-[150px]' },
      cell: ({ row }) => {
        const inv = row.original;
        const isPastDue = inv.payment_status === 'unpaid' && inv.due_date && new Date(inv.due_date) < new Date();
        const isOverdue = inv.payment_status === 'overdue' || isPastDue;
        const isPaid = inv.payment_status === 'paid';
        const isSent = inv.delivery_status === 'sent';

        const isFailed = inv.status === 'failed';
        const isProcessing = inv.status === 'processing' || inv.status === 'queued';

        let lifecycle: string;
        let pillBg: string;
        let pillText: string;
        let pillBorder: string;
        let dotBg: string;

        if (isFailed) {
          lifecycle = 'Failed';
          pillBg = 'bg-red-50'; pillText = 'text-red-700'; pillBorder = 'border-red-200'; dotBg = 'bg-red-500';
        } else if (isProcessing) {
          lifecycle = 'Generating...';
          pillBg = 'bg-amber-50'; pillText = 'text-amber-700'; pillBorder = 'border-amber-200'; dotBg = 'bg-amber-500 animate-pulse';
        } else if (isPaid) {
          lifecycle = 'Paid';
          pillBg = 'bg-[#ECFDF3]'; pillText = 'text-[#15803D]'; pillBorder = 'border-[#A7F3C6]'; dotBg = 'bg-[#16A34A]';
        } else if (isOverdue) {
          const days = inv.due_date ? Math.ceil((Date.now() - new Date(inv.due_date).getTime()) / 86400000) : 0;
          lifecycle = days > 0 ? `Overdue · ${days}d` : 'Overdue';
          pillBg = 'bg-[#FEECEC]'; pillText = 'text-[#B91C1C]'; pillBorder = 'border-[#FBD0D0]'; dotBg = 'bg-[#DC2626]';
        } else if (inv.type === 'quote' && !isSent && inv.payment_status === 'draft') {
          lifecycle = 'Draft';
          pillBg = 'bg-[#F1F5F9]'; pillText = 'text-[#475569]'; pillBorder = 'border-[#E2E8F0]'; dotBg = 'bg-[#94A3B8]';
        } else {
          lifecycle = 'Unpaid';
          pillBg = 'bg-[#EFF4FF]'; pillText = 'text-[#1D4ED8]'; pillBorder = 'border-[#D5E2FF]'; dotBg = 'bg-[#2563EB]';
        }

        return (
          <span className={`inline-flex items-center gap-[7px] text-[12.5px] font-[700] px-3 py-[5px] rounded-full border whitespace-nowrap ${pillBg} ${pillText} ${pillBorder}`}>
            {isProcessing ? <Loader2 className="w-[10px] h-[10px] animate-spin text-amber-600" /> : <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${dotBg}`} />}
            {lifecycle}
          </span>
        );
      }
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      meta: { className: 'w-[90px] lg:w-[300px]' },
      cell: ({ row }) => {
        const inv = row.original;
        const isPastDue = inv.payment_status === 'unpaid' && inv.due_date && new Date(inv.due_date) < new Date();
        const isOverdue = inv.payment_status === 'overdue' || isPastDue;
        const isPaid = inv.payment_status === 'paid';
        const isSent = inv.delivery_status === 'sent';
        const isQuoteDraft = inv.type === 'quote' && inv.payment_status === 'draft';
        const isFailed = inv.status === 'failed';
        const isProcessing = inv.status === 'processing' || inv.status === 'queued';
        const menuOpen = mobileActionsId === inv.id;
        const done = inv.status === 'done';

        // Custom toast to match HTML prototype (Dark background + Green Dot)
        const showToast = (msg: string) => {
          toast(msg, {
            icon: <span className="text-[#4ADE80] font-bold text-lg">●</span>,
            style: { background: '#16233A', color: '#fff', border: 'none', borderRadius: '11px', padding: '12px 20px', fontWeight: 600, fontSize: '14px' },
            duration: 2400
          });
        };

        const onAction = (action: string) => {
          if (action === 'view') showToast(`Opening ${inv.invoice_number || 'invoice'}`);
          if (action === 'download') showToast(`Downloading ${inv.invoice_number || 'invoice'}.pdf`);
          if (action === 'share') showToast('Payment link copied');
          if (action === 'reminder') showToast('Reminder sent via Gmail');
          // if (action === 'duplicate') showToast('Duplicated as a draft');
        };

        // Size: lg=primary slot, md=quick icon slots
        type ActionItem = { key: string; size: 'lg' | 'md'; el: React.JSX.Element };
        const actions: ActionItem[] = [];
        const menuItems: { key: string; label: string; icon: React.ReactNode; isToggle?: boolean; checked?: boolean; danger?: boolean; onClick: () => void }[] = [];

        const PrimaryBtn = ({ cls, icon: Icon, label, onClick, disabled }: any) => (
          <div className="w-[118px] flex-shrink-0 flex items-stretch">
            <button onClick={onClick} disabled={disabled || loadingId === inv.id} className={`w-full h-[34px] px-[12px] rounded-[9px] border border-transparent inline-flex items-center justify-center gap-[7px] text-[13px] font-[700] whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}>
              <Icon className="w-[15px] h-[15px] flex-shrink-0" />
              {label}
            </button>
          </div>
        );

        const IconBtn = ({ tip, icon: Icon, onClick, extraCls = '' }: any) => (
          <button onClick={onClick} data-tooltip className={`w-[34px] h-[34px] flex-shrink-0 inline-flex items-center justify-center rounded-[9px] border border-[#E9EDF3] bg-white text-[#64748B] hover:bg-[#F5F6F8] hover:text-[#0F172A] hover:border-[#D8DFE9] transition-colors relative ${extraCls}`}>
            <Icon className="w-[16px] h-[16px]" />
            <span className="icon-tip absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#16233A] text-white text-[11px] font-semibold px-[9px] py-[5px] rounded-md whitespace-nowrap opacity-0 transition-opacity pointer-events-none z-40 before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-[5px] before:border-transparent before:border-t-[#16233A]">{tip}</span>
          </button>
        );
        
        const LinkIconBtn = ({ tip, icon: Icon, href }: any) => (
          <a href={href} onClick={() => onAction(tip.toLowerCase())} target="_blank" rel="noreferrer" data-tooltip className="w-[34px] h-[34px] flex-shrink-0 inline-flex items-center justify-center rounded-[9px] border border-[#E9EDF3] bg-white text-[#64748B] hover:bg-[#F5F6F8] hover:text-[#0F172A] hover:border-[#D8DFE9] transition-colors relative">
            <Icon className="w-[16px] h-[16px]" />
            <span className="icon-tip absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#16233A] text-white text-[11px] font-semibold px-[9px] py-[5px] rounded-md whitespace-nowrap opacity-0 transition-opacity pointer-events-none z-40 before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-[5px] before:border-transparent before:border-t-[#16233A]">{tip}</span>
          </a>
        );

        const viewUrl = inv.pdf_url ? `/view/${encodeURIComponent(inv.pdf_url)}` : `/api/invoices/${inv.id}/download?view=1`;
        const downloadUrl = inv.pdf_url ? `/view/${encodeURIComponent(inv.pdf_url)}/download` : `/api/invoices/${inv.id}/download`;

        // === Fixed Action Slots ===
        if (isFailed) {
          actions.push({ key: 'retry', size: 'lg', el: <PrimaryBtn cls="bg-red-50 text-red-600 border-red-200 hover:bg-red-100" icon={RotateCcw} label="Retry" onClick={() => handleRetry(inv.id)} /> });
        } else if (isProcessing) {
          actions.push({ key: 'proc', size: 'lg', el: <PrimaryBtn disabled cls="bg-[#F1F5F9] text-[#94A3B8]" icon={Loader2} label="Processing" /> });
        } else if (inv.type === 'quote') {
          const isConverted = inv.payment_status === 'converted';
          
          if (isConverted) {
            actions.push({ key: 'pri', size: 'lg', el: <div className="w-[118px] flex-shrink-0 flex items-stretch"><a href={viewUrl} target="_blank" rel="noreferrer" className="w-full h-[34px] px-[12px] rounded-[9px] border border-[#E9EDF3] bg-white text-[#0F172A] inline-flex items-center justify-center gap-[7px] text-[13px] font-[700] whitespace-nowrap hover:bg-[#F5F6F8] transition-colors"><Eye className="w-[15px] h-[15px]" /> View</a></div> });
            actions.push({ key: 'i1', size: 'md', el: <LinkIconBtn tip="Download" icon={Download} href={downloadUrl} /> });
          } else if (isQuoteDraft) {
            actions.push({ key: 'pri', size: 'lg', el: <PrimaryBtn cls="bg-[#F97316] text-white shadow-[0_2px_6px_rgba(249,115,22,.25)] hover:bg-[#EA580C]" icon={Send} label="Send" onClick={() => handleSendEmail(inv.id)} /> });
            actions.push({ key: 'i1', size: 'md', el: <IconBtn tip="Edit" icon={Pencil} onClick={() => window.location.href = `/invoices/new?type=quote&edit=${inv.id}`} /> });
            actions.push({ key: 'i2', size: 'md', el: <LinkIconBtn tip="View" icon={Eye} href={viewUrl} /> });
            actions.push({ key: 'i3', size: 'md', el: <LinkIconBtn tip="Download" icon={Download} href={downloadUrl} /> });
            
            menuItems.push({ key: 'convert', label: 'Convert to Invoice', icon: <ArrowRightLeft className="w-4 h-4 text-[#64748B]"/>, onClick: () => handleConvert(inv.id) });
            menuItems.push({ key: 'share', label: 'Share link', icon: <Share2 className="w-4 h-4 text-[#64748B]"/>, onClick: () => handleShare(inv.id) });
            menuItems.push({ key: 'email', label: 'Email quote', icon: <Mail className="w-4 h-4 text-[#64748B]"/>, onClick: () => handleSendEmail(inv.id) });
          } else {
            // Sent Quote (Awaiting Conversion)
            actions.push({ key: 'pri', size: 'lg', el: <PrimaryBtn cls="bg-[#16A34A] text-white shadow-[0_2px_6px_rgba(22,163,74,.22)] hover:bg-[#15803D]" icon={ArrowRightLeft} label="Convert" onClick={() => handleConvert(inv.id)} /> });
            actions.push({ key: 'i1', size: 'md', el: <IconBtn tip="Edit" icon={Pencil} onClick={() => window.location.href = `/invoices/new?type=quote&edit=${inv.id}`} /> });
            actions.push({ key: 'i2', size: 'md', el: <LinkIconBtn tip="View" icon={Eye} href={viewUrl} /> });
            actions.push({ key: 'i3', size: 'md', el: <LinkIconBtn tip="Download" icon={Download} href={downloadUrl} /> });

            menuItems.push({ key: 'share', label: 'Share link', icon: <Share2 className="w-4 h-4 text-[#64748B]"/>, onClick: () => handleShare(inv.id) });
            menuItems.push({ key: 'email', label: 'Email quote', icon: <Mail className="w-4 h-4 text-[#64748B]"/>, onClick: () => handleSendEmail(inv.id) });
          }
        } else if (!isSent) {
          actions.push({ key: 'pri', size: 'lg', el: <PrimaryBtn cls="bg-[#F97316] text-white shadow-[0_2px_6px_rgba(249,115,22,.25)] hover:bg-[#EA580C]" icon={Send} label="Send" onClick={() => handleSendEmail(inv.id)} /> });
          actions.push({ key: 'i1', size: 'md', el: <IconBtn tip="Edit" icon={Pencil} onClick={() => window.location.href = `/invoices/new?type=${inv.type}&edit=${inv.id}`} /> });
          actions.push({ key: 'i2', size: 'md', el: <LinkIconBtn tip="View" icon={Eye} href={viewUrl} /> });
          actions.push({ key: 'i3', size: 'md', el: <LinkIconBtn tip="Download" icon={Download} href={downloadUrl} /> });
          
          menuItems.push({ key: 'share', label: 'Share link', icon: <Share2 className="w-4 h-4 text-[#64748B]"/>, onClick: () => handleShare(inv.id) });
          menuItems.push({ key: 'email', label: 'Email invoice', icon: <Mail className="w-4 h-4 text-[#64748B]"/>, onClick: () => handleSendEmail(inv.id) });
        } else if (isOverdue) {
          actions.push({ key: 'pri', size: 'lg', el: <PrimaryBtn cls="bg-[#F97316] text-white shadow-[0_2px_6px_rgba(249,115,22,.25)] hover:bg-[#EA580C]" icon={Send} label="Remind" onClick={() => { handleSendEmail(inv.id); onAction('reminder'); }} /> });
          actions.push({ key: 'i1', size: 'md', el: <IconBtn tip="Mark paid" icon={CheckCircle2} extraCls="text-[#16A34A] border-[#A7F3C6] hover:bg-[#ECFDF3]" onClick={() => { handleUpdateStatus(inv.id, inv.payment_status); showToast('Marked as paid'); }} /> });
          actions.push({ key: 'i2', size: 'md', el: <LinkIconBtn tip="View" icon={Eye} href={viewUrl} /> });
          actions.push({ key: 'i3', size: 'md', el: <LinkIconBtn tip="Download" icon={Download} href={downloadUrl} /> });

          menuItems.push({ key: 'share', label: 'Share link', icon: <Share2 className="w-4 h-4 text-[#64748B]"/>, onClick: () => handleShare(inv.id) });
          menuItems.push({ key: 'email', label: 'Email invoice', icon: <Mail className="w-4 h-4 text-[#64748B]"/>, onClick: () => handleSendEmail(inv.id) });
          menuItems.push({ key: 'unsent', label: 'Mark unsent', icon: <RotateCcw className="w-4 h-4 text-[#64748B]"/>, onClick: () => { setInvoices(p => p.map(i => i.id === inv.id ? { ...i, delivery_status: 'unsent' } : i)); pendingStatusChanges.set(inv.id, 'unsent'); showToast('Marked as unsent'); } });
        } else if (isPaid) {
          actions.push({ key: 'pri', size: 'lg', el: <div className="w-[118px] flex-shrink-0 flex items-stretch"><a href={viewUrl} target="_blank" rel="noreferrer" onClick={() => onAction('view')} className="w-full h-[34px] px-[12px] rounded-[9px] border border-[#E9EDF3] bg-white text-[#0F172A] inline-flex items-center justify-center gap-[7px] text-[13px] font-[700] whitespace-nowrap hover:bg-[#F5F6F8] transition-colors"><Eye className="w-[15px] h-[15px]" /> View</a></div> });
          actions.push({ key: 'i1', size: 'md', el: <LinkIconBtn tip="Download receipt" icon={Download} href={downloadUrl} /> });
          actions.push({ key: 'i2', size: 'md', el: <IconBtn tip="Share link" icon={Share2} onClick={() => handleShare(inv.id)} /> });

          menuItems.push({ key: 'email', label: 'Email invoice', icon: <Mail className="w-4 h-4 text-[#64748B]"/>, onClick: () => handleSendEmail(inv.id) });
        } else {
          // Awaiting
          actions.push({ key: 'pri', size: 'lg', el: <PrimaryBtn cls="bg-[#16A34A] text-white shadow-[0_2px_6px_rgba(22,163,74,.22)] hover:bg-[#15803D]" icon={CheckCircle2} label="Mark paid" onClick={() => { handleUpdateStatus(inv.id, inv.payment_status); showToast('Marked as paid'); }} /> });
          actions.push({ key: 'i1', size: 'md', el: <IconBtn tip="Send reminder" icon={Send} onClick={() => { handleSendEmail(inv.id); onAction('reminder'); }} /> });
          actions.push({ key: 'i2', size: 'md', el: <LinkIconBtn tip="View" icon={Eye} href={viewUrl} /> });
          actions.push({ key: 'i3', size: 'md', el: <LinkIconBtn tip="Download" icon={Download} href={downloadUrl} /> });

          menuItems.push({ key: 'share', label: 'Share link', icon: <Share2 className="w-4 h-4 text-[#64748B]"/>, onClick: () => handleShare(inv.id) });
          menuItems.push({ key: 'email', label: 'Email invoice', icon: <Mail className="w-4 h-4 text-[#64748B]"/>, onClick: () => handleSendEmail(inv.id) });
        }

        if (inv.type !== 'quote' && !isFailed && !isProcessing) {
          menuItems.push({ 
            key: 'toggle-sent', label: 'Mark as Sent', icon: <Send className="w-4 h-4 text-[#64748B]"/>, isToggle: true, checked: isSent, 
            onClick: () => { const newStatus = isSent ? 'unsent' : 'sent'; setInvoices(p => p.map(i => i.id === inv.id ? { ...i, delivery_status: newStatus } : i)); pendingStatusChanges.set(inv.id, newStatus); showToast(isSent ? 'Marked as unsent' : 'Marked as sent'); } 
          });
          menuItems.push({ 
            key: 'toggle-paid', label: 'Mark as Paid', icon: <CheckCircle2 className="w-4 h-4 text-[#64748B]"/>, isToggle: true, checked: isPaid, 
            onClick: () => { handleUpdateStatus(inv.id, inv.payment_status); showToast(isPaid ? 'Marked as unpaid' : 'Marked as paid'); } 
          });
        }

        const lgActions = actions.filter(a => a.size === 'lg');
        const mdActions = actions.filter(a => a.size === 'md');

        const isHighlighted = highlightedInvoiceId === inv.id;

        return (
          <div className={`flex justify-end items-center gap-[8px] transition-all ${isHighlighted ? 'animate-glass-magnify z-[70] relative p-[2px] -m-[2px]' : ''}`}>
            {/* Desktop (lg) shows all */}
            <div className="hidden lg:flex items-center justify-end gap-[8px] w-full min-w-[286px]">
              {lgActions.map(a => <span key={a.key}>{a.el}</span>)}
              {mdActions.map(a => <span key={a.key}>{a.el}</span>)}
              
              <div className="relative flex-shrink-0">
                <button data-overflow-trigger data-tooltip onClick={(e) => { e.stopPropagation(); const next = menuOpen ? null : inv.id; menuRef.current = next; setMobileActionsId(next); }} className="w-[34px] h-[34px] inline-flex items-center justify-center rounded-[9px] border border-[#E9EDF3] bg-white text-[#64748B] hover:bg-[#F5F6F8] hover:text-[#0F172A] hover:border-[#D8DFE9] transition-colors relative">
                  <MoreHorizontal className="w-[16px] h-[16px]" />
                  <span className="icon-tip absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#16233A] text-white text-[11px] font-semibold px-[9px] py-[5px] rounded-md whitespace-nowrap opacity-0 transition-opacity pointer-events-none z-40 before:content-[''] before:absolute before:top-full before:left-1/2 before:-translate-x-1/2 before:border-[5px] before:border-transparent before:border-t-[#16233A]">More</span>
                </button>
                {menuOpen && (
                  <div data-overflow-menu onClick={(e) => e.stopPropagation()} className="absolute top-full right-0 mt-[6px] min-w-[206px] bg-white border border-[#E9EDF3] rounded-[12px] shadow-[0_12px_34px_rgba(15,23,42,.16)] p-[6px] z-50 animate-in fade-in slide-in-from-top-2 duration-100">
                    {menuItems.map(item => (
                      <button key={item.key} onClick={(e) => { e.preventDefault(); e.stopPropagation(); item.onClick(); if (!item.isToggle) setMobileActionsId(null); }} className={`flex items-center justify-between w-full px-[11px] py-[9px] rounded-[8px] bg-transparent border-none text-[13.5px] font-[600] text-left hover:bg-[#F5F6F8] transition-colors ${item.danger ? 'text-[#DC2626] hover:bg-[#FEECEC]' : 'text-[#0F172A]'}`}>
                        <div className="flex items-center gap-[11px]">
                          {item.icon} {item.label}
                        </div>
                        {item.isToggle && (
                          <div className={`w-[28px] h-[16px] rounded-full flex items-center px-[2px] transition-colors ${item.checked ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'}`}>
                            <div className={`w-[12px] h-[12px] bg-white rounded-full transition-transform duration-200 ${item.checked ? 'translate-x-[12px]' : 'translate-x-0'}`} />
                          </div>
                        )}
                      </button>
                    ))}
                    <div className="h-px bg-[#E9EDF3] mx-[4px] my-[5px]" />
                    <button onClick={() => { setDeleteModal({ isOpen: true, id: inv.id }); setMobileActionsId(null); }} className="flex items-center gap-[11px] w-full px-[11px] py-[9px] rounded-[8px] bg-transparent border-none text-[13.5px] font-[600] text-[#DC2626] text-left hover:bg-[#FEECEC] transition-colors"><Trash2 className="w-[16px] h-[16px] text-[#DC2626]" /> Delete</button>
                  </div>
                )}
              </div>
            </div>

            {/* Tablet (md) shows primary + 1 icon. The rest move to menu. */}
            <div className="hidden md:flex lg:hidden items-center justify-end gap-[8px]">
              {lgActions.map(a => <span key={a.key}>{a.el}</span>)}
              {mdActions.slice(0, 1).map(a => <span key={a.key}>{a.el}</span>)}
              
              <div className="relative flex-shrink-0">
                <button data-overflow-trigger onClick={(e) => { e.stopPropagation(); const next = menuOpen ? null : inv.id; menuRef.current = next; setMobileActionsId(next); }} className="w-[34px] h-[34px] inline-flex items-center justify-center rounded-[9px] border border-[#E9EDF3] bg-white text-[#64748B] hover:bg-[#F5F6F8] transition-colors">
                  <MoreHorizontal className="w-[16px] h-[16px]" />
                </button>
                {menuOpen && (
                  <div data-overflow-menu onClick={(e) => e.stopPropagation()} className="absolute top-full right-0 mt-[6px] min-w-[206px] bg-white border border-[#E9EDF3] rounded-[12px] shadow-[0_12px_34px_rgba(15,23,42,.16)] p-[6px] z-50 animate-in fade-in slide-in-from-top-2 duration-100">
                    <div className="flex gap-[4px] px-[4px] py-[2px] mb-[4px]">
                      {mdActions.slice(1).map(a => (
                        <div key={a.key}>{a.el}</div>
                      ))}
                    </div>
                    <div className="h-px bg-[#E9EDF3] mx-[4px] my-[5px]" />
                    {menuItems.map(item => (
                      <button key={item.key} onClick={(e) => { e.preventDefault(); e.stopPropagation(); item.onClick(); if (!item.isToggle) setMobileActionsId(null); }} className={`flex items-center justify-between w-full px-[11px] py-[9px] rounded-[8px] bg-transparent border-none text-[13.5px] font-[600] text-left hover:bg-[#F5F6F8] transition-colors ${item.danger ? 'text-[#DC2626] hover:bg-[#FEECEC]' : 'text-[#0F172A]'}`}>
                        <div className="flex items-center gap-[11px]">
                          {item.icon} {item.label}
                        </div>
                        {item.isToggle && (
                          <div className={`w-[28px] h-[16px] rounded-full flex items-center px-[2px] transition-colors ${item.checked ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'}`}>
                            <div className={`w-[12px] h-[12px] bg-white rounded-full transition-transform duration-200 ${item.checked ? 'translate-x-[12px]' : 'translate-x-0'}`} />
                          </div>
                        )}
                      </button>
                    ))}
                    <div className="h-px bg-[#E9EDF3] mx-[4px] my-[5px]" />
                    <button onClick={() => { setDeleteModal({ isOpen: true, id: inv.id }); setMobileActionsId(null); }} className="flex items-center gap-[11px] w-full px-[11px] py-[9px] rounded-[8px] bg-transparent border-none text-[13.5px] font-[600] text-[#DC2626] text-left hover:bg-[#FEECEC] transition-colors"><Trash2 className="w-[16px] h-[16px] text-[#DC2626]" /> Delete</button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile (sm) shows primary only. All icons move to menu. */}
            <div className="flex md:hidden items-center justify-end gap-[8px] w-full mt-2 lg:mt-0">
              {lgActions.map(a => <span key={a.key} className="flex-1 max-w-[150px]">{a.el}</span>)}
              
              <div className="relative flex-shrink-0">
                <button data-overflow-trigger onClick={(e) => { e.stopPropagation(); const next = menuOpen ? null : inv.id; menuRef.current = next; setMobileActionsId(next); }} className="w-[34px] h-[34px] inline-flex items-center justify-center rounded-[9px] border border-[#E9EDF3] bg-white text-[#64748B] hover:bg-[#F5F6F8] transition-colors">
                  <MoreHorizontal className="w-[16px] h-[16px]" />
                </button>
                {menuOpen && (
                  <div data-overflow-menu onClick={(e) => e.stopPropagation()} className="absolute bottom-full right-0 mb-[6px] min-w-[206px] bg-white border border-[#E9EDF3] rounded-[12px] shadow-[0_12px_34px_rgba(15,23,42,.16)] p-[6px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-100">
                    <div className="flex flex-wrap gap-[4px] px-[4px] py-[2px] mb-[4px]">
                      {mdActions.map(a => <div key={a.key}>{a.el}</div>)}
                    </div>
                    <div className="h-px bg-[#E9EDF3] mx-[4px] my-[5px]" />
                    {menuItems.map(item => (
                      <button key={item.key} onClick={(e) => { e.preventDefault(); e.stopPropagation(); item.onClick(); if (!item.isToggle) setMobileActionsId(null); }} className={`flex items-center justify-between w-full px-[11px] py-[9px] rounded-[8px] bg-transparent border-none text-[13.5px] font-[600] text-left hover:bg-[#F5F6F8] transition-colors ${item.danger ? 'text-[#DC2626] hover:bg-[#FEECEC]' : 'text-[#0F172A]'}`}>
                        <div className="flex items-center gap-[11px]">
                          {item.icon} {item.label}
                        </div>
                        {item.isToggle && (
                          <div className={`w-[28px] h-[16px] rounded-full flex items-center px-[2px] transition-colors ${item.checked ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'}`}>
                            <div className={`w-[12px] h-[12px] bg-white rounded-full transition-transform duration-200 ${item.checked ? 'translate-x-[12px]' : 'translate-x-0'}`} />
                          </div>
                        )}
                      </button>
                    ))}
                    <div className="h-px bg-[#E9EDF3] mx-[4px] my-[5px]" />
                    <button onClick={() => { setDeleteModal({ isOpen: true, id: inv.id }); setMobileActionsId(null); }} className="flex items-center gap-[11px] w-full px-[11px] py-[9px] rounded-[8px] bg-transparent border-none text-[13.5px] font-[600] text-[#DC2626] text-left hover:bg-[#FEECEC] transition-colors"><Trash2 className="w-[16px] h-[16px] text-[#DC2626]" /> Delete</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      }
    }
  ], [invoices, selectedIds, convertingId, loadingId, canUseQuotes, showPaymentToggle, mobileActionsId]);

  const columns = useMemo(() => {
    return showActions ? allColumns : allColumns.filter((col: any) => col.id !== 'actions');
  }, [allColumns, showActions]);

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
      {/* Bulk Actions Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#16233A] text-white px-5 py-3 rounded-full flex items-center gap-4 shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-200">
          <div className="flex items-center gap-2 pr-4 border-r border-[#2A3952]">
            <span className="text-[13px] font-bold bg-[#2A3952] px-2 py-0.5 rounded-full">{selectedIds.length}</span>
            <span className="text-[13px] font-medium text-slate-300">selected</span>
          </div>
          <button onClick={() => { setSelectedIds([]); toast.success(`Marked ${selectedIds.length} invoices as paid`, { style: { background: '#16233A', color: '#fff', border: 'none', borderRadius: '11px' }, icon: <span className="text-[#4ADE80] font-bold text-lg">●</span> }); }} className="text-[13px] font-bold text-slate-200 hover:text-white transition-colors">Mark Paid</button>
          <button onClick={() => { setSelectedIds([]); toast.success(`Marked ${selectedIds.length} invoices as sent`, { style: { background: '#16233A', color: '#fff', border: 'none', borderRadius: '11px' }, icon: <span className="text-[#4ADE80] font-bold text-lg">●</span> }); }} className="text-[13px] font-bold text-slate-200 hover:text-white transition-colors">Mark Sent</button>
          <button onClick={() => { setSelectedIds([]); toast.error(`Deleted ${selectedIds.length} invoices`, { style: { background: '#FEF2F2', color: '#991B1B', border: '1px solid #FEE2E2', borderRadius: '11px' } }); }} className="text-[13px] font-bold text-red-400 hover:text-red-300 transition-colors">Delete</button>
          <button onClick={() => setSelectedIds([])} className="ml-2 text-slate-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
      )}

      <UnifiedShareModal
        isOpen={unifiedModal.isOpen}
        onClose={() => setUnifiedModal({ isOpen: false, invoiceId: '', invoiceNumber: '', clientEmail: '' })}
        invoiceId={unifiedModal.invoiceId}
        invoiceNumber={unifiedModal.invoiceNumber}
        clientEmail={unifiedModal.clientEmail}
        shareSlug={unifiedModal.shareSlug}
        pdfUrl={unifiedModal.pdfUrl}
        initialTab={unifiedModal.initialTab}
      />

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
          
          {/* Mobile filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="md:hidden flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-ink-200 rounded-lg text-xs font-bold text-ink-600 hover:bg-ink-50"
          >
            <Columns className="w-3.5 h-3.5" />
            Filters
          </button>

          <div className={`flex flex-wrap items-center gap-2 w-full md:w-auto ${showFilters ? '' : 'hidden md:flex'}`}>
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
              <>
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 bg-white border border-ink-200 rounded-lg text-sm outline-none cursor-pointer font-bold text-ink-600"
                >
                  <option value="">All Types</option>
                  <option value="invoice">Invoices</option>
                  <option value="quote">Quotes</option>
                </select>
                <select 
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 bg-white border border-ink-200 rounded-lg text-sm outline-none cursor-pointer"
                >
                  <option value="">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="overdue">Overdue</option>
                  <option value="draft">Draft (Quote)</option>
                  <option value="converted">Converted (Quote)</option>
                </select>
              </>
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
            {(search || statusFilter || currencyFilter || typeFilter || dateType) && (
              <button
                onClick={() => { setSearch(''); setStatusFilter(''); setCurrencyFilter(''); setTypeFilter(''); setDateType(''); setDateValue(''); setPage(1); }}
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

      <div className="w-full flex-1 overflow-hidden max-w-[1400px] mx-auto relative group">

        {canScrollLeft && (
          <>
            <div className="absolute left-0 top-0 bottom-4 w-10 bg-gradient-to-r from-white via-white/80 to-transparent z-[15] pointer-events-none" />
            <button onClick={() => scrollContainerRef.current?.scrollBy({ left: -250, behavior: 'smooth' })} className="absolute left-0 top-0 bottom-4 w-16 z-20 flex items-center justify-start pl-2 opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)] flex items-center justify-center text-ink-600 hover:text-ink-900 border border-ink-100"><ChevronLeft className="w-5 h-5" /></div>
            </button>
          </>
        )}
        {canScrollRight && (
          <>
            <div className="absolute right-0 top-0 bottom-4 w-10 bg-gradient-to-l from-white via-white/80 to-transparent z-[15] pointer-events-none" />
            <button onClick={() => scrollContainerRef.current?.scrollBy({ left: 250, behavior: 'smooth' })} className="absolute right-0 top-0 bottom-4 w-16 z-20 flex items-center justify-end pr-2 opacity-100 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)] flex items-center justify-center text-ink-600 hover:text-ink-900 border border-ink-100"><ChevronRight className="w-5 h-5" /></div>
            </button>
          </>
        )}

        <div ref={scrollContainerRef} onScroll={checkScroll} className="overflow-x-auto pb-4 no-scrollbar w-full">
          
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="text-[11px] font-[800] uppercase tracking-[0.5px] text-slate-500 border-t border-b border-ink-100 bg-[#FBFCFD]">
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      className={`py-3 px-4 font-[800] cursor-pointer hover:bg-ink-100/50 transition-colors ${header.column.getCanSort() ? 'select-none' : ''} ${(header.column.columnDef.meta as any)?.className || ''}`}
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
                <tr key={row.id} className={`group bg-white hover:bg-[#FCFCFD] transition-colors ${selectedIds.includes(row.original.id) ? 'bg-brand-50/30' : ''}`}>
                  {row.getVisibleCells().map(cell => (
                    <td 
                      key={cell.id} 
                      className={`py-3 px-4 min-h-[64px] ${cell.column.id === 'actions' ? 'text-right' : ''} ${(cell.column.id === 'actions' && mobileActionsId === row.original.id) ? 'relative z-[60]' : ''} ${(cell.column.columnDef.meta as any)?.className || ''}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {invoices.length === 0 && !loading && (
            <div className="py-24 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-ink-50 rounded-full flex items-center justify-center mb-4">
                <Inbox className="w-8 h-8 text-ink-300" />
              </div>
              <h3 className="text-[15px] font-[800] text-ink-900 mb-1">No invoices found</h3>
              <p className="text-[13px] text-ink-500 max-w-[250px]">
                {search || statusFilter !== 'all' ? 'Try adjusting your filters to find what you are looking for.' : 'Get started by creating your first invoice or quote.'}
              </p>
            </div>
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
