'use client';

import { format } from 'date-fns';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Search, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { ShareDialog } from './ShareDialog';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

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
  form_data?: {
    [key: string]: any;
  };
}

export interface Meta {
  total?: number; // Optional, might come from cached profile metrics
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
  targetUserId
}: { 
  invoices: Invoice[], 
  initialMeta?: Meta,
  showHeader?: boolean,
  showPaymentToggle?: boolean,
  availableCurrencies?: string[],
  targetUserId?: string
}) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [meta, setMeta] = useState<Meta>(initialMeta || { page: 1, limit: 10, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const isFirstRender = useRef(true);
  
  // Modal State
  const [shareData, setShareData] = useState<{ isOpen: boolean; url: string }>({ isOpen: false, url: '' });
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at.desc');
  const [page, setPage] = useState(1);

  // Date Filtering
  const [dateType, setDateType] = useState('');
  const [dateValue, setDateValue] = useState('');

  const fetchInvoices = useCallback(async () => {
    // Optimization: Skip fetching on mount if we already have initial data and defaults
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
        status: statusFilter,
        currency: currencyFilter,
        dateType,
        dateValue,
        sort: sortBy,
        tzOffset: new Date().getTimezoneOffset().toString()
      });
      if (targetUserId) {
        params.append('userId', targetUserId);
      }
      const res = await fetch(`/api/invoices?${params}`);
      const result = await res.json();
      if (res.ok) {
        setInvoices(result.data);
        // Merge new meta with totalPages from initialMeta if not provided by API
        setMeta(prev => ({
          ...result.meta,
          totalPages: prev.totalPages // Keep the cached total pages
        }));
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, currencyFilter, dateType, dateValue, sortBy, targetUserId]);

  useEffect(() => {
    // Immediate fetch for dropdowns/filters whenever they change
    // The fetchInvoices function already handles skipping the very first redundant mount fetch
    fetchInvoices();
  }, [statusFilter, currencyFilter, dateType, dateValue, sortBy, page, fetchInvoices]);

  useEffect(() => {
    // Debounced fetch for text search to avoid excessive API calls while typing
    const timer = setTimeout(() => {
      if (!isFirstRender.current) {
        fetchInvoices();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchInvoices]);

  const handleUpdateStatus = async (id: string, currentStatus: string) => {
    try {
      setLoadingId(id);
      // Logic: paid -> sent (Unmark), everything else -> paid (Mark Paid)
      const newStatus = currentStatus === 'paid' ? 'sent' : 'paid';
      const res = await fetch(`/api/invoices/${id}/status`, { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: newStatus })
      });
      
      if (!res.ok) throw new Error('Update failed');
      
      setInvoices(prev => prev.map(inv => 
        inv.id === id ? { ...inv, payment_status: newStatus } : inv
      ));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
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

  const handleDelete = async (password: string) => {
    if (!deleteModal.id) return;
    
    try {
      setLoadingId(deleteModal.id);
      
      const verifyRes = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json();
        alert(errData.error || "Invalid password. Deletion cancelled.");
        return;
      }

      const res = await fetch(`/api/invoices/${deleteModal.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      
      setInvoices(prev => prev.filter(inv => inv.id !== deleteModal.id));
      setDeleteModal({ isOpen: false, id: null });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setLoadingId(null);
    }
  };

  const getPaymentStatusClass = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-500 text-white border-emerald-600';
      case 'sent': return 'bg-brand-500/10 text-brand-600 border-brand-500/20';
      case 'overdue': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'draft': return 'bg-ink-100 text-ink-600 border-ink-200';
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

  return (
    <div className="w-full space-y-4">
      <ShareDialog 
        isOpen={shareData.isOpen} 
        onClose={() => setShareData({ ...shareData, isOpen: false })} 
        shareUrl={shareData.url} 
      />

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Invoice"
        message="⚠️ This will permanently delete this invoice and all associated PDF records. This action cannot be undone and may affect your tax records."
        confirmLabel="Confirm Delete"
        isDestructive={true}
      />

      {showHeader && (
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-bold text-ink-900">Invoices</h2>
          <a 
            href="/invoices/new"
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.clear();
              }
            }}
            className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-600 transition-all shadow-lg shadow-brand-500/20 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            New Invoice
          </a>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-4 px-4 py-3 bg-ink-50/50 rounded-xl border border-ink-100">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input 
              type="text" 
              placeholder="Search invoices..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-white border border-ink-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Date Filters */}
            <div className="flex items-center gap-2 bg-white border border-ink-200 rounded-lg px-2 py-1">
              <select 
                value={dateType}
                onChange={(e) => { setDateType(e.target.value); setPage(1); }}
                className="bg-transparent text-[11px] font-bold text-ink-600 outline-none cursor-pointer uppercase tracking-tight"
              >
                <option value="">Any Date</option>
                <option value="issued">Issued Date</option>
                <option value="due">Due Date</option>
                <option value="generated">Gen Date</option>
              </select>
              <div className="w-px h-4 bg-ink-100" />
              <input 
                type="date"
                value={dateValue}
                onChange={(e) => { setDateValue(e.target.value); setPage(1); }}
                className="bg-transparent text-[11px] font-medium text-ink-700 outline-none cursor-pointer"
              />
              {dateValue && (
                <button 
                  onClick={() => { setDateValue(''); setPage(1); }}
                  className="text-ink-300 hover:text-ink-600 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              )}
            </div>

            {availableCurrencies.length > 1 && (
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
            <select 
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-white border border-ink-200 rounded-lg text-sm outline-none cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="sent">Unpaid</option>
            </select>
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
            {loading && <Loader2 className="w-4 h-4 animate-spin text-brand-600" />}
          </div>
        </div>
      </div>

      <div className="w-full overflow-hidden">
        <div className="overflow-x-auto pb-4 no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px] table-fixed">
            <thead>
              <tr className="text-ink-400 text-[10px] uppercase tracking-widest border-b border-ink-100 bg-ink-50/30">
                <th className="py-3 px-4 font-bold w-auto">Invoice</th>
                <th className="py-3 px-4 font-bold w-[140px]">Amount</th>
                <th className="py-3 px-4 font-bold w-[160px]">Dates</th>
                <th className="py-3 px-4 font-bold w-[100px] text-center">Status</th>
                <th className="py-3 px-4 font-bold w-[280px] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {invoices.map((inv) => (
                <tr key={inv.id} className="group hover:bg-ink-50/50 transition-colors">
                  <td className="py-4 px-4 font-bold text-ink-900 truncate">
                    <div className="flex flex-col min-w-0">
                      <span className="truncate" title={inv.nickname || 'Unnamed Invoice'}>{inv.nickname || 'Unnamed Invoice'}</span>
                      <span className="text-[10px] text-ink-400 font-mono uppercase mt-0.5">{inv.invoice_number || inv.id.slice(0, 8)}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-bold text-ink-900 whitespace-nowrap">
                    {formatCurrency(inv.amount || 0, inv.currency)}
                  </td>
                  <td className="py-4 px-4 text-ink-500 whitespace-nowrap">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] uppercase font-bold text-ink-300 w-8">Issue</span>
                        <span className="text-[11px] font-medium text-ink-700">
                          {safeDate(inv.issue_date || inv.form_data?.issueDate, 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] uppercase font-bold text-ink-300 w-8">Due</span>
                        <span className="text-[11px] font-medium text-ink-700">
                          {safeDate(inv.due_date || inv.form_data?.dueDate, 'MMM d, yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] uppercase font-bold text-ink-300 w-8">Gen</span>
                        <span className="text-[10px] font-medium text-ink-400 italic">
                          {safeDate(inv.created_at, 'MMM d, p')}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border inline-block uppercase tracking-wider ${getPaymentStatusClass(inv.payment_status)}`}>
                        {inv.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                      {inv.status !== 'done' && (
                        <span className="text-[9px] text-ink-400 italic">PDF: {inv.status}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex justify-end items-center gap-1">
                      {inv.status === 'done' ? (
                        <>
                          <a 
                            href={`/api/invoices/${inv.id}/download?view=1`} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-ink-500 hover:text-brand-600 text-[11px] font-bold px-2 py-1"
                          >
                            View
                          </a>
                          <a 
                            href={`/api/invoices/${inv.id}/download`} 
                            className="text-ink-500 hover:text-brand-600 text-[11px] font-bold px-2 py-1"
                          >
                            Get
                          </a>
                          
                          <button 
                            onClick={() => handleShare(inv.id)}
                            className="text-brand-600 hover:text-brand-700 text-[11px] font-bold px-2 py-1"
                          >
                            Share
                          </button>

                          {showPaymentToggle && (
                            <button 
                              onClick={() => handleUpdateStatus(inv.id, inv.payment_status)}
                              disabled={loadingId === inv.id}
                              className={`text-[11px] font-bold px-2 py-1 transition-colors min-w-[75px] text-center ${
                                inv.payment_status === 'paid' 
                                ? 'text-ink-400 hover:text-ink-600' 
                                : 'text-emerald-600 hover:text-emerald-700'
                              }`}
                            >
                              {inv.payment_status === 'paid' ? 'Unmark' : 'Mark Paid'}
                            </button>
                          )}

                          <button 
                            onClick={() => setDeleteModal({ isOpen: true, id: inv.id })}
                            disabled={loadingId === inv.id}
                            className="p-1.5 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 text-ink-400 px-4 min-w-[200px] justify-end">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-[10px] font-medium uppercase tracking-tight">Processing PDF</span>
                        </div>
                      )}
                    </div>
                  </td>
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
                  `Page ${page}`
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
                <span className="text-xs font-bold text-ink-900 mx-2">
                  Page {page} {meta.totalPages && `of ${Math.min(meta.totalPages, 50)}`}
                </span>
                <button 
                  disabled={page === (meta.totalPages ? Math.min(meta.totalPages, 50) : 50) || meta.isCapped || loading}
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
