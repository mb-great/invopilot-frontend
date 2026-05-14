'use client';

import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  title: string;
  message: string;
  confirmLabel: string;
  isDestructive?: boolean;
  requirePassword?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  isDestructive = false,
  requirePassword = true
}: ConfirmationModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (requirePassword && !password) {
      alert("Please enter your password to confirm.");
      return;
    }
    setLoading(true);
    await onConfirm(password);
    setLoading(false);
    setPassword('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-ink-100 animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className={`p-2 rounded-lg ${isDestructive ? 'bg-red-50 text-red-500' : 'bg-brand-50 text-brand-500'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <button onClick={onClose} className="text-ink-400 hover:text-ink-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-xl font-bold text-ink-900 mb-2">{title}</h3>
          <p className="text-ink-500 text-sm leading-relaxed mb-6">{message}</p>

          {requirePassword && (
            <div className="mb-6">
              <label className="block text-xs font-bold text-ink-400 uppercase tracking-widest mb-2">
                Confirm with your password
              </label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-ink-200 px-4 py-3 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10 transition-all"
                autoFocus
              />
            </div>
          )}

          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-ink-200 text-ink-600 font-bold hover:bg-ink-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className={`flex-1 px-4 py-3 rounded-xl text-white font-bold transition-all flex items-center justify-center gap-2 ${
                isDestructive ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20' : 'bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/20'
              }`}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
