'use client';

import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';

export default function ProfileForm({ 
  profile, 
  userEmail, 
  updateAction 
}: { 
  profile: any, 
  userEmail: string, 
  updateAction: (formData: FormData) => Promise<void> 
}) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <form action={async (formData) => {
      await updateAction(formData);
      setIsEditing(false);
    }} className="space-y-6">
      
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <span className="text-brand-500">01</span> Profile & Company
        </h3>
        
        {!isEditing ? (
          <button 
            type="button" 
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 text-brand-500 hover:text-brand-600 font-bold text-sm bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-lg transition-colors border border-brand-100"
          >
            <Pencil className="w-4 h-4" /> Edit Details
          </button>
        ) : (
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-2 text-ink-500 hover:text-ink-700 font-bold text-sm bg-ink-50 hover:bg-ink-100 px-4 py-2 rounded-lg transition-colors border border-ink-100"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
            <button 
              type="submit" 
              className="flex items-center gap-2 text-white font-bold text-sm bg-brand-500 hover:bg-brand-600 px-4 py-2 rounded-lg transition-colors shadow-lg shadow-brand-500/20"
            >
              <Check className="w-4 h-4" /> Save
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs uppercase font-bold text-muted mb-2 tracking-widest">Full Name</label>
          <input
            type="text"
            name="fullName"
            defaultValue={profile?.full_name || ''}
            disabled={!isEditing}
            className={`w-full rounded-lg px-4 py-3 text-ink-900 focus:outline-none transition-all ${
              isEditing 
                ? 'bg-white border border-brand-500 shadow-sm' 
                : 'bg-transparent border-transparent px-0 font-medium cursor-default'
            }`}
          />
        </div>
        <div>
          <label className="block text-xs uppercase font-bold text-muted mb-2 tracking-widest">Company Name</label>
          <input
            type="text"
            name="companyName"
            defaultValue={profile?.company_name || ''}
            disabled={!isEditing}
            className={`w-full rounded-lg px-4 py-3 text-ink-900 focus:outline-none transition-all ${
              isEditing 
                ? 'bg-white border border-brand-500 shadow-sm' 
                : 'bg-transparent border-transparent px-0 font-medium cursor-default'
            }`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs uppercase font-bold text-muted mb-2 tracking-widest">GSTIN / Tax ID</label>
          <input
            type="text"
            name="gstin"
            defaultValue={profile?.defaults?.gstin || ''}
            disabled={!isEditing}
            className={`w-full rounded-lg px-4 py-3 text-ink-900 focus:outline-none transition-all ${
              isEditing 
                ? 'bg-white border border-brand-500 shadow-sm' 
                : 'bg-transparent border-transparent px-0 font-medium cursor-default'
            }`}
          />
        </div>
        <div>
          <label className="block text-xs uppercase font-bold text-muted mb-2 tracking-widest">Bank Name</label>
          <input
            type="text"
            name="bankName"
            defaultValue={profile?.defaults?.bankName || ''}
            placeholder={isEditing ? "e.g. HDFC Bank" : "Not set"}
            disabled={!isEditing}
            className={`w-full rounded-lg px-4 py-3 text-ink-900 focus:outline-none transition-all ${
              isEditing 
                ? 'bg-white border border-brand-500 shadow-sm' 
                : 'bg-transparent border-transparent px-0 font-medium cursor-default'
            }`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs uppercase font-bold text-muted mb-2 tracking-widest">Account Number</label>
          <input
            type="text"
            name="accountNo"
            defaultValue={profile?.defaults?.accountNo || ''}
            placeholder={isEditing ? "e.g. 5010029..." : "Not set"}
            disabled={!isEditing}
            className={`w-full rounded-lg px-4 py-3 text-ink-900 focus:outline-none transition-all ${
              isEditing 
                ? 'bg-white border border-brand-500 shadow-sm' 
                : 'bg-transparent border-transparent px-0 font-medium cursor-default'
            }`}
          />
        </div>
        <div>
          <label className="block text-xs uppercase font-bold text-muted mb-2 tracking-widest">IFSC / Swift Code</label>
          <input
            type="text"
            name="ifsc"
            defaultValue={profile?.defaults?.ifsc || ''}
            placeholder={isEditing ? "e.g. HDFC0001234" : "Not set"}
            disabled={!isEditing}
            className={`w-full rounded-lg px-4 py-3 text-ink-900 focus:outline-none transition-all ${
              isEditing 
                ? 'bg-white border border-brand-500 shadow-sm' 
                : 'bg-transparent border-transparent px-0 font-medium cursor-default'
            }`}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase font-bold text-muted mb-2 tracking-widest">Account Email (Read-only)</label>
        <input
          type="text"
          disabled
          value={userEmail || ''}
          className="w-full bg-transparent border-transparent px-0 py-3 text-ink-400 font-medium cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-xs uppercase font-bold text-muted mb-2 tracking-widest">Company Address</label>
        <textarea
          rows={3}
          name="address"
          defaultValue={profile?.defaults?.address || ''}
          disabled={!isEditing}
          placeholder={isEditing ? "Enter your company address..." : "Not set"}
          className={`w-full rounded-lg px-4 py-3 text-ink-900 focus:outline-none transition-all resize-none ${
            isEditing 
              ? 'bg-white border border-brand-500 shadow-sm' 
              : 'bg-transparent border-transparent px-0 font-medium cursor-default'
          }`}
        ></textarea>
      </div>

    </form>
  );
}
