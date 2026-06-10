'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import InvoiceTable from '@/components/dashboard/InvoiceTable';
import StatCards from '@/components/dashboard/StatCards';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function UserDetailsTabs({ 
  user, 
  invoices, 
  initialMeta,
  currentUserRole 
}: { 
  user: any, 
  invoices: any[], 
  initialMeta: any,
  currentUserRole: string 
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'financials' | 'audit' | 'actions'>('overview');
  
  const [metrics, setMetrics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal State
  const [roleModal, setRoleModal] = useState(false);
  const [subModal, setSubModal] = useState(false);
  const [subTier, setSubTier] = useState('business');
  const [subDuration, setSubDuration] = useState('1_month');
  
  const [nukeModal, setNukeModal] = useState(false);
  const [nukeReason, setNukeReason] = useState('');
  const [nukeSendEmail, setNukeSendEmail] = useState(true);

  const router = useRouter();

  // Fetch data when switching tabs
  useEffect(() => {
    if (activeTab === 'financials' && !metrics) {
      setLoadingMetrics(true);
      fetch(`/api/admin/users/${user.id}/metrics`)
        .then(res => res.json())
        .then(data => setMetrics(data))
        .catch(e => console.error(e))
        .finally(() => setLoadingMetrics(false));
    }
    
    if (activeTab === 'audit' && auditLogs.length === 0) {
      setLoadingAudit(true);
      fetch(`/api/admin/users/${user.id}/audit`)
        .then(res => res.json())
        .then(data => setAuditLogs(data))
        .catch(e => console.error(e))
        .finally(() => setLoadingAudit(false));
    }
  }, [activeTab, user.id, metrics, auditLogs.length]);

  const handleToggleRole = async (password: string) => {
    try {
      setActionLoading(true);
      const verifyRes = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!verifyRes.ok) throw new Error("Invalid admin password.");

      const newRole = user.role === 'admin' ? 'user' : 'admin';
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) throw new Error('Failed to update role');

      toast.success('Role updated');
      setRoleModal(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStripSub = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/admin/users/${user.id}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'strip' })
      });
      if (!res.ok) throw new Error('Failed to strip');
      toast.success('Subscription stripped');
      router.refresh();
    } catch (err: any) { toast.error(err.message); } finally { setActionLoading(false); }
  };

  const isTargetSuperadmin = user.role === 'superadmin';
  const canModifyRole = currentUserRole === 'superadmin';
  const canModifySub = currentUserRole === 'superadmin' || !isTargetSuperadmin;

  return (
    <div className="space-y-6">
      <ConfirmationModal
        isOpen={roleModal}
        onClose={() => setRoleModal(false)}
        onConfirm={handleToggleRole}
        title={user.role === 'admin' || user.role === 'superadmin' ? 'Demote Administrator' : 'Promote to Administrator'}
        message={`Change role for ${user.email}?`}
        confirmLabel={user.role === 'admin' || user.role === 'superadmin' ? 'Demote' : 'Promote'}
        isDestructive={user.role === 'admin' || user.role === 'superadmin'}
      />

      <ConfirmationModal
        isOpen={subModal}
        onClose={() => setSubModal(false)}
        onConfirm={async () => {
          try {
            setActionLoading(true);
            const res = await fetch(`/api/admin/users/${user.id}/subscription`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'grant', duration: subDuration, tier: subTier })
            });
            if (!res.ok) throw new Error('Failed to grant subscription');
            toast.success(`Granted ${subTier}`);
            setSubModal(false);
            setAuditLogs([]); // Force refetch
            router.refresh();
          } catch(err: any) { toast.error(err.message); } finally { setActionLoading(false); }
        }}
        title="Grant Subscription Tier"
        message={`Grant tier to ${user.email}?`}
        confirmLabel="Grant"
      >
        <div className="mt-4 mb-2 space-y-4">
          <select value={subTier} onChange={e => setSubTier(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-ink-50">
            <option value="starter">Starter</option><option value="pro">Pro</option><option value="business">Business</option>
          </select>
          <select value={subDuration} onChange={e => setSubDuration(e.target.value)} className="w-full p-3 border rounded-xl font-bold bg-ink-50">
            <option value="1_month">1 Month</option><option value="1_year">1 Year</option><option value="lifetime">Lifetime</option>
          </select>
        </div>
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={nukeModal}
        onClose={() => setNukeModal(false)}
        onConfirm={async () => {
          try {
            setActionLoading(true);
            const res = await fetch(`/api/admin/users/${user.id}/subscription`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'nuke', reason: nukeReason, sendEmail: nukeSendEmail })
            });
            if (!res.ok) throw new Error('Failed to nuke subscription');
            toast.success('Subscription nuked');
            setNukeModal(false);
            setNukeReason('');
            setAuditLogs([]); // force refetch
            router.refresh();
          } catch(err: any) { toast.error(err.message); } finally { setActionLoading(false); }
        }}
        title="☢️ Nuke Subscription"
        message={`Hard-reset ALL subscription fields for ${user.email}?`}
        confirmLabel="Nuke"
        isDestructive={true}
      >
        <div className="mt-4 mb-2 space-y-4">
          <input type="text" value={nukeReason} onChange={e => setNukeReason(e.target.value)} placeholder="Reason for Nuking" className="w-full p-3 border rounded-xl" required />
          <label className="flex items-center gap-2 font-bold text-ink-600"><input type="checkbox" checked={nukeSendEmail} onChange={e => setNukeSendEmail(e.target.checked)} className="w-4 h-4 rounded text-brand-600" /> Send email</label>
        </div>
      </ConfirmationModal>

      {/* Tabs Header */}
      <div className="flex border-b border-ink-200 overflow-x-auto no-scrollbar">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'financials', label: 'Financials' },
          { id: 'audit', label: 'Audit Ledger' },
          { id: 'actions', label: 'Danger Zone' }
        ].map(t => (
          <button 
            key={t.id} 
            onClick={() => setActiveTab(t.id as any)} 
            className={`whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all ${
              activeTab === t.id 
                ? t.id === 'actions' ? 'border-b-2 border-red-500 text-red-600 bg-red-50/50' : 'border-b-2 border-brand-500 text-brand-600 bg-brand-50/50' 
                : 'text-ink-500 hover:text-ink-900 hover:bg-ink-50/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <h4 className="font-bold text-ink-900 mb-4 border-b border-ink-100 pb-2 text-sm uppercase tracking-widest">Account Overview</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-ink-50 pb-2"><span className="text-ink-500">User ID</span> <span className="font-mono text-xs">{user.id}</span></div>
                  <div className="flex justify-between border-b border-ink-50 pb-2"><span className="text-ink-500">Email</span> <span className="font-bold">{user.email}</span></div>
                  <div className="flex justify-between border-b border-ink-50 pb-2"><span className="text-ink-500">Role</span> <span className="font-bold uppercase tracking-widest text-[10px] bg-ink-100 px-2 py-0.5 rounded">{user.role}</span></div>
                  <div className="flex justify-between border-b border-ink-50 pb-2"><span className="text-ink-500">Joined</span> <span className="font-bold">{new Date(user.created_at).toLocaleDateString()}</span></div>
                </div>
              </div>

              <div className="glass-card p-6 border-brand-100 bg-gradient-to-br from-white to-brand-50/30">
                <h4 className="font-bold text-ink-900 mb-4 border-b border-ink-100 pb-2 text-sm uppercase tracking-widest flex items-center gap-2">
                  Subscription Status 
                  <span className={`px-2 py-0.5 rounded text-[10px] ${user.subscription_status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-600'}`}>{user.subscription_status || 'None'}</span>
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between border-b border-ink-50 pb-2"><span className="text-ink-500">Tier</span> <span className="font-bold uppercase tracking-widest text-brand-600">{user.tier || 'Free'}</span></div>
                  <div className="flex justify-between border-b border-ink-50 pb-2"><span className="text-ink-500">Source</span> <span className="font-bold capitalize">{user.subscription_source?.replace('_', ' ') || 'Self Bought'}</span></div>
                  {user.subscription_period_start && <div className="flex justify-between border-b border-ink-50 pb-2"><span className="text-ink-500">Active From</span> <span className="font-bold">{new Date(user.subscription_period_start).toLocaleDateString()}</span></div>}
                  {user.subscription_period_end && <div className="flex justify-between border-b border-ink-50 pb-2"><span className="text-ink-500">Active Till</span> <span className="font-bold">{new Date(user.subscription_period_end).toLocaleDateString()}</span></div>}
                </div>
              </div>
            </div>

            <div className="glass-card bg-white border border-ink-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-ink-100 bg-ink-50/30">
                <h3 className="font-bold text-ink-900 text-sm uppercase tracking-widest">User Invoices</h3>
              </div>
              <div className="p-2">
                <InvoiceTable invoices={invoices || []} initialMeta={initialMeta} showHeader={false} showPaymentToggle={false} targetUserId={user.id} />
              </div>
            </div>
          </div>
        )}

        {/* TAB: FINANCIALS */}
        {activeTab === 'financials' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {loadingMetrics ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-ink-300" /></div>
            ) : metrics ? (
              <StatCards topCurrencies={metrics.top_currencies} otherCurrencies={metrics.other_currencies} />
            ) : (
              <div className="py-20 text-center text-ink-400">Failed to load metrics</div>
            )}
          </div>
        )}

        {/* TAB: AUDIT LEDGER */}
        {activeTab === 'audit' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-4xl">
            {loadingAudit ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-ink-300" /></div>
            ) : auditLogs.length > 0 ? (
              <div className="space-y-4">
                {auditLogs.map(log => (
                  <div key={log.id} className="glass-card p-4 flex items-center gap-6">
                    <div className="w-24 shrink-0 border-r border-ink-100">
                      <div className="text-xs font-bold text-ink-900">{new Date(log.created_at).toLocaleDateString()}</div>
                      <div className="text-[10px] text-ink-400 uppercase">{new Date(log.created_at).toLocaleTimeString()}</div>
                    </div>
                    <div className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center bg-ink-50 text-xl border border-ink-100 shadow-sm">
                      {log.action === 'tier_granted' ? '🎁' : log.action === 'tier_nuked' ? '☢️' : log.action === 'user_banned' ? '🚫' : '💵'}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-ink-900 uppercase tracking-widest text-xs mb-1">{log.action.replace('_', ' ')}</h4>
                      <p className="text-sm text-ink-600">{log.reason || `Tier modified to ${log.tier}`}</p>
                    </div>
                    {log.admin && (
                      <div className="text-right shrink-0">
                        <div className="text-[10px] uppercase font-bold text-ink-400 tracking-widest">Admin</div>
                        <div className="text-xs font-bold text-ink-900">{log.admin.email}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-ink-400 border-2 border-dashed border-ink-100 rounded-2xl">
                <div className="text-4xl mb-2">📜</div>
                <h3 className="font-bold text-ink-900">No Audit Trail</h3>
                <p className="text-sm">No significant administrative actions have been logged for this user.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB: ACTIONS */}
        {activeTab === 'actions' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-2xl space-y-6">
            {!user.is_deleted ? (
              <>
                {canModifyRole && (
                  <div className="glass-card p-6 border-l-4 border-l-amber-500">
                    <h4 className="font-bold text-ink-900 mb-2 uppercase tracking-widest text-sm">Role Management</h4>
                    <p className="text-xs text-ink-500 mb-4">Promote this user to an administrator or demote them to a standard user. Administrators have full access to all system data.</p>
                    <button 
                      onClick={() => setRoleModal(true)} 
                      disabled={actionLoading || isTargetSuperadmin} 
                      className="px-6 py-3 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
                    >
                      {user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                    </button>
                  </div>
                )}
                
                {canModifySub && (
                  <div className="glass-card p-6 border-l-4 border-l-brand-500">
                    <h4 className="font-bold text-ink-900 mb-2 uppercase tracking-widest text-sm">Subscription Override</h4>
                    <p className="text-xs text-ink-500 mb-4">Manually grant a subscription tier (bypassing payment) or strip an existing subscription gracefully.</p>
                    <div className="flex gap-4">
                      <button 
                        onClick={() => handleStripSub()} 
                        disabled={actionLoading || user.tier === 'free'} 
                        className="px-6 py-3 bg-white border border-ink-200 text-ink-700 hover:bg-ink-50 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
                      >
                        Strip Tier
                      </button>
                      <button 
                        onClick={() => setSubModal(true)} 
                        disabled={actionLoading} 
                        className="px-6 py-3 bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
                      >
                        Grant Tier
                      </button>
                    </div>
                  </div>
                )}

                {canModifySub && (
                  <div className="glass-card p-6 border-l-4 border-l-red-500 bg-red-50/10">
                    <h4 className="font-bold text-red-900 mb-2 uppercase tracking-widest text-sm">Nuclear Option</h4>
                    <p className="text-xs text-red-700/70 mb-4">Hard-reset all subscription metadata for this user. This is an extreme measure and will permanently wipe their active subscription identifiers and revert them to free tier instantly.</p>
                    <button 
                      onClick={() => setNukeModal(true)} 
                      disabled={actionLoading || user.tier === 'free'} 
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
                    >
                      ☢️ Nuke Subscription
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 font-bold flex items-center gap-3">
                <span className="text-2xl">🗑️</span> User account has been permanently deleted. Actions are disabled.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
