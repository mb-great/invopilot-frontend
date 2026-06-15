"use client";

import { useFormContext } from "react-hook-form";
import { useEffect, useState } from "react";
import PaymentMethodModal, { SelectedPaymentMethod } from "./PaymentMethodModal";
import { toast } from "sonner";
import { Pencil, X } from "lucide-react";
import { resolvePlanAccess } from "@/lib/billing/tiers";

export const PaymentDetailsForm = ({ profile }: { profile: any }) => {
  const { setValue, getValues } = useFormContext();
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const access = resolvePlanAccess(profile);
  const canUseUpiQr = access.plan.canUseUpiQr || access.isAdmin;

  const [methods, setMethods] = useState<SelectedPaymentMethod[]>(() => {
    try {
      const stored = getValues("selectedMethods");
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });

  const persistMethods = (next: SelectedPaymentMethod[]) => {
    setMethods(next);
    setValue("selectedMethods", next, { shouldDirty: true });
    localStorage.setItem("selectedMethods", JSON.stringify(next));
  };

  const syncBankFields = (detail: Record<string, string>) => {
    const fieldMap: Record<string, string> = {
      bankName: 'bankName',
      accountNumber: 'accountNumber',
      accountName: 'accountName',
      ifscCode: 'ifscCode',
      routingCode: 'routingCode',
      swiftCode: 'swiftCode',
    };
    for (const [key, field] of Object.entries(fieldMap)) {
      if (detail[key] !== undefined) {
        setValue(field, detail[key], { shouldDirty: true });
        localStorage.setItem(field, detail[key]);
      }
    }
  };

  const clearBankFields = () => {
    const fields = ['bankName', 'accountNumber', 'accountName', 'ifscCode', 'routingCode', 'swiftCode'];
    for (const f of fields) {
      setValue(f, '', { shouldDirty: true });
      localStorage.setItem(f, '');
    }
  };

  const syncUpiFields = (detail: { upiId: string; showQr: boolean; lockAmount: boolean }) => {
    setValue('upiId', detail.upiId, { shouldDirty: true });
    localStorage.setItem('upiId', detail.upiId);
    setValue('showUpiQr', detail.showQr, { shouldDirty: true });
    localStorage.setItem('showUpiQr', String(detail.showQr));
    setValue('upiLockAmount', detail.lockAmount, { shouldDirty: true });
    localStorage.setItem('upiLockAmount', String(detail.lockAmount));
  };

  const clearUpiFields = () => {
    setValue('upiId', '', { shouldDirty: true });
    localStorage.setItem('upiId', '');
  };

  useEffect(() => {
    const handleBankDetails = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const newMethod: SelectedPaymentMethod = {
        id: 'bank-details',
        title: 'Bank Details',
        value: [detail.accountName, detail.bankName].filter(Boolean).join(' · ') || 'Bank Details',
        color: '#1a56db',
        badge: '🏦',
      };

      const next = editingIndex !== null
        ? methods.map((m, i) => i === editingIndex ? newMethod : m)
        : [...methods, newMethod];

      persistMethods(next);
      syncBankFields(detail);
      setEditingIndex(null);
      toast.success(editingIndex !== null ? 'Bank Details updated' : 'Bank Details added');
    };

    const handleUpi = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const newMethod: SelectedPaymentMethod = {
        id: 'upi',
        title: 'UPI',
        value: detail.upiId,
        color: '#5f259f',
        badge: 'UPI',
      };

      const next = editingIndex !== null
        ? methods.map((m, i) => i === editingIndex ? newMethod : m)
        : [...methods, newMethod];

      persistMethods(next);
      syncUpiFields(detail);
      setEditingIndex(null);
      toast.success(editingIndex !== null ? 'UPI updated' : 'UPI added');
    };

    window.addEventListener('paymentMethod:bankDetails', handleBankDetails);
    window.addEventListener('paymentMethod:upi', handleUpi);
    return () => {
      window.removeEventListener('paymentMethod:bankDetails', handleBankDetails);
      window.removeEventListener('paymentMethod:upi', handleUpi);
    };
  }, [methods, editingIndex]);

  const handleAdd = (method: SelectedPaymentMethod) => {
    if (editingIndex !== null) {
      const next = [...methods];
      const oldMethod = next[editingIndex];
      next[editingIndex] = method;
      persistMethods(next);

      if (oldMethod?.id === 'bank-details' && method.id !== 'bank-details') clearBankFields();
      if (oldMethod?.id === 'upi' && method.id !== 'upi') clearUpiFields();
      if (method.id === 'bank-details') {
        try {
          const detail = JSON.parse(method.value);
          syncBankFields(detail);
        } catch {}
      }
      if (method.id === 'upi') {
        syncUpiFields({ upiId: method.value, showQr: true, lockAmount: false });
      }
      setEditingIndex(null);
    } else {
      const next = [...methods, method];
      persistMethods(next);
      if (method.id === 'bank-details') {
        try {
          const detail = JSON.parse(method.value);
          syncBankFields(detail);
        } catch {}
      }
      if (method.id === 'upi') {
        syncUpiFields({ upiId: method.value, showQr: true, lockAmount: false });
      }
    }
  };

  const handleRemove = (index: number) => {
    const method = methods[index];
    const next = [...methods];
    next.splice(index, 1);
    persistMethods(next);

    if (method?.id === 'bank-details') clearBankFields();
    if (method?.id === 'upi') clearUpiFields();
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setShowModal(true);
  };

  return (
    <div className="pt-4">
      <p className="text-2xl font-semibold pb-3">Payment Details</p>

      <div className="space-y-3">
        <h4 className="font-bold text-sm text-ink-900 flex items-center gap-1.5">
          Payment Methods
          <span className="text-[11px] font-normal text-gray-500">(Max 3)</span>
        </h4>

        {methods.map((m, i) => (
          <div
            key={`${m.id}-${i}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-[#161618] border border-[#262629]"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white shrink-0 text-xs"
              style={{ backgroundColor: m.color }}
            >
              {m.badge}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#f4f4f5] truncate">{m.title}</p>
              <p className="text-xs text-[#8b8b91] truncate">{m.value}</p>
            </div>
            <button
              type="button"
              onClick={() => handleEdit(i)}
              className="w-7 h-7 rounded-full bg-[#262629] flex items-center justify-center text-[#8b8b91] hover:text-blue-400 hover:bg-blue-400/10 transition-colors shrink-0"
              title="Edit"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="w-7 h-7 rounded-full bg-[#262629] flex items-center justify-center text-[#8b8b91] hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {methods.length < 3 && (
          <button
            type="button"
            onClick={() => {
              setEditingIndex(null);
              setShowModal(true);
            }}
            className="w-full py-3 rounded-xl border border-dashed border-[#3a3a3e] text-[#8b8b91] text-sm font-semibold hover:border-[#f97316] hover:text-[#f97316] transition-colors"
          >
            + Add Payment Method
          </button>
        )}

        <PaymentMethodModal
          open={showModal}
          onClose={() => { setShowModal(false); setEditingIndex(null); }}
          onAdd={handleAdd}
          existingCount={methods.length}
          isPremium={canUseUpiQr}
        />

        {methods.length > 0 && (
          <span className="text-xs text-gray-500 mt-1 block">
            {methods.length}/3 methods added.
          </span>
        )}
      </div>
    </div>
  );
};
