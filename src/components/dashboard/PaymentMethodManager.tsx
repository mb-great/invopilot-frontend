'use client';

import { useState } from 'react';
import { Plus, Trash2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

export type PaymentMethod = {
  id: string;
  type: string;
  title: string;
  details: string;
  qrUrl?: string;
};

interface PaymentMethodManagerProps {
  methods: PaymentMethod[];
  onChange: (methods: PaymentMethod[]) => void;
  disabled?: boolean;
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

export default function PaymentMethodManager({ methods = [], onChange, disabled }: PaymentMethodManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newMethod, setNewMethod] = useState<Partial<PaymentMethod>>({ type: 'paypal' });

  const handleAdd = () => {
    if (!newMethod.title || !newMethod.details) {
      toast.error('Title and details are required');
      return;
    }
    const method: PaymentMethod = {
      id: crypto.randomUUID(),
      type: newMethod.type || 'custom',
      title: newMethod.title,
      details: newMethod.details,
      qrUrl: newMethod.qrUrl
    };
    onChange([...methods, method]);
    setIsAdding(false);
    setNewMethod({ type: 'paypal' });
  };

  const handleRemove = (id: string) => {
    onChange(methods.filter(m => m.id !== id));
  };

  return (
    <div className="space-y-4">
      {methods.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {methods.map((method) => (
            <div key={method.id} className="border border-neutral-200 rounded-xl p-4 bg-white relative group">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600">{method.type}</span>
                {!disabled && (
                  <button 
                    type="button" 
                    onClick={() => handleRemove(method.id)}
                    className="text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <h6 className="font-bold text-ink-900">{method.title}</h6>
              <p className="text-sm text-ink-500 mt-1 truncate" title={method.details}>{method.details}</p>
            </div>
          ))}
        </div>
      )}

      {isAdding ? (
        <div className="border border-brand-200 bg-brand-50/30 rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase font-bold text-muted mb-1 tracking-widest">Method Type</label>
              <select 
                value={newMethod.type} 
                onChange={e => setNewMethod({ ...newMethod, type: e.target.value })}
                className="w-full rounded-lg px-4 py-2.5 border border-neutral-200 bg-white text-sm focus:outline-none focus:border-brand-500"
              >
                {METHOD_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase font-bold text-muted mb-1 tracking-widest">Display Title</label>
              <input 
                type="text" 
                placeholder="e.g. Pay via PayPal" 
                value={newMethod.title || ''}
                onChange={e => setNewMethod({ ...newMethod, title: e.target.value })}
                className="w-full rounded-lg px-4 py-2.5 border border-neutral-200 bg-white text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs uppercase font-bold text-muted mb-1 tracking-widest">Details / Link / Address</label>
              <input 
                type="text" 
                placeholder="paypal.me/username or @venmo" 
                value={newMethod.details || ''}
                onChange={e => setNewMethod({ ...newMethod, details: e.target.value })}
                className="w-full rounded-lg px-4 py-2.5 border border-neutral-200 bg-white text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm font-bold text-ink-500 hover:bg-neutral-100 rounded-lg transition-colors">Cancel</button>
            <button type="button" onClick={handleAdd} className="px-4 py-2 text-sm font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-lg shadow-sm transition-colors">Save Method</button>
          </div>
        </div>
      ) : (
        !disabled && (
          <button 
            type="button" 
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 w-full py-3 border border-dashed border-neutral-300 rounded-xl text-sm font-bold text-ink-500 hover:text-brand-600 hover:border-brand-300 hover:bg-brand-50 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Payment Method
          </button>
        )
      )}
    </div>
  );
}
