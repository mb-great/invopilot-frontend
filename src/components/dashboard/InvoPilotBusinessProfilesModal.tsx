'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import BusinessProfilesSection from './BusinessProfilesSection';

interface InvoPilotBusinessProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  userId: string;
  maxBusinesses: number | 'unlimited';
  canUploadLogo: boolean;
  activeWorkspace?: any;
}

export default function InvoPilotBusinessProfilesModal({
  isOpen,
  onClose,
  profile,
  userId,
  maxBusinesses,
  canUploadLogo,
  activeWorkspace
}: InvoPilotBusinessProfilesModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Container */}
      <div 
        ref={modalRef}
        className="relative bg-white rounded-2xl shadow-2xl border border-ink-150 w-full max-w-4xl max-h-[85vh] flex flex-col z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-ink-100 shrink-0 bg-ink-50/20">
          <div>
            <h3 className="font-bold text-lg text-ink-900 flex items-center gap-2">
              Manage Business Profiles
              {activeWorkspace?.name && (
                <span className="text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                  {activeWorkspace.name}
                </span>
              )}
            </h3>
            <p className="text-xs text-ink-400 font-medium">Configure multiple sender profiles and details for this workspace</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-ink-400 hover:text-ink-900 hover:bg-ink-100/50 rounded-xl transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <BusinessProfilesSection 
            profile={profile}
            userId={userId}
            maxBusinesses={maxBusinesses}
            canUploadLogo={canUploadLogo}
            isModal={true}
            activeWorkspace={activeWorkspace}
          />
        </div>
      </div>
    </div>
  );
}
