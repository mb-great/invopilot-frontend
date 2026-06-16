'use client';

import { useState, useRef, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, X, Upload } from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_METHODS = [
  { id: 'stripe', name: 'Stripe Connect', badge: 'S', color: '#635bff', mode: 'url' as const, slug: 'stripe' },
  { id: 'local', name: 'Local transfer', badge: '₿', color: '#2b6cb0', mode: 'details' as const, slug: '' },
  { id: 'intl', name: 'International transfer', badge: '🌐', color: '#d69e2e', mode: 'details' as const, slug: '' },
  { id: 'paypal', name: 'PayPal', badge: 'P', color: '#0070ba', mode: 'url' as const, slug: 'paypal' },
  { id: 'square', name: 'Square', badge: '■', color: '#3e4348', mode: 'url' as const, slug: 'square' },
  { id: 'revolut', name: 'Revolut', badge: 'R', color: '#191c1f', mode: 'url' as const, slug: 'revolut' },
  { id: 'wise', name: 'Wise', badge: '⇋', color: '#163300', mode: 'details' as const, slug: 'wise' },
  { id: 'monzo', name: 'Monzo', badge: 'M', color: '#ff4f40', mode: 'url' as const, slug: 'monzo' },
  { id: 'cashapp', name: 'Cash App', badge: '$', color: '#00d632', mode: 'url' as const, slug: 'cashapp' },
  { id: 'venmo', name: 'Venmo', badge: 'V', color: '#3d95ce', mode: 'url' as const, slug: 'venmo' },
  { id: 'razorpay', name: 'Razorpay', badge: 'R', color: '#0c2451', mode: 'url' as const, slug: 'razorpay' },
  { id: 'instamojo', name: 'Instamojo', badge: 'i', color: '#5a55ca', mode: 'url' as const, slug: 'instamojo' },
  { id: 'paystack', name: 'Paystack', badge: '≡', color: '#00c3f7', mode: 'url' as const, slug: 'paystack' },
  { id: 'flutterwave', name: 'Flutterwave', badge: 'F', color: '#f5a623', mode: 'url' as const, slug: 'flutter' },
  { id: 'mercadopago', name: 'Mercado Pago', badge: 'M', color: '#00b1ea', mode: 'url' as const, slug: 'mercadopago' },
  { id: 'pagseguro', name: 'PagSeguro', badge: 'P', color: '#fcb22d', mode: 'url' as const, slug: 'pagseguro' },
  { id: 'conekta', name: 'Conekta', badge: 'C', color: '#0a2540', mode: 'details' as const, slug: '' },
  { id: 'esewa', name: 'eSewa', badge: 'e', color: '#60bb46', mode: 'details' as const, slug: 'esewa' },
  { id: 'khalti', name: 'Khalti', badge: 'K', color: '#5c2d91', mode: 'details' as const, slug: '' },
  { id: 'gcash', name: 'GCash', badge: 'G', color: '#0070e0', mode: 'details' as const, slug: 'gcash' },
  { id: 'maya', name: 'Maya', badge: 'm', color: '#00d6a0', mode: 'details' as const, slug: '' },
  { id: 'phonepe', name: 'PhonePe', badge: 'प', color: '#5f259f', mode: 'details' as const, slug: 'phonepe' },
  { id: 'gpay', name: 'Google Pay', badge: 'G', color: '#4285f4', mode: 'details' as const, slug: 'googlepay' },
  { id: 'paytm', name: 'Paytm', badge: 'P', color: '#00baf2', mode: 'details' as const, slug: 'paytm' },
  { id: 'zelle', name: 'Zelle', badge: 'Z', color: '#6d1ed4', mode: 'details' as const, slug: 'zelle' },
  { id: 'alipay', name: 'Alipay', badge: '支', color: '#1677ff', mode: 'details' as const, slug: 'alipay' },
  { id: 'wechat', name: 'WeChat Pay', badge: '微', color: '#07c160', mode: 'details' as const, slug: 'wechat' },
  { id: 'payoneer', name: 'Payoneer', badge: 'P', color: '#ff4800', mode: 'url' as const, slug: 'payoneer' },
  { id: 'mollie', name: 'Mollie', badge: 'M', color: '#000000', mode: 'url' as const, slug: 'mollie' },
  { id: 'klarna', name: 'Klarna', badge: 'K', color: '#ffb3c7', mode: 'url' as const, slug: 'klarna' },
  { id: 'skrill', name: 'Skrill', badge: 'S', color: '#862165', mode: 'url' as const, slug: 'skrill' },
  { id: 'mpesa', name: 'M-Pesa', badge: 'M', color: '#43b02a', mode: 'details' as const, slug: '' },
  { id: 'pix', name: 'Pix', badge: '⬗', color: '#32bcad', mode: 'details' as const, slug: 'pix' },
  { id: 'ideal', name: 'iDEAL', badge: 'i', color: '#cc0066', mode: 'url' as const, slug: 'ideal' },
  { id: 'bizum', name: 'Bizum', badge: 'B', color: '#0a7bbe', mode: 'details' as const, slug: 'bizum' },
];

type PaymentMethodItem = (typeof PAYMENT_METHODS)[number];

export interface SelectedPaymentMethod {
  id: string;
  title: string;
  value: string;
  qr?: string;
  color: string;
  badge: string;
}

interface PaymentMethodModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (method: SelectedPaymentMethod) => void;
  existingCount: number;
  isPremium?: boolean;
}

function MethodBadge({ method, size = 26 }: { method: PaymentMethodItem; size?: number }) {
  if (!method.slug) {
    return (
      <div
        className="rounded-lg flex items-center justify-center font-bold text-white shrink-0"
        style={{ width: size, height: size, backgroundColor: method.color, fontSize: size * 0.45 }}
      >
        {method.badge}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg flex items-center justify-center bg-white border border-ink-100 overflow-hidden shrink-0"
      style={{ width: size, height: size }}
    >
      <img
        src={`https://cdn.simpleicons.org/${method.slug}`}
        alt={method.name}
        style={{ width: size * 0.6, height: size * 0.6, objectFit: 'contain' }}
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          const parent = target.parentElement;
          if (parent) {
            const fallback = document.createElement('div');
            fallback.className = 'flex items-center justify-center font-bold text-white rounded-lg';
            fallback.style.cssText = `width:${size}px;height:${size}px;background:${method.color};font-size:${size * 0.45}px`;
            fallback.textContent = method.badge;
            parent.replaceWith(fallback);
          }
        }}
      />
    </div>
  );
}

export default function PaymentMethodModal({
  open,
  onClose,
  onAdd,
  existingCount,
  isPremium = false,
}: PaymentMethodModalProps) {
  const [search, setSearch] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodItem | null>(null);
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search) return PAYMENT_METHODS;
    const q = search.toLowerCase();
    return PAYMENT_METHODS.filter((m) => m.name.toLowerCase().includes(q));
  }, [search]);

  if (!open) return null;

  const handleSelectMethod = (method: PaymentMethodItem) => {
    if (existingCount >= 3) {
      toast.warning('You can only add a maximum of 3 payment methods per invoice.');
      return;
    }
    setSelectedMethod(method);
    setTitle(method.name);
    setValue('');
    setQrPreview(null);
  };

  const handleBack = () => {
    setSelectedMethod(null);
    setTitle('');
    setValue('');
    setQrPreview(null);
  };

  const handleQrUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setQrPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!selectedMethod) return;
    onAdd({
      id: selectedMethod.id,
      title: title.trim() || selectedMethod.name,
      value: value.trim(),
      qr: qrPreview || undefined,
      color: selectedMethod.color,
      badge: selectedMethod.badge,
    });
    toast.success(`${title.trim() || selectedMethod.name} added`);
    onClose();
    handleBack();
    setSearch('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-full max-w-[540px] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-ink-900"
        onClick={(e) => e.stopPropagation()}
      >
        {!selectedMethod ? (
          <PickerView
            search={search}
            onSearchChange={setSearch}
            filtered={filtered}
            onSelect={handleSelectMethod}
            onClose={onClose}
            existingCount={existingCount}
            isPremium={isPremium}
          />
        ) : (
          <DetailView
            method={selectedMethod}
            title={title}
            onTitleChange={setTitle}
            value={value}
            onValueChange={setValue}
            qrPreview={qrPreview}
            onQrUpload={handleQrUpload}
            fileRef={fileRef}
            onBack={handleBack}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}

function PickerView({
  search,
  onSearchChange,
  filtered,
  onSelect,
  onClose,
  existingCount,
  isPremium,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  filtered: PaymentMethodItem[];
  onSelect: (m: PaymentMethodItem) => void;
  onClose: () => void;
  existingCount: number;
  isPremium: boolean;
}) {
  const [view, setView] = useState<'list' | 'bank' | 'upi'>('list');

  if (view === 'bank') {
    return (
      <BankDetailsView
        onBack={() => setView('list')}
        onClose={onClose}
        isPremium={isPremium}
      />
    );
  }

  if (view === 'upi') {
    return (
      <UpiView
        onBack={() => setView('list')}
        onClose={onClose}
        isPremium={isPremium}
      />
    );
  }

  return (
    <div className="flex flex-col max-h-[85vh]">
      <div className="p-6 pb-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-ink-900">Add a payment method</h2>
            <p className="text-sm text-ink-500 mt-1">Pick how your customers will pay you.</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-ink-50 flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-500" />
          <input
            type="text"
            placeholder="Search payment methods..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-ink-50 border border-ink-200 rounded-xl py-3 pl-11 pr-4 text-sm text-ink-900 placeholder-[#8b8b91] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ willChange: 'transform', WebkitOverflowScrolling: 'touch' }}>
        {!search && (
          <div className="space-y-1 mb-3">
            <p className="text-[11px] font-bold text-ink-500 uppercase tracking-widest mb-2">Quick Setup</p>
            <button
              onClick={() => setView('bank')}
              className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-ink-50 transition-colors group text-left"
            >
              <div className="w-[44px] h-[44px] rounded-lg flex items-center justify-center font-bold text-white shrink-0 text-sm" style={{ backgroundColor: '#1a56db' }}>
                🏦
              </div>
              <span className="text-[15px] font-semibold text-ink-900 flex-1">Bank Details</span>
              <ChevronRight className="w-[18px] h-[18px] text-ink-500 group-hover:text-brand-500 transition-colors" />
            </button>
            <button
              onClick={() => setView('upi')}
              className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-ink-50 transition-colors group text-left"
            >
              <div className="w-[44px] h-[44px] rounded-lg flex items-center justify-center font-bold text-white shrink-0 text-sm" style={{ backgroundColor: '#5f259f' }}>
                UPI
              </div>
              <span className="text-[15px] font-semibold text-ink-900 flex-1">UPI</span>
              <ChevronRight className="w-[18px] h-[18px] text-ink-500 group-hover:text-brand-500 transition-colors" />
            </button>
          </div>
        )}

        {!search && (
          <p className="text-[11px] font-bold text-ink-500 uppercase tracking-widest mb-2">All Methods</p>
        )}

        {filtered.length === 0 ? (
          <p className="text-sm text-ink-500 text-center py-8">No methods found.</p>
        ) : (
          <div className="space-y-1">
            {filtered.map((method) => (
              <button
                key={method.id}
                onClick={() => onSelect(method)}
                className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-ink-50 transition-colors group text-left"
              >
                <MethodBadge method={method} size={44} />
                <span className="text-[15px] font-semibold text-ink-900 flex-1">{method.name}</span>
                <ChevronRight className="w-[18px] h-[18px] text-ink-500 group-hover:text-brand-500 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>

      {existingCount >= 3 && (
        <div className="px-6 pb-4">
          <p className="text-xs text-amber-400 bg-amber-400/10 rounded-lg px-3 py-2">
            Maximum of 3 payment methods reached. Remove one before adding more.
          </p>
        </div>
      )}
    </div>
  );
}

function BankDetailsView({
  onBack,
  onClose,
  isPremium,
}: {
  onBack: () => void;
  onClose: () => void;
  isPremium: boolean;
}) {
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [routingCode, setRoutingCode] = useState('');
  const [swiftCode, setSwiftCode] = useState('');

  return (
    <div className="flex flex-col max-h-[85vh]">
      <div className="p-6 pb-0">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-ink-50 border border-ink-100">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white text-sm" style={{ backgroundColor: '#1a56db' }}>
                🏦
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink-900">Bank Details</h2>
              <p className="text-sm text-ink-500 mt-1">Add your bank account information.</p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-ink-50 flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <InputField label="Bank Name" value={bankName} onChange={setBankName} placeholder="HSBC" />
          <InputField label="Account Number" value={accountNumber} onChange={setAccountNumber} placeholder="8920804195" />
          <InputField label="Account Name" value={accountName} onChange={setAccountName} placeholder="Your Name" />
          <InputField label="IFSC Code" value={ifscCode} onChange={setIfscCode} placeholder="HSBC0560002" />
          <InputField label="Routing Number" value={routingCode} onChange={setRoutingCode} placeholder="0804189592" />
          <InputField label="Swift Code" value={swiftCode} onChange={setSwiftCode} placeholder="HSBCINAA123" />
        </div>
      </div>

      <div className="flex items-center justify-between p-6 mt-auto border-t border-ink-200">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-ink-200 text-ink-900 font-semibold text-sm hover:bg-ink-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={() => {
            const parts = [bankName, accountNumber, accountName, ifscCode, routingCode, swiftCode].filter(Boolean);
            if (parts.length === 0) {
              toast.error('Enter at least one bank detail');
              return;
            }
            const summary = [accountName, bankName].filter(Boolean).join(' · ') || 'Bank Details';
            onClose();
            toast.success('Bank Details saved');
            window.dispatchEvent(new CustomEvent('paymentMethod:bankDetails', {
              detail: { bankName, accountNumber, accountName, ifscCode, routingCode, swiftCode, summary },
            }));
          }}
          className="px-6 py-3 rounded-xl bg-brand-500 text-white font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-brand-600 transition-colors"
        >
          Add Bank Details
        </button>
      </div>
    </div>
  );
}

function UpiView({
  onBack,
  onClose,
  isPremium,
}: {
  onBack: () => void;
  onClose: () => void;
  isPremium: boolean;
}) {
  const [upiId, setUpiId] = useState('');
  const [showQr, setShowQr] = useState(true);
  const [lockAmount, setLockAmount] = useState(false);

  return (
    <div className="flex flex-col max-h-[85vh]">
      <div className="p-6 pb-0">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-ink-50 border border-ink-100">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white text-sm" style={{ backgroundColor: '#5f259f' }}>
                UPI
              </div>
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink-900">UPI</h2>
              <p className="text-sm text-ink-500 mt-1">Add your UPI payment details.</p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-ink-50 flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <InputField label="UPI ID" value={upiId} onChange={setUpiId} placeholder="yourname@upi" />

          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer group relative">
              <div className="flex items-center h-5 mt-0.5">
                <input
                  type="checkbox"
                  checked={showQr}
                  onChange={(e) => setShowQr(e.target.checked)}
                  className="w-4 h-4 border-gray-300 rounded text-brand-600 focus:ring-brand-600 cursor-pointer"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-700">Generate UPI QR code</span>
                <span className="text-xs text-gray-500 mt-0.5">Display scan-to-pay QR on PDF.</span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer group relative">
              <div className="flex items-center h-5 mt-0.5">
                <input
                  type="checkbox"
                  checked={lockAmount}
                  onChange={(e) => setLockAmount(e.target.checked)}
                  className="w-4 h-4 border-gray-300 rounded text-brand-600 focus:ring-brand-600 cursor-pointer"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-700">Lock amount in QR</span>
                <span className="text-xs text-gray-500 mt-0.5">Payers cannot modify amount while scanning.</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between p-6 mt-auto border-t border-ink-200">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-ink-200 text-ink-900 font-semibold text-sm hover:bg-ink-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={() => {
            if (!upiId.trim()) {
              toast.error('Enter a UPI ID');
              return;
            }
            onClose();
            toast.success('UPI added');
            window.dispatchEvent(new CustomEvent('paymentMethod:upi', {
              detail: { upiId: upiId.trim(), showQr, lockAmount },
            }));
          }}
          className="px-6 py-3 rounded-xl bg-brand-500 text-white font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-brand-600 transition-colors"
        >
          Add UPI
        </button>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-ink-500 uppercase tracking-widest mb-2">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-[#8b8b91] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
      />
    </div>
  );
}

function DetailView({
  method,
  title,
  onTitleChange,
  value,
  onValueChange,
  qrPreview,
  onQrUpload,
  fileRef,
  onBack,
  onSave,
}: {
  method: PaymentMethodItem;
  title: string;
  onTitleChange: (v: string) => void;
  value: string;
  onValueChange: (v: string) => void;
  qrPreview: string | null;
  onQrUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onBack: () => void;
  onSave: () => void;
}) {
  const isUrl = method.mode === 'url';

  return (
    <div className="flex flex-col max-h-[85vh]">
      <div className="p-6 pb-0">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-ink-100 overflow-hidden"
              style={{ backgroundColor: '#161618' }}
            >
              <MethodBadge method={method} size={30} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink-900">{method.name}</h2>
              <p className="text-sm text-ink-500 mt-1">
                {isUrl
                  ? `Add your ${method.name} payment link.`
                  : `Add your ${method.name} payment details.`}
              </p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-ink-50 flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-ink-500 uppercase tracking-widest mb-2">
              Payment title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-[#8b8b91] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-ink-500 uppercase tracking-widest mb-2">
              {isUrl ? 'Payment URL' : 'Payment Details'}
            </label>
            {isUrl ? (
              <input
                type="text"
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                placeholder="Paste the URL of your payment page here"
                className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-[#8b8b91] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              />
            ) : (
              <textarea
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                placeholder={`Enter payment details for ${method.name}`}
                rows={3}
                className="w-full bg-ink-50 border border-ink-200 rounded-xl px-4 py-3 text-sm text-ink-900 placeholder-[#8b8b91] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors resize-none"
              />
            )}
          </div>

          <div className="bg-ink-50 border border-ink-200 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-ink-900">QR Code</span>
                <span className="text-[10px] border border-ink-200 rounded-md px-1.5 py-0.5 text-ink-500 font-semibold">
                  Optional
                </span>
              </div>
              <p className="text-xs text-ink-500 mt-1">
                Upload a QR code image so customers can scan it to pay.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 border border-dashed border-ink-200 rounded-xl flex items-center justify-center text-ink-500 hover:border-brand-500 hover:text-brand-500 transition-colors shrink-0 relative"
            >
              {qrPreview ? (
                <img src={qrPreview} alt="QR preview" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <>
                  <Upload className="w-7 h-7" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-bold shadow-lg">
                    +
                  </div>
                </>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onQrUpload}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between p-6 mt-auto border-t border-ink-200">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-3 rounded-xl border border-ink-200 text-ink-900 font-semibold text-sm hover:bg-ink-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onSave}
          className="px-6 py-3 rounded-xl bg-brand-500 text-white font-bold text-sm shadow-lg shadow-orange-500/30 hover:bg-brand-600 transition-colors"
        >
          Add Payment Method
        </button>
      </div>
    </div>
  );
}
