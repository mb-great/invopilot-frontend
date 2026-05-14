'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

interface UserStats {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  total_invoices_generated: number;
  isDeleted?: boolean;
}

interface PaginationMeta {
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

export default function AdminTable({ 
  users: initialUsers,
  pagination 
}: { 
  users: UserStats[],
  pagination: PaginationMeta
}) {
  const [users, setUsers] = useState(initialUsers);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [userMetrics, setUserMetrics] = useState<Record<string, { top_currencies: CurrencyStats[], other_currencies: CurrencyStats[] } | null>>({});
  const [metricsLoading, setMetricsLoading] = useState<string | null>(null);
  const [roleModal, setRoleModal] = useState<{ isOpen: boolean; user: UserStats | null }>({ isOpen: false, user: null });

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/admin?${params.toString()}`);
  };

  const fetchUserMetrics = async (userId: string) => {
    if (userMetrics[userId]) return; // Already loaded

    try {
      setMetricsLoading(userId);
      const res = await fetch(`/api/admin/users/${userId}/metrics`);
      if (!res.ok) throw new Error('Failed to fetch metrics');
      const data = await res.json();
      setUserMetrics(prev => ({ ...prev, [userId]: data }));
    } catch (err) {
      console.error(err);
    } finally {
      setMetricsLoading(null);
    }
  };

  const handleExpand = (userId: string) => {
    if (expandedId === userId) {
      setExpandedId(null);
    } else {
      setExpandedId(userId);
      fetchUserMetrics(userId);
    }
  };

  const handleToggleRole = async (password: string) => {
    if (!roleModal.user) return;
    const targetUser = roleModal.user;
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';

    try {
      setLoadingId(targetUser.id);
      
      const verifyRes = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json();
        alert(errData.error || "Invalid admin password. Action cancelled.");
        return;
      }

      const res = await fetch(`/api/admin/users/${targetUser.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update role');
      }

      const { data: updatedUser } = await res.json();
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? { ...u, role: updatedUser.role } : u));
      setRoleModal({ isOpen: false, user: null });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setLoadingId(null);
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

  return (
    <div className="w-full space-y-4">
      <ConfirmationModal
        isOpen={roleModal.isOpen}
        onClose={() => setRoleModal({ isOpen: false, user: null })}
        onConfirm={handleToggleRole}
        title={roleModal.user?.role === 'admin' ? 'Demote Administrator' : 'Promote to Administrator'}
        message={`Are you sure you want to change the role for ${roleModal.user?.email}? This will ${roleModal.user?.role === 'admin' ? 'remove' : 'grant'} administrative privileges including full database access and user management.`}
        confirmLabel={roleModal.user?.role === 'admin' ? 'Demote User' : 'Promote User'}
        isDestructive={roleModal.user?.role === 'admin'}
      />

      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/30">
              <th className="py-4 px-4 font-bold text-ink-400 text-[10px] uppercase tracking-widest">User</th>
              <th className="py-4 px-4 font-bold text-ink-400 text-[10px] uppercase tracking-widest text-right">Lifetime Generated</th>
              <th className="py-4 px-4 font-bold text-ink-400 text-[10px] uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-50">
            {users.map((user) => (
              <React.Fragment key={user.id}>
                <tr 
                  className={`group hover:bg-ink-50/50 transition-colors cursor-pointer ${user.isDeleted ? 'opacity-70 bg-ink-50/20' : ''}`} 
                  onClick={() => handleExpand(user.id)}
                >
                  <td className="py-4 px-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink-900">{user.full_name || 'Anonymous'}</span>
                        {user.isDeleted && (
                          <span className="text-[8px] font-bold bg-ink-900 text-white px-1.5 py-0.5 rounded uppercase tracking-widest">Archive</span>
                        )}
                      </div>
                      <span className="text-xs text-ink-400">{user.email}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right font-bold text-ink-900">
                    {user.total_invoices_generated.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button className="text-brand-600 hover:text-brand-700 transition-colors text-xs font-bold uppercase tracking-wider">
                      {expandedId === user.id ? 'Close' : 'Details'}
                    </button>
                  </td>
                </tr>
                {expandedId === user.id && (
                  <tr className="bg-ink-50/20">
                    <td colSpan={3} className="p-0">
                      <div className="p-6 border-l-4 border-brand-500 bg-white/50 backdrop-blur-sm animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="grid md:grid-cols-2 gap-8">
                          {/* Info Column */}
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-ink-400 uppercase tracking-[0.2em] mb-4">Account Profile</h4>
                            <div className="space-y-2 text-sm">
                              <p className="flex justify-between border-b border-ink-100 pb-2">
                                <span className="text-ink-500">User ID</span>
                                <span className="font-mono text-[10px] text-ink-900">{user.id}</span>
                              </p>
                              <p className="flex justify-between border-b border-ink-100 pb-2">
                                <span className="text-ink-500">{user.isDeleted ? 'Date Deleted' : 'Date Joined'}</span>
                                <span className="text-ink-900 font-medium">{new Date(user.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                              </p>
                              <p className="flex justify-between border-b border-ink-100 pb-2">
                                <span className="text-ink-500">Access Role</span>
                                <span className={`uppercase font-bold text-[10px] px-2 py-0.5 rounded ${user.isDeleted ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-700'}`}>
                                  {user.isDeleted ? 'ARCHIVED' : user.role}
                                </span>
                              </p>
                            </div>
                            
                            {!user.isDeleted && (
                              <div className="pt-4 space-y-3">
                                <Link 
                                  href={`/admin/users/${user.id}`}
                                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-ink-900 text-white rounded-xl font-bold text-xs transition-all hover:bg-black uppercase tracking-widest shadow-lg shadow-black/10"
                                >
                                  View Full Profile & Invoices
                                </Link>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRoleModal({ isOpen: true, user });
                                  }}
                                  disabled={loadingId === user.id}
                                  className={`w-full px-4 py-3 rounded-xl font-bold text-xs transition-all border shadow-sm disabled:opacity-50 uppercase tracking-widest ${
                                    user.role === 'admin' 
                                      ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white' 
                                      : 'bg-brand-50 text-brand-600 border-brand-100 hover:bg-brand-600 hover:text-white'
                                  }`}
                                >
                                  {loadingId === user.id ? 'Updating...' : user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                                </button>
                              </div>
                            )}

                            {user.isDeleted && (
                              <div className="pt-4">
                                <div className="p-4 rounded-xl bg-ink-50 border border-ink-100 text-[10px] text-ink-500 italic leading-relaxed">
                                  This account was permanently deleted. All associated invoices and private data have been purged from the active system. Metrics preserved for historical reporting only.
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Metrics Column */}
                          <div>
                            <h4 className="text-[10px] font-bold text-ink-400 uppercase tracking-[0.2em] mb-4">Financial Summary</h4>
                            {metricsLoading === user.id ? (
                              <div className="flex flex-col items-center justify-center py-12 gap-3">
                                <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
                                <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest">Loading metrics...</span>
                              </div>
                            ) : userMetrics[user.id] ? (
                              <div className="space-y-4">
                                {userMetrics[user.id]?.top_currencies.map((c) => (
                                  <div key={c.currency} className="glass-card p-4 space-y-3">
                                    <div className="flex justify-between items-center border-b border-ink-100 pb-2 mb-2">
                                      <span className="font-bold text-ink-900">{c.currency}</span>
                                      <span className="text-[10px] font-bold text-ink-400">{c.invoice_count} invoices</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <div className="text-[9px] font-bold text-ink-400 uppercase tracking-wider mb-1">Revenue</div>
                                        <div className="text-sm font-bold text-emerald-600">{formatCurrency(c.paid, c.currency)}</div>
                                      </div>
                                      <div>
                                        <div className="text-[9px] font-bold text-ink-400 uppercase tracking-wider mb-1">Outstanding</div>
                                        <div className="text-sm font-bold text-brand-600">{formatCurrency(c.outstanding, c.currency)}</div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {userMetrics[user.id]?.top_currencies.length === 0 && (
                                  <div className="py-8 text-center text-ink-400 italic text-xs">
                                    No transaction data available for this user.
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="py-8 text-center text-ink-400 italic text-xs">
                                Failed to load metrics.
                              </div>
                            )}
                            
                            <div className="mt-4 p-4 rounded-xl bg-ink-50 border border-ink-100">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] font-bold text-ink-400 uppercase tracking-wider">InvoPilot Revenue (v1)</span>
                                <span className="text-sm font-bold text-ink-900">₹0</span>
                              </div>
                              <p className="text-[8px] text-ink-400 mt-1 italic">Calculated as platform service fees from this user.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-ink-50/30 border-t border-ink-100 rounded-b-xl">
          <div className="text-xs text-ink-400 font-medium">
            Showing <span className="text-ink-900 font-bold">{users.length}</span> of <span className="text-ink-900 font-bold">{pagination.totalCount}</span> users
          </div>
          <div className="flex items-center gap-2">
            <button 
              disabled={pagination.currentPage === 1}
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              className="p-1.5 rounded-lg border border-ink-200 bg-white text-ink-600 disabled:opacity-50 hover:bg-ink-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-ink-900 mx-2 uppercase tracking-widest text-[10px]">Page {pagination.currentPage} / {pagination.totalPages}</span>
            <button 
              disabled={pagination.currentPage === pagination.totalPages}
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              className="p-1.5 rounded-lg border border-ink-200 bg-white text-ink-600 disabled:opacity-50 hover:bg-ink-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
