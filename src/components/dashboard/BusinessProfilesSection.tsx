'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Check, X, ShieldAlert, Image as ImageIcon, Upload, Lock } from 'lucide-react';
import PremiumBadge from '@/components/ui/PremiumBadge';
import BusinessTable from './BusinessTable';
import PaymentMethodManager from './PaymentMethodManager';

export type BusinessProfile = {
  id: string;
  name: string;
  logoUrl?: string;
  signatureUrl?: string;
  methods?: any[];
  email?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  paypalEmail?: string;
  cryptoAddress?: string;
  createdAt?: string;
  deletedAt?: string;
};

interface BusinessProfilesSectionProps {
  profile: any;
  userId: string;
  maxBusinesses: number | 'unlimited';
  canUploadLogo: boolean;
  isModal?: boolean;
  activeWorkspace?: any;
}

export default function BusinessProfilesSection({
  profile,
  userId,
  maxBusinesses,
  canUploadLogo,
  isModal = false,
  activeWorkspace
}: BusinessProfilesSectionProps) {
  const router = useRouter();
  const supabase = createClient();
  const [editingProfile, setEditingProfile] = useState<BusinessProfile | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);

  const businesses: BusinessProfile[] = Array.isArray(activeWorkspace?.businesses)
    ? activeWorkspace.businesses
    : [];

  // Quota Count: Active profiles + profiles deleted within the last 30 days
  const activeBusinesses = businesses.filter(b => !b.deletedAt);
  const activeAndRecentlyDeleted = businesses.filter(b => 
    !b.deletedAt || (Date.now() - new Date(b.deletedAt).getTime() < 30 * 24 * 60 * 60 * 1000)
  );

  const quotaUsed = activeAndRecentlyDeleted.length;
  const limitReached = maxBusinesses !== 'unlimited' && quotaUsed >= maxBusinesses;

  const handleOpenAdd = () => {
    if (limitReached) {
      toast.error(`You have reached your limit of ${maxBusinesses} business profile(s) for this tier.`);
      return;
    }
    setEditingProfile({
      id: crypto.randomUUID(),
      name: '',
      logoUrl: '',
      signatureUrl: '',
      methods: [],
      email: '',
      gstin: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      country: '',
      bankName: '',
      accountNo: '',
      ifsc: '',
      paypalEmail: '',
      cryptoAddress: '',
      createdAt: new Date().toISOString()
    });
    setIsAdding(true);
  };

  const handleOpenEdit = (biz: BusinessProfile) => {
    setEditingProfile({ ...biz, methods: biz.methods || [] });
    setIsAdding(false);
  };

  const handleCancel = () => {
    setEditingProfile(null);
  };

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
            if (!ctx) {
              reject(new Error("Failed to get canvas context"));
              return;
            }
            ctx.drawImage(img, 0, 0);
            const dataUrl = canvas.toDataURL("image/webp", 0.8);
            resolve(dataUrl);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canUploadLogo) {
      toast.error("Logo upload is locked on your current tier. Please upgrade.");
      return;
    }
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      setUploadingLogo(true);
      const dataUri = await processImageToWebP(file);
      
      const stringLength = dataUri.length - (dataUri.indexOf(",") + 1);
      const sizeBytes = Math.ceil(stringLength * 0.75);

      if (sizeBytes > 2 * 1024 * 1024) {
        toast.error("Compressed logo exceeds 2MB limit.");
        return;
      }

      const response = await fetch(dataUri);
      const blob = await response.blob();

      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, blob, {
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      setEditingProfile(prev => prev ? { ...prev, logoUrl: publicUrl } : null);
      toast.success("Logo uploaded successfully");
    } catch (err: unknown) {
      toast.error("Failed to upload logo: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    try {
      setUploadingSignature(true);
      const dataUri = await processImageToWebP(file);
      
      const stringLength = dataUri.length - (dataUri.indexOf(",") + 1);
      const sizeBytes = Math.ceil(stringLength * 0.75);

      if (sizeBytes > 2 * 1024 * 1024) {
        toast.error("Compressed signature exceeds 2MB limit.");
        return;
      }

      const response = await fetch(dataUri);
      const blob = await response.blob();

      const fileExt = file.name.split('.').pop();
      const filePath = `${userId}/${crypto.randomUUID()}_sig.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('logos') // Reusing logos bucket for signatures
        .upload(filePath, blob, {
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      setEditingProfile(prev => prev ? { ...prev, signatureUrl: publicUrl } : null);
      toast.success("Signature uploaded successfully");
    } catch (err: unknown) {
      toast.error("Failed to upload signature: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingSignature(false);
    }
  };

  // Abuse Protection edit lock: edit permitted only within 48 hours of creation
  const isProfileLocked = !isAdding && !!editingProfile?.createdAt && 
    (Date.now() - new Date(editingProfile.createdAt).getTime() > 48 * 60 * 60 * 1000);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    if (!editingProfile.name.trim()) {
      toast.error("Business name is required");
      return;
    }

    if (isProfileLocked) {
      toast.error("This profile is locked. Modifications are only allowed within 48 hours of creation.");
      return;
    }

    try {
      let updatedBusinesses: BusinessProfile[];
      if (isAdding) {
        const newProfile = {
          ...editingProfile,
          createdAt: editingProfile.createdAt || new Date().toISOString()
        };
        updatedBusinesses = [...businesses, newProfile];
      } else {
        updatedBusinesses = businesses.map(b => b.id === editingProfile.id ? editingProfile : b);
      }

      const { error } = await supabase
        .from('workspaces')
        .update({ businesses: updatedBusinesses })
        .eq('id', activeWorkspace.id);

      if (error) throw error;

      toast.success(isAdding ? "Business profile added" : "Business profile updated");
      setEditingProfile(null);
      router.refresh();
    } catch (err: unknown) {
      toast.error("Failed to save profile: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this business profile? It will count against your profile limit for 30 days.")) return;

    try {
      // Soft deletion: set deletedAt timestamp instead of removing from array
      const updatedBusinesses = businesses.map(b => b.id === id ? { ...b, deletedAt: new Date().toISOString() } : b);
      const { error } = await supabase
        .from('workspaces')
        .update({ businesses: updatedBusinesses })
        .eq('id', activeWorkspace.id);

      if (error) throw error;

      toast.success("Business profile removed");
      router.refresh();
    } catch (err: unknown) {
      toast.error("Failed to delete profile: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const pendingReleaseCount = activeAndRecentlyDeleted.length - activeBusinesses.length;

  return (
    <section className={isModal ? "w-full" : "glass-card p-8 bg-white border border-ink-100 shadow-sm mt-8"}>
      <div className="flex justify-between items-center mb-6">
        <div>
          {!isModal && (
            <h3 className="text-xl font-bold flex items-center gap-2">
              <span className="text-brand-500">02</span> Business Profiles
              <PremiumBadge type="pro" />
            </h3>
          )}
          <p className="text-xs text-ink-500 mt-1">
            Manage multiple business profiles ({activeBusinesses.length} active / {maxBusinesses === 'unlimited' ? '∞' : maxBusinesses} slots used)
            {pendingReleaseCount > 0 && <span className="text-amber-600 font-medium"> • {pendingReleaseCount} pending release</span>}
          </p>
        </div>
        {!editingProfile && (
          <button
            type="button"
            onClick={handleOpenAdd}
            disabled={limitReached}
            className={`flex items-center gap-2 font-bold text-sm px-4 py-2 rounded-lg transition-colors border ${
              limitReached
                ? 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed'
                : 'text-brand-500 hover:text-brand-600 bg-brand-50 hover:bg-brand-100 border-brand-100'
            }`}
          >
            <Plus className="w-4 h-4" /> Add Profile
          </button>
        )}
      </div>

      {editingProfile ? (
        <form onSubmit={handleSave} className="space-y-6 border-t border-ink-100 pt-6 relative">
          {isProfileLocked && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-800 text-xs mb-6">
              <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Profile Locked:</strong> Details can only be edited within 2 days (48 hours) of creation to prevent rotation abuse. Deleted profiles count against limits for 30 days.
              </span>
            </div>
          )}

          <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-ink-900">{isAdding ? 'New Business Profile' : 'Edit Business Profile'}</h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-2 text-ink-500 hover:text-ink-700 font-bold text-sm bg-ink-50 hover:bg-ink-100 px-4 py-2 rounded-lg transition-colors border border-ink-100"
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              {!isProfileLocked && (
                <button
                  type="submit"
                  className="flex items-center gap-2 text-white font-bold text-sm bg-brand-500 hover:bg-brand-600 px-4 py-2 rounded-lg transition-colors shadow-lg shadow-brand-500/20"
                >
                  <Check className="w-4 h-4" /> Save Profile
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 flex flex-col gap-6">
              <div className="flex flex-col items-center justify-center border border-dashed border-ink-200 rounded-xl p-4 bg-ink-50/50">
                <span className="block text-xs uppercase font-bold text-muted mb-3 tracking-widest text-center">Business Logo</span>
                
                {editingProfile.logoUrl ? (
                  <div className="relative group w-28 h-28 border rounded-lg bg-white overflow-hidden shadow-sm flex items-center justify-center">
                    <img src={editingProfile.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                    {!isProfileLocked && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setEditingProfile(prev => prev ? { ...prev, logoUrl: '' } : null)}
                          className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-28 h-28 border border-dashed border-neutral-300 rounded-lg flex flex-col items-center justify-center text-neutral-400 bg-white">
                    <ImageIcon className="w-8 h-8 mb-1" />
                    <span className="text-[10px] text-center font-medium">No Logo</span>
                  </div>
                )}

                {canUploadLogo ? (
                  !isProfileLocked && (
                    <label className="mt-4 cursor-pointer text-xs font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingLogo ? 'COMPRESSING & UPLOADING...' : 'UPLOAD LOGO'}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={uploadingLogo}
                      />
                    </label>
                  )
                ) : (
                  <div className="mt-4 flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                    <ShieldAlert className="w-3.5 h-3.5" /> LOGO LOCKED
                    <PremiumBadge type="pro" />
                  </div>
                )}
                <span className="text-[10px] text-neutral-400 text-center mt-2 leading-relaxed">
                  PNG, JPG, WEBP, or SVG. Compresses to WebP (max 2MB).
                </span>
              </div>

              <div className="flex flex-col items-center justify-center border border-dashed border-ink-200 rounded-xl p-4 bg-ink-50/50">
                <span className="block text-xs uppercase font-bold text-muted mb-3 tracking-widest text-center">Digital Signature</span>
                
                {editingProfile.signatureUrl ? (
                  <div className="relative group w-40 h-20 border rounded-lg bg-white overflow-hidden shadow-sm flex items-center justify-center p-2">
                    <img src={editingProfile.signatureUrl} alt="Signature" className="max-w-full max-h-full object-contain" />
                    {!isProfileLocked && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setEditingProfile(prev => prev ? { ...prev, signatureUrl: '' } : null)}
                          className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-40 h-20 border border-dashed border-neutral-300 rounded-lg flex flex-col items-center justify-center text-neutral-400 bg-white">
                    <ImageIcon className="w-6 h-6 mb-1" />
                    <span className="text-[10px] text-center font-medium">No Signature</span>
                  </div>
                )}

                {!isProfileLocked && (
                  <label className="mt-4 cursor-pointer text-xs font-bold text-brand-500 hover:text-brand-600 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingSignature ? 'UPLOADING...' : 'UPLOAD SIGNATURE'}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleSignatureUpload}
                      disabled={uploadingSignature}
                    />
                  </label>
                )}
                <span className="text-[10px] text-neutral-400 text-center mt-2 leading-relaxed">
                  Transparent PNG or SVG recommended.
                </span>
                <p className="text-xs text-gray-400 text-center mt-1">
                  Tip: Upload a PNG with transparent background for best results on invoices.
                </p>
              </div>
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-bold text-muted mb-1 tracking-widest">Business Name *</label>
                <input
                  type="text"
                  required
                  disabled={isProfileLocked}
                  value={editingProfile.name}
                  onChange={e => setEditingProfile(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full rounded-lg px-4 py-2.5 border border-neutral-200 text-ink-900 focus:outline-none focus:border-brand-500 text-sm disabled:bg-neutral-50 disabled:text-neutral-400"
                  placeholder="e.g. Acme Corp"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-muted mb-1 tracking-widest">Email Address</label>
                <input
                  type="email"
                  disabled={isProfileLocked}
                  value={editingProfile.email || ''}
                  onChange={e => setEditingProfile(prev => prev ? { ...prev, email: e.target.value } : null)}
                  className="w-full rounded-lg px-4 py-2.5 border border-neutral-200 text-ink-900 focus:outline-none focus:border-brand-500 text-sm disabled:bg-neutral-50 disabled:text-neutral-400"
                  placeholder="billing@company.com"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-muted mb-1 tracking-widest">GSTIN / Tax ID</label>
                <input
                  type="text"
                  disabled={isProfileLocked}
                  value={editingProfile.gstin || ''}
                  onChange={e => setEditingProfile(prev => prev ? { ...prev, gstin: e.target.value } : null)}
                  className="w-full rounded-lg px-4 py-2.5 border border-neutral-200 text-ink-900 focus:outline-none focus:border-brand-500 text-sm disabled:bg-neutral-50 disabled:text-neutral-400"
                  placeholder="GSTIN 1234..."
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-muted mb-1 tracking-widest">Street Address</label>
                <input
                  type="text"
                  disabled={isProfileLocked}
                  value={editingProfile.address || ''}
                  onChange={e => setEditingProfile(prev => prev ? { ...prev, address: e.target.value } : null)}
                  className="w-full rounded-lg px-4 py-2.5 border border-neutral-200 text-ink-900 focus:outline-none focus:border-brand-500 text-sm disabled:bg-neutral-50 disabled:text-neutral-400"
                  placeholder="123 Business Rd"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs uppercase font-bold text-muted mb-1 tracking-widest">City</label>
                  <input
                    type="text"
                    disabled={isProfileLocked}
                    value={editingProfile.city || ''}
                    onChange={e => setEditingProfile(prev => prev ? { ...prev, city: e.target.value } : null)}
                    className="w-full rounded-lg px-4 py-2.5 border border-neutral-200 text-ink-900 focus:outline-none focus:border-brand-500 text-sm disabled:bg-neutral-50 disabled:text-neutral-400"
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-bold text-muted mb-1 tracking-widest">State</label>
                  <input
                    type="text"
                    disabled={isProfileLocked}
                    value={editingProfile.state || ''}
                    onChange={e => setEditingProfile(prev => prev ? { ...prev, state: e.target.value } : null)}
                    className="w-full rounded-lg px-4 py-2.5 border border-neutral-200 text-ink-900 focus:outline-none focus:border-brand-500 text-sm disabled:bg-neutral-50 disabled:text-neutral-400"
                    placeholder="State"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs uppercase font-bold text-muted mb-1 tracking-widest">Zip Code</label>
                  <input
                    type="text"
                    disabled={isProfileLocked}
                    value={editingProfile.zip || ''}
                    onChange={e => setEditingProfile(prev => prev ? { ...prev, zip: e.target.value } : null)}
                    className="w-full rounded-lg px-4 py-2.5 border border-neutral-200 text-ink-900 focus:outline-none focus:border-brand-500 text-sm disabled:bg-neutral-50 disabled:text-neutral-400"
                    placeholder="Zip"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-bold text-muted mb-1 tracking-widest">Country</label>
                  <input
                    type="text"
                    disabled={isProfileLocked}
                    value={editingProfile.country || ''}
                    onChange={e => setEditingProfile(prev => prev ? { ...prev, country: e.target.value } : null)}
                    className="w-full rounded-lg px-4 py-2.5 border border-neutral-200 text-ink-900 focus:outline-none focus:border-brand-500 text-sm disabled:bg-neutral-50 disabled:text-neutral-400"
                    placeholder="India"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-ink-100 pt-4">
            <h5 className="font-bold text-xs uppercase text-ink-500 mb-3 tracking-widest">Bank Details (Optional)</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase font-bold text-muted mb-1 tracking-widest">Bank Name</label>
                <input
                  type="text"
                  disabled={isProfileLocked}
                  value={editingProfile.bankName || ''}
                  onChange={e => setEditingProfile(prev => prev ? { ...prev, bankName: e.target.value } : null)}
                  className="w-full rounded-lg px-4 py-2.5 border border-neutral-200 text-ink-900 focus:outline-none focus:border-brand-500 text-sm disabled:bg-neutral-50 disabled:text-neutral-400"
                  placeholder="e.g. HDFC Bank"
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-muted mb-1 tracking-widest">Account Number</label>
                <input
                  type="text"
                  disabled={isProfileLocked}
                  value={editingProfile.accountNo || ''}
                  onChange={e => setEditingProfile(prev => prev ? { ...prev, accountNo: e.target.value } : null)}
                  className="w-full rounded-lg px-4 py-2.5 border border-neutral-200 text-ink-900 focus:outline-none focus:border-brand-500 text-sm disabled:bg-neutral-50 disabled:text-neutral-400"
                  placeholder="50100..."
                />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-muted mb-1 tracking-widest">IFSC / SWIFT Code</label>
                <input
                  type="text"
                  disabled={isProfileLocked}
                  value={editingProfile.ifsc || ''}
                  onChange={e => setEditingProfile(prev => prev ? { ...prev, ifsc: e.target.value } : null)}
                  className="w-full rounded-lg px-4 py-2.5 border border-neutral-200 text-ink-900 focus:outline-none focus:border-brand-500 text-sm disabled:bg-neutral-50 disabled:text-neutral-400"
                  placeholder="HDFC0001234"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-ink-100 pt-4 mt-6">
            <h5 className="font-bold text-xs uppercase text-ink-500 mb-3 tracking-widest">Other Payment Methods</h5>
            <PaymentMethodManager 
              methods={editingProfile.methods || []} 
              onChange={methods => setEditingProfile(prev => prev ? { ...prev, methods } : null)}
              disabled={isProfileLocked}
            />
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <BusinessTable
            businesses={activeBusinesses}
            onEdit={handleOpenEdit}
            onDelete={handleDelete}
          />
        </div>
      )}
    </section>
  );
}
