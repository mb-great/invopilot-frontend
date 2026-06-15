'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, CreditCard, ChevronRight, X, Check, QrCode, Building2 } from 'lucide-react';

type PaymentMethod = {
  id: string;
  type: string;
  title: string;
  details: string;
  qrUrl?: string;
};

type BusinessProfile = {
  id: string;
  name: string;
  logoUrl?: string;
  methods?: PaymentMethod[];
  deletedAt?: string;
};

interface PaymentMethodsClientProps {
  businesses: BusinessProfile[];
  workspaceId: string;
  userId: string;
}

const METHOD_TYPES = [
  { id: 'upi', label: 'UPI / QR Code' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'stripe', label: 'Stripe' },
  { id: 'wise', label: 'Wise' },
  { id: 'venmo', label: 'Venmo' },
  { id: 'cashapp', label: 'Cash App' },
  { id: 'crypto', label: 'Crypto Wallet' },
  { id: 'custom', label: 'Custom / Other' }
];

const METHOD_COLORS: Record<string, string> = {
  upi: 'bg-purple-100 text-purple-700 border-purple-200',
  paypal: 'bg-blue-100 text-blue-700 border-blue-200',
  stripe: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  wise: 'bg-green-100 text-green-700 border-green-200',
  venmo: 'bg-sky-100 text-sky-700 border-sky-200',
  cashapp: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  crypto: 'bg-amber-100 text-amber-700 border-amber-200',
  custom: 'bg-ink-100 text-ink-600 border-ink-200',
};

export default function PaymentMethodsClient({ businesses, workspaceId, userId }: PaymentMethodsClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [expandedBizId, setExpandedBizId] = useState<string | null>(null);
  const [editingBizId, setEditingBizId] = useState<string | null>(null);
  const [editingMethods, setEditingMethods] = useState<PaymentMethod[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newMethod, setNewMethod] = useState<Partial<PaymentMethod>>({ type: 'paypal' });
  const [saving, setSaving] = useState(false);

  const activeBusinesses = businesses.filter(b => !b.deletedAt);

  const handleExpand = (bizId: string) => {
    if (expandedBizId === bizId) {
      setExpandedBizId(null);
      setEditingBizId(null);
    } else {
      setExpandedBizId(bizId);
      const biz = activeBusinesses.find(b => b.id === bizId);
      setEditingBizId(bizId);
      setEditingMethods(biz?.methods || []);
      setIsAdding(false);
    }
  };

  const handleAddMethod = () => {
    if (!newMethod.title || !newMethod.details) {
      toast.error('Title and details are required');
      return;
    }
    const method: PaymentMethod = {
      id: crypto.randomUUID(),
      type: newMethod.type || 'custom',
      title: newMethod.title,
      details: newMethod.details,
      qrUrl: newMethod.qrUrl,
    };
    setEditingMethods([...editingMethods, method]);
    setIsAdding(false);
    setNewMethod({ type: 'paypal' });
  };

  const handleRemoveMethod = (id: string) => {
    setEditingMethods(editingMethods.filter(m => m.id !== id));
  };

  const handleSave = async () => {
    if (!expandedBizId) return;
    setSaving(true);

    const updatedBusinesses = businesses.map(b => {
      if (b.id === expandedBizId) {
        return { ...b, methods: editingMethods };
      }
      return b;
    });

    const { error } = await supabase
      .from('workspaces')
      .update({ businesses: updatedBusinesses })
      .eq('id', workspaceId);

    if (error) {
      toast.error('Failed to save payment methods');
      console.error(error);
    } else {
      toast.success('Payment methods saved');
      setEditingBizId(null);
      setExpandedBizId(null);
      router.refresh();
    }
    setSaving(false);
  };

  const totalMethods = activeBusinesses.reduce((sum, b) => sum + (b.methods?.length || 0), 0);

  return (
    <div className="max-w-4xl">
      <div className="mb-12">
        <h1 className="text-5xl font-bold tracking-tighter mb-4 text-ink-900" style={{ fontFamily: 'var(--font-display)' }}>
          Payment Methods
        </h1>
        <p className="text-ink-500 text-xl">
          Manage payment methods for each business profile. These appear on your invoices.
        </p>
      </div>

      {activeBusinesses.length === 0 ? (
        <div className="glass-card p-12 bg-white border border-ink-100 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-ink-100 flex items-center justify-center mx-auto mb-6">
            <Building2 className="w-8 h-8 text-ink-400" />
          </div>
          <h3 className="text-xl font-bold text-ink-900 mb-2">No business profiles yet</h3>
          <p className="text-ink-500 mb-6">Create a business profile first to add payment methods.</p>
          <button
            onClick={() => router.push('/dashboard/settings')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600 transition-colors shadow-sm"
          >
            Go to Settings
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <span className="text-sm text-ink-500 font-bold">
              {activeBusinesses.length} business profile{activeBusinesses.length !== 1 ? 's' : ''} · {totalMethods} method{totalMethods !== 1 ? 's' : ''}
            </span>
          </div>

          {activeBusinesses.map(biz => {
            const methods = biz.methods || [];
            const isExpanded = expandedBizId === biz.id;
            const isEditing = editingBizId === biz.id;

            return (
              <div key={biz.id} className="glass-card bg-white border border-ink-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => handleExpand(biz.id)}
                  className="w-full flex items-center justify-between p-6 hover:bg-ink-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {biz.logoUrl ? (
                      <img src={biz.logoUrl} alt={biz.name} className="w-10 h-10 rounded-xl object-cover border border-ink-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm border border-brand-200">
                        {biz.name?.charAt(0)?.toUpperCase() || 'B'}
                      </div>
                    )}
                    <div className="text-left">
                      <h3 className="font-bold text-ink-900">{biz.name}</h3>
                      <p className="text-sm text-ink-500">
                        {methods.length === 0
                          ? 'No payment methods configured'
                          : `${methods.length} method${methods.length !== 1 ? 's' : ''} configured`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {methods.length > 0 && (
                      <div className="hidden sm:flex gap-1">
                        {methods.slice(0, 3).map(m => (
                          <span key={m.id} className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${METHOD_COLORS[m.type] || METHOD_COLORS.custom}`}>
                            {m.type}
                          </span>
                        ))}
                        {methods.length > 3 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-ink-100 text-ink-600">
                            +{methods.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                    <ChevronRight className={`w-5 h-5 text-ink-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-ink-100 p-6 bg-ink-50/30">
                    {methods.length === 0 && !isAdding ? (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center mx-auto mb-4">
                          <CreditCard className="w-6 h-6 text-ink-400" />
                        </div>
                        <p className="text-sm text-ink-500 mb-4">No payment methods added yet.</p>
                        <button
                          onClick={() => setIsAdding(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-brand-600 border border-dashed border-brand-300 rounded-xl hover:bg-brand-50 transition-colors"
                        >
                          <Plus className="w-4 h-4" /> Add first method
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {editingMethods.map(method => (
                          <div key={method.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-ink-100 group">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase border shrink-0 ${METHOD_COLORS[method.type] || METHOD_COLORS.custom}`}>
                                {method.type}
                              </span>
                              <div className="min-w-0">
                                <h4 className="font-bold text-ink-900 text-sm">{method.title}</h4>
                                <p className="text-xs text-ink-500 truncate" title={method.details}>{method.details}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              {method.qrUrl && (
                                <QrCode className="w-4 h-4 text-ink-400" />
                              )}
                              <button
                                onClick={() => handleRemoveMethod(method.id)}
                                className="p-1.5 text-ink-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}

                        {isAdding ? (
                          <div className="border border-brand-200 bg-brand-50/30 rounded-xl p-4 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-ink-500 mb-1 tracking-widest">Method Type</label>
                                <select
                                  value={newMethod.type}
                                  onChange={e => setNewMethod({ ...newMethod, type: e.target.value })}
                                  className="w-full rounded-lg px-3 py-2 border border-ink-200 bg-white text-sm focus:outline-none focus:border-brand-500"
                                >
                                  {METHOD_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] uppercase font-bold text-ink-500 mb-1 tracking-widest">Display Title</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Pay via PayPal"
                                  value={newMethod.title || ''}
                                  onChange={e => setNewMethod({ ...newMethod, title: e.target.value })}
                                  className="w-full rounded-lg px-3 py-2 border border-ink-200 bg-white text-sm focus:outline-none focus:border-brand-500"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-[10px] uppercase font-bold text-ink-500 mb-1 tracking-widest">Details / Link / Address</label>
                                <input
                                  type="text"
                                  placeholder="paypal.me/username or @venmo"
                                  value={newMethod.details || ''}
                                  onChange={e => setNewMethod({ ...newMethod, details: e.target.value })}
                                  className="w-full rounded-lg px-3 py-2 border border-ink-200 bg-white text-sm focus:outline-none focus:border-brand-500"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm font-bold text-ink-500 hover:bg-ink-100 rounded-lg transition-colors">Cancel</button>
                              <button onClick={handleAddMethod} className="px-4 py-2 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-lg shadow-sm transition-colors">Add Method</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setIsAdding(true)}
                            className="flex items-center justify-center gap-2 w-full py-3 border border-dashed border-ink-300 rounded-xl text-sm font-bold text-ink-500 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                          >
                            <Plus className="w-4 h-4" /> Add Payment Method
                          </button>
                        )}

                        <div className="flex justify-end gap-3 pt-2">
                          <button
                            onClick={() => { setExpandedBizId(null); setEditingBizId(null); setIsAdding(false); }}
                            className="px-4 py-2 text-sm font-bold text-ink-500 hover:bg-ink-100 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-5 py-2 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
