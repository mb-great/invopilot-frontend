'use client';

import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, CreditCard, ChevronRight, Building2, Upload, Search, X, Pencil, QrCode } from 'lucide-react';
import LockedFeatureOverlay from '@/components/ui/LockedFeatureOverlay';
import { PAYMENT_METHODS, PM_MAP } from '@/lib/payment-methods';

export type SavedPaymentMethod = {
  id: string;
  title: string;
  value: string;
  qr?: string;
  color: string;
  badge: string;
  slug?: string;
};

type BusinessProfile = {
  id: string;
  name: string;
  logoUrl?: string;
  methods?: SavedPaymentMethod[];
  deletedAt?: string;
};

interface PaymentMethodsClientProps {
  businesses: BusinessProfile[];
  paymentMethods: SavedPaymentMethod[];
  workspaceId: string;
  userId: string;
  canSavePaymentMethods: boolean;
}


const MethodIcon = memo(function MethodIcon({ id, color, badge, slug, size = 32, className = '' }: { id: string; color: string; badge: string; slug?: string; size?: number; className?: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (id === 'bank-details') {
    return (
      <div className={`rounded-[12px] flex items-center justify-center font-bold text-white shrink-0 ${className}`} style={{ width: size, height: size, backgroundColor: '#1a56db' }}>
        🏦
      </div>
    );
  }
  if (id === 'upi') {
    return (
      <div className={`rounded-[12px] flex items-center justify-center font-bold text-white shrink-0 ${className}`} style={{ width: size, height: size, backgroundColor: '#5f259f' }}>
        UPI
      </div>
    );
  }
  if (slug && !imgFailed) {
    return (
      <img
        src={`https://cdn.simpleicons.org/${slug}`}
        alt={badge}
        className={`rounded-[12px] shrink-0 object-contain ${className}`}
        style={{ width: size, height: size }}
        onError={() => setImgFailed(true)}
      />
    );
  }
  return (
    <div className={`rounded-[12px] flex items-center justify-center font-bold text-white shrink-0 text-xs ${className}`} style={{ width: size, height: size, backgroundColor: color }}>
      {badge}
    </div>
  );
});

function MethodPickerModal({ onSelect, onClose, canUseUpi }: { onSelect: (id: string) => void; onClose: () => void; canUseUpi: boolean }) {
  const [search, setSearch] = useState('');
  const filtered = search
    ? PAYMENT_METHODS.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : PAYMENT_METHODS;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-[#08080a]/60" onClick={onClose}>
      <div className="bg-white rounded-[26px] shadow-[0_30px_80px_rgba(13,27,42,0.28)] w-full max-w-[540px] max-h-[85vh] flex flex-col overflow-hidden animate-[rise_0.2s_ease]" onClick={e => e.stopPropagation()}>
        <div className="p-6 pb-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-[24px] font-bold text-ink-900 leading-tight">Add a payment method</h2>
              <p className="text-[15px] text-gray-500 mt-1">Pick how your customers will pay you.</p>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-[#f2f3f5] flex items-center justify-center text-gray-500 hover:text-ink-900 hover:bg-[#e9ebee] transition-colors shrink-0">
              <X className="w-[17px] h-[17px] stroke-[2.2px]" />
            </button>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              type="text"
              placeholder="Search payment methods..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#f7f8fa] border-[1.5px] border-[#edeff2] rounded-[13px] py-[14px] pl-[46px] pr-4 text-[15px] text-ink-900 placeholder-[#b6bcc6] outline-none focus:border-brand-500 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ willChange: 'transform' }}>
          {!search && (
            <div className="space-y-1 mb-4">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Quick Setup</p>
              <button
                onClick={() => onSelect('bank-details')}
                className="w-full flex items-center gap-[15px] p-3 rounded-[14px] hover:bg-brand-50 transition-colors group text-left"
              >
                <div className="w-[44px] h-[44px] rounded-[12px] flex items-center justify-center font-bold text-white shrink-0 text-sm" style={{ backgroundColor: '#1a56db' }}>
                  🏦
                </div>
                <span className="text-[17px] font-semibold text-ink-900 flex-1">Bank Details</span>
                <ChevronRight className="w-[18px] h-[18px] text-gray-400 group-hover:text-brand-500 transition-colors" />
              </button>
              <button
                onClick={() => onSelect('upi')}
                className="w-full flex items-center gap-[15px] p-3 rounded-[14px] hover:bg-brand-50 transition-colors group text-left"
              >
                <div className="w-[44px] h-[44px] rounded-[12px] flex items-center justify-center font-bold text-white shrink-0 text-sm" style={{ backgroundColor: '#5f259f' }}>
                  UPI
                </div>
                <span className="text-[17px] font-semibold text-ink-900 flex-1">UPI</span>
                <ChevronRight className="w-[18px] h-[18px] text-gray-400 group-hover:text-brand-500 transition-colors" />
              </button>
            </div>
          )}

          {!search && (
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">All Methods</p>
          )}

          {filtered.length === 0 ? (
            <p className="text-[15px] text-gray-400 text-center py-8">No methods found.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map(method => (
                <button
                  key={method.id}
                  onClick={() => onSelect(method.id)}
                  className="w-full flex items-center gap-[15px] p-3 rounded-[14px] hover:bg-brand-50 transition-colors group text-left"
                >
                  <MethodIcon id={method.id} color={method.color} badge={method.badge} slug={method.slug || PM_MAP[method.id]?.slug} size={44} />
                  <span className="text-[17px] font-semibold text-ink-900 flex-1">{method.name}</span>
                  <ChevronRight className="w-[18px] h-[18px] text-gray-400 group-hover:text-brand-500 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PaymentMethodsClient({ businesses, paymentMethods, workspaceId, userId, canSavePaymentMethods }: PaymentMethodsClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const qrRef = useRef<HTMLInputElement>(null);

  const [localMethods, setLocalMethods] = useState<SavedPaymentMethod[]>(paymentMethods || []);
  useEffect(() => setLocalMethods(paymentMethods || []), [paymentMethods]);

  const activeBusinesses = businesses.filter(b => !b.deletedAt);

  const [saving, setSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    isEditing: boolean;
        methodIndex: number;
    typeId: string;
    title: string;
    value: string;
    qrPreview: string | null;
    bankDetails: {
      bankName: string;
      accountNumber: string;
      accountName: string;
      ifscCode: string;
      routingCode: string;
      swiftCode: string;
    };
  }>({
    isOpen: false,
    isEditing: false,
        methodIndex: -1,
    typeId: 'paypal',
    title: '',
    value: '',
    qrPreview: null,
    bankDetails: { bankName: '', accountNumber: '', accountName: '', ifscCode: '', routingCode: '', swiftCode: '' }
  });

  // Handle body scroll locking
  useEffect(() => {
    if (modalState.isOpen || showPicker) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [modalState.isOpen, showPicker]);

  const processImageToWebP = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === "image/svg+xml") {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read SVG"));
        reader.readAsDataURL(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) { reject(new Error("Failed to get canvas context")); return; }
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/webp", 0.8));
          } catch (err) { reject(err); }
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  if (!canSavePaymentMethods) {
    return (
      <div className="max-w-4xl">
        <div className="mb-12">
          <h1 className="text-5xl font-bold tracking-tighter mb-4 text-ink-900" style={{ fontFamily: 'var(--font-display)' }}>
            Payment Methods
          </h1>
          <p className="text-ink-500 text-xl">Manage payment methods for each business profile.</p>
        </div>
        <LockedFeatureOverlay featureName="Payment Methods" />
      </div>
    );
  }

  const handleSaveToDb = async (updatedMethods: SavedPaymentMethod[]) => {
    setSaving(true);
    setLocalMethods(updatedMethods);

    const { data: ws } = await supabase.from('workspaces').select('defaults').eq('id', workspaceId).single();
    const currentDefaults = ws?.defaults || {};

    const { error } = await supabase
      .from('workspaces')
      .update({ defaults: { ...currentDefaults, paymentMethods: updatedMethods } })
      .eq('id', workspaceId);

    if (error) {
      toast.error('Failed to save');
      setLocalMethods(paymentMethods || []);
    } else {
      toast.success('Payment methods updated');
      router.refresh();
    }
    setSaving(false);
  };

  const handleOpenAdd = () => {
    setModalState({
      isOpen: true,
      isEditing: false,
      methodIndex: -1,
      typeId: 'paypal',
      title: 'PayPal',
      value: '',
      qrPreview: null,
      bankDetails: { bankName: '', accountNumber: '', accountName: '', ifscCode: '', routingCode: '', swiftCode: '' }
    });
  };

  const handleOpenEdit = (method: SavedPaymentMethod, methodIndex: number) => {
    let bd = { bankName: '', accountNumber: '', accountName: '', ifscCode: '', routingCode: '', swiftCode: '' };
    let val = method.value;

    if (method.id === 'bank-details') {
      try {
        const parsed = JSON.parse(method.value);
        bd = { ...bd, ...parsed };
        val = ''; // Not used for bank directly
      } catch {
        // Fallback if it wasn't valid JSON
      }
    }

    setModalState({
      isOpen: true,
      isEditing: true,
      methodIndex: methodIndex,
      typeId: method.id,
      title: method.title,
      value: val,
      qrPreview: method.qr || null,
      bankDetails: bd
    });
  };

  const handleDelete = async (methodIndex: number) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;
    const updated = localMethods.filter((_, i) => i !== methodIndex);
    await handleSaveToDb(updated);
  };

  const handleModalSave = async () => {
    let finalValue = modalState.value.trim();
    let finalTitle = modalState.title.trim();

    if (modalState.typeId === 'bank-details') {
      const { bankName, accountNumber, accountName, ifscCode, routingCode, swiftCode } = modalState.bankDetails;
      const parts = [bankName, accountNumber, accountName, ifscCode, routingCode, swiftCode].filter(Boolean);
      if (parts.length === 0) {
        toast.error('Enter at least one bank detail');
        return;
      }
      finalValue = JSON.stringify(modalState.bankDetails);
      if (!finalTitle) {
        finalTitle = 'Bank Details';
      }
    } else {
      if (!finalTitle || !finalValue) {
        toast.error('Title and details are required');
        return;
      }
    }
    
    let color = '#666';
    let badge = modalState.typeId.toUpperCase().slice(0, 2);
    let slug = '';

    if (modalState.typeId === 'bank-details') {
      color = '#1a56db';
      badge = '🏦';
    } else if (modalState.typeId === 'upi') {
      color = '#5f259f';
      badge = 'UPI';
    } else {
      const pmInfo = PM_MAP[modalState.typeId];
      if (pmInfo) {
        color = pmInfo.color;
        badge = pmInfo.badge;
        slug = pmInfo.slug;
      }
    }

    const newMethod: SavedPaymentMethod = {
      id: modalState.typeId,
      title: finalTitle,
      value: finalValue,
      qr: modalState.qrPreview || undefined,
      color,
      badge,
      slug,
    };

    const updated = [...localMethods];
    if (modalState.isEditing) {
      updated[modalState.methodIndex] = newMethod;
    } else {
      updated.push(newMethod);
    }

    setModalState(prev => ({ ...prev, isOpen: false }));
    await handleSaveToDb(updated);
  };

  const handlePickType = (id: string) => {
    let defaultTitle = id;
    if (id === 'bank-details') defaultTitle = 'Bank Details';
    else if (id === 'upi') defaultTitle = 'UPI';
    else if (PM_MAP[id]) defaultTitle = PM_MAP[id].name;

    setModalState(prev => ({
      ...prev,
      typeId: id,
      title: defaultTitle,
      value: '', // Reset value when type changes
      bankDetails: { bankName: '', accountNumber: '', accountName: '', ifscCode: '', routingCode: '', swiftCode: '' }
    }));
    setShowPicker(false);
  };

  const renderValueText = (m: SavedPaymentMethod) => {
    if (m.id === 'bank-details') {
      try {
        const d = JSON.parse(m.value);
        return [d.accountName, d.bankName].filter(Boolean).join(' · ') || 'Bank Details';
      } catch {
        return m.value; // Fallback
      }
    }
    return m.value;
  };

  const pmInfo = PM_MAP[modalState.typeId];
  let methodDisplayName = modalState.typeId;
  if (modalState.typeId === 'bank-details') methodDisplayName = 'Bank Details';
  else if (modalState.typeId === 'upi') methodDisplayName = 'UPI';
  else if (pmInfo) methodDisplayName = pmInfo.name;

  return (
    <div className="max-w-5xl">
      {showPicker && <MethodPickerModal onSelect={handlePickType} onClose={() => setShowPicker(false)} canUseUpi={true} />}

      {modalState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#08080a]/60" onClick={() => setModalState(p => ({ ...p, isOpen: false }))}>
          <div className="bg-white rounded-[26px] shadow-[0_30px_80px_rgba(13,27,42,0.28)] w-full max-w-[620px] max-h-[90vh] flex flex-col overflow-hidden animate-[rise_0.2s_ease]" onClick={e => e.stopPropagation()}>
            <div className="p-[30px] pb-0">
              <div className="flex items-start justify-between mb-[26px]">
                <div className="flex items-start gap-4">
                  <div className="w-[56px] h-[56px] rounded-[16px] bg-white border border-[#eef0f3] flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(13,27,42,0.06)] overflow-hidden p-2">
                    <MethodIcon 
                      id={modalState.typeId} 
                      color={modalState.typeId === 'bank-details' ? '#1a56db' : modalState.typeId === 'upi' ? '#5f259f' : (pmInfo?.color || '#666')} 
                      badge={modalState.typeId === 'bank-details' ? '🏦' : modalState.typeId === 'upi' ? 'UPI' : (pmInfo?.badge || '?')} 
                      slug={pmInfo?.slug}
                      size={40} 
                    />
                  </div>
                  <div>
                    <h2 className="text-[24px] font-bold text-ink-900 leading-[1.1]">{modalState.isEditing ? 'Edit' : 'New'} {methodDisplayName}</h2>
                    <p className="text-[15px] text-gray-500 mt-[6px]">Update your payment method information.</p>
                  </div>
                </div>
                <button onClick={() => setModalState(p => ({ ...p, isOpen: false }))} className="w-[40px] h-[40px] rounded-full bg-[#f2f3f5] flex items-center justify-center text-gray-500 hover:bg-[#e9ebee] hover:text-ink-900 transition-colors shrink-0">
                  <X className="w-[17px] h-[17px] stroke-[2.2px]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-[32px] pb-[20px] space-y-[20px]">
              

              <div>
                <label className="block text-[15px] font-semibold text-ink-900 mb-[9px]">Method Type</label>
                <button
                  onClick={() => setShowPicker(true)}
                  className="w-full flex items-center gap-[12px] px-[18px] py-[13px] bg-[#f7f8fa] border-[1.5px] border-[#edeff2] rounded-[14px] hover:border-brand-500 hover:bg-white transition-colors text-left"
                >
                  <MethodIcon 
                    id={modalState.typeId} 
                    color={modalState.typeId === 'bank-details' ? '#1a56db' : modalState.typeId === 'upi' ? '#5f259f' : (pmInfo?.color || '#666')} 
                    badge={modalState.typeId === 'bank-details' ? '🏦' : modalState.typeId === 'upi' ? 'UPI' : (pmInfo?.badge || '?')} 
                    slug={pmInfo?.slug}
                    size={28} 
                  />
                  <span className="text-[16px] font-medium text-ink-900 flex-1">{methodDisplayName}</span>
                  <ChevronRight className="w-[18px] h-[18px] text-gray-400" />
                </button>
              </div>

              <div>
                <label className="block text-[15px] font-semibold text-ink-900 mb-[9px]">Display Title</label>
                <input
                  type="text"
                  placeholder={`e.g. Pay via ${methodDisplayName}`}
                  value={modalState.title}
                  onChange={e => setModalState(p => ({ ...p, title: e.target.value }))}
                  className="w-full bg-[#f7f8fa] border-[1.5px] border-[#edeff2] rounded-[14px] px-[18px] py-[15px] text-[16px] text-ink-900 placeholder-[#b6bcc6] outline-none focus:border-brand-500 focus:bg-white transition-[0.15s]"
                />
              </div>

              {modalState.typeId === 'bank-details' ? (
                <div className="space-y-[20px]">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[15px] font-semibold text-ink-900 mb-[9px]">Bank Name</label>
                      <input type="text" value={modalState.bankDetails.bankName} onChange={e => setModalState(p => ({...p, bankDetails: {...p.bankDetails, bankName: e.target.value}}))} placeholder="HSBC" className="w-full bg-[#f7f8fa] border-[1.5px] border-[#edeff2] rounded-[14px] px-[18px] py-[15px] text-[16px] text-ink-900 placeholder-[#b6bcc6] outline-none focus:border-brand-500 focus:bg-white transition-[0.15s]" />
                    </div>
                    <div>
                      <label className="block text-[15px] font-semibold text-ink-900 mb-[9px]">Account No.</label>
                      <input type="text" value={modalState.bankDetails.accountNumber} onChange={e => setModalState(p => ({...p, bankDetails: {...p.bankDetails, accountNumber: e.target.value}}))} placeholder="8920804195" className="w-full bg-[#f7f8fa] border-[1.5px] border-[#edeff2] rounded-[14px] px-[18px] py-[15px] text-[16px] text-ink-900 placeholder-[#b6bcc6] outline-none focus:border-brand-500 focus:bg-white transition-[0.15s]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[15px] font-semibold text-ink-900 mb-[9px]">Account Name</label>
                    <input type="text" value={modalState.bankDetails.accountName} onChange={e => setModalState(p => ({...p, bankDetails: {...p.bankDetails, accountName: e.target.value}}))} placeholder="Your Name" className="w-full bg-[#f7f8fa] border-[1.5px] border-[#edeff2] rounded-[14px] px-[18px] py-[15px] text-[16px] text-ink-900 placeholder-[#b6bcc6] outline-none focus:border-brand-500 focus:bg-white transition-[0.15s]" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[15px] font-semibold text-ink-900 mb-[9px]">IFSC Code</label>
                      <input type="text" value={modalState.bankDetails.ifscCode} onChange={e => setModalState(p => ({...p, bankDetails: {...p.bankDetails, ifscCode: e.target.value}}))} className="w-full bg-[#f7f8fa] border-[1.5px] border-[#edeff2] rounded-[14px] px-[14px] py-[12px] text-[14px] text-ink-900 outline-none focus:border-brand-500 focus:bg-white transition-[0.15s]" />
                    </div>
                    <div>
                      <label className="block text-[15px] font-semibold text-ink-900 mb-[9px]">Routing</label>
                      <input type="text" value={modalState.bankDetails.routingCode} onChange={e => setModalState(p => ({...p, bankDetails: {...p.bankDetails, routingCode: e.target.value}}))} className="w-full bg-[#f7f8fa] border-[1.5px] border-[#edeff2] rounded-[14px] px-[14px] py-[12px] text-[14px] text-ink-900 outline-none focus:border-brand-500 focus:bg-white transition-[0.15s]" />
                    </div>
                    <div>
                      <label className="block text-[15px] font-semibold text-ink-900 mb-[9px]">Swift Code</label>
                      <input type="text" value={modalState.bankDetails.swiftCode} onChange={e => setModalState(p => ({...p, bankDetails: {...p.bankDetails, swiftCode: e.target.value}}))} className="w-full bg-[#f7f8fa] border-[1.5px] border-[#edeff2] rounded-[14px] px-[14px] py-[12px] text-[14px] text-ink-900 outline-none focus:border-brand-500 focus:bg-white transition-[0.15s]" />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[15px] font-semibold text-ink-900 mb-[9px]">
                    {modalState.typeId === 'upi' ? 'UPI ID' : 'Details / Link / Address'}
                  </label>
                  <input
                    type="text"
                    placeholder={modalState.typeId === 'upi' ? "yourname@upi" : "paypal.me/username"}
                    value={modalState.value}
                    onChange={e => setModalState(p => ({ ...p, value: e.target.value }))}
                    className="w-full bg-[#f7f8fa] border-[1.5px] border-[#edeff2] rounded-[14px] px-[18px] py-[15px] text-[16px] text-ink-900 placeholder-[#b6bcc6] outline-none focus:border-brand-500 focus:bg-white transition-[0.15s]"
                  />
                </div>
              )}

              <div className="bg-[#fafbfc] border-[1.5px] border-[#eef0f3] rounded-[16px] p-[18px] px-[20px] mt-[22px] flex items-center justify-between gap-[16px]">
                <div>
                  <div className="flex items-center gap-[9px]">
                    <span className="text-[16px] font-bold text-ink-900">QR Code</span>
                    <span className="text-[10px] border border-[#dfe3e8] rounded-[6px] px-[7px] py-[2px] text-gray-500 font-semibold">Optional</span>
                  </div>
                  <p className="text-[13px] text-gray-500 mt-[7px] max-w-[340px]">
                    Upload a QR code image so customers can scan it to pay.
                  </p>
                </div>
                <div className="flex items-center gap-[12px]">
                  {modalState.qrPreview && (
                    <button onClick={() => setModalState(p => ({ ...p, qrPreview: null }))} className="text-red-500 text-xs font-bold hover:underline">
                      Remove
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => qrRef.current?.click()}
                    className="w-[80px] h-[80px] border-[1.5px] border-dashed border-[#cfd4db] rounded-[12px] flex items-center justify-center text-gray-400 hover:border-brand-500 hover:text-brand-500 transition-colors relative shrink-0"
                  >
                    {modalState.qrPreview ? (
                      <img src={modalState.qrPreview} alt="QR" className="w-full h-full object-cover rounded-[11px]" />
                    ) : (
                      <>
                        <Upload className="w-[28px] h-[28px] stroke-[1.6px]" />
                        <div className="absolute -top-[9px] -right-[9px] w-[26px] h-[26px] rounded-full bg-brand-500 text-white flex items-center justify-center text-[18px] shadow-[0_3px_8px_rgba(249,115,22,0.4)] font-bold">
                          +
                        </div>
                      </>
                    )}
                  </button>
                </div>
                <input ref={qrRef} type="file" accept="image/*" className="hidden"
                  onChange={async e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    try {
                      const webpDataUrl = await processImageToWebP(f);
                      setModalState(p => ({ ...p, qrPreview: webpDataUrl }));
                    } catch (err) {
                      toast.error('Failed to process image');
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-[18px] px-[32px] border-t border-[#f0f1f4] bg-[#fafbfc]">
              <button
                onClick={() => setModalState(p => ({ ...p, isOpen: false }))}
                className="bg-white border-[1.5px] border-[#dfe3e8] text-ink-900 font-semibold text-[16px] px-[26px] py-[13px] rounded-[14px] hover:border-[#cfd4db] hover:bg-[#fafbfc] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleModalSave}
                disabled={saving}
                className="bg-brand-500 text-white font-bold text-[16px] px-[28px] py-[14px] rounded-[14px] shadow-[0_8px_20px_rgba(249,115,22,0.3)] hover:bg-brand-600 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : modalState.isEditing ? 'Save Changes' : 'Add Method'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl font-bold tracking-tighter mb-4 text-ink-900" style={{ fontFamily: 'var(--font-display)' }}>
            Payment Methods
          </h1>
          <p className="text-ink-500 text-xl">Manage payment methods across your business profiles. These appear on your invoices.</p>
        </div>
        
        {activeBusinesses.length > 0 && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-5 py-3 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600 transition-all shadow-[0_8px_20px_rgba(249,115,22,0.3)] shrink-0"
          >
            <Plus className="w-4 h-4" /> New Payment Method
          </button>
        )}
      </div>

      {localMethods.length === 0 ? (
        <div className="glass-card p-12 bg-white border border-ink-100 shadow-sm text-center rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-ink-100 flex items-center justify-center mx-auto mb-6">
            <CreditCard className="w-8 h-8 text-ink-400" />
          </div>
          <h3 className="text-xl font-bold text-ink-900 mb-2">No payment methods yet</h3>
          <p className="text-ink-500 mb-6">Add your first payment method so clients can pay you.</p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500 text-white font-bold rounded-xl hover:bg-brand-600 transition-colors shadow-[0_8px_20px_rgba(249,115,22,0.3)]"
          >
            <Plus className="w-4 h-4" /> Add Payment Method
          </button>
        </div>
      ) : (
        <div className="glass-card bg-white border border-ink-200 shadow-sm rounded-[20px] overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-ink-50 border-b border-ink-200">
                  <th className="px-6 py-4 text-xs font-bold text-ink-500 uppercase tracking-wider w-[30%]">Method</th>
                  <th className="px-6 py-4 text-xs font-bold text-ink-500 uppercase tracking-wider w-[35%]">Details / Link</th>
                  <th className="px-6 py-4 text-xs font-bold text-ink-500 uppercase tracking-wider w-[5%] text-center">QR</th>
                  <th className="px-6 py-4 text-xs font-bold text-ink-500 uppercase tracking-wider w-[10%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {localMethods.map((method, idx) => (
                  <tr key={`${method.id}-${idx}`} className="hover:bg-ink-50/50 transition-colors group">
                    <td className="px-6 py-4 align-middle">
                      <div className="flex items-center gap-3">
                        <MethodIcon id={method.id} color={method.color} badge={method.badge} slug={method.slug || PM_MAP[method.id]?.slug} size={32} />
                        <span className="font-bold text-ink-900 text-sm">{method.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <span className="text-sm text-ink-600 truncate block max-w-[300px]" title={renderValueText(method)}>
                        {renderValueText(method)}
                      </span>
                    </td>
                    <td className="px-6 py-4 align-middle text-center">
                      {method.qr ? (
                        <div className="flex justify-center">
                          <img src={method.qr} alt="QR Code" className="w-8 h-8 rounded-[8px] object-cover border border-ink-200 shadow-sm cursor-pointer hover:scale-[2.5] hover:z-50 transition-transform origin-center relative" />
                        </div>
                      ) : (
                        <span className="text-xs text-ink-300 font-medium">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-middle text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleOpenEdit(method, idx)}
                          className="p-2 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded-[10px] transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(idx)}
                          className="p-2 text-ink-400 hover:text-red-600 hover:bg-red-50 rounded-[10px] transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
