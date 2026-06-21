'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { BusinessProfile } from '@/components/dashboard/BusinessProfilesSection';
import LockedFeatureOverlay from '@/components/ui/LockedFeatureOverlay';
import { ChevronDown, Building2, Lock, Settings, Search } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import InvoPilotBusinessProfilesModal from '@/components/dashboard/InvoPilotBusinessProfilesModal';

interface Props {
  businesses: BusinessProfile[];
  isLocked: boolean;
  profile?: any;
  userId?: string;
  maxBusinesses?: number | 'unlimited';
  canUploadLogo?: boolean;
  activeWorkspace?: any;
}

export default function BusinessProfileDropdown({ 
  businesses, 
  isLocked,
  profile,
  userId,
  maxBusinesses = 1,
  canUploadLogo = false,
  activeWorkspace
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentBusiness = searchParams.get('business');
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (name: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (name) {
      params.set('business', name);
    } else {
      params.delete('business');
    }
    setIsOpen(false);
    router.push(`/dashboard?${params.toString()}`);
  };

  const selectedName = currentBusiness || 'All Businesses';

  const filteredBusinesses = businesses.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-ink-200 rounded-xl shadow-sm hover:bg-ink-50 transition-colors"
      >
        <Building2 className="w-4 h-4 text-ink-500" />
        <span className="font-medium text-ink-900 text-sm">{selectedName}</span>
        {isLocked ? (
          <Lock className="w-3.5 h-3.5 text-amber-500 ml-1" />
        ) : (
          <ChevronDown className="w-4 h-4 text-ink-500 ml-1" />
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 w-56 bg-white border border-ink-100 rounded-xl shadow-xl z-[150] overflow-hidden">
          {isLocked ? (
            <div className="relative p-1">
              <LockedFeatureOverlay 
                featureName="Multi-business filtering"
                compact
              />
              <div className="opacity-30 pointer-events-none">
                <div className="px-4 py-2 text-sm text-ink-700 bg-ink-50">All Businesses</div>
                <div className="px-4 py-2 text-sm text-ink-700">Business A</div>
                <div className="px-4 py-2 text-sm text-ink-700">Business B</div>
              </div>
            </div>
          ) : (
            <div className="py-1">
              <div className="px-3 pb-2 pt-1 border-b border-ink-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
                  <input
                    type="text"
                    placeholder="Search businesses..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-ink-50 border border-ink-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <button
                  onClick={() => handleSelect(null)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-ink-50 transition-colors ${!currentBusiness ? 'bg-brand-50 text-brand-700 font-medium' : 'text-ink-700'}`}
                >
                  All Businesses
                </button>
                {filteredBusinesses.map((biz) => (
                  <button
                    key={biz.id}
                    onClick={() => handleSelect(biz.name)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-ink-50 transition-colors ${currentBusiness === biz.name ? 'bg-brand-50 text-brand-700 font-medium' : 'text-ink-700'}`}
                  >
                    {biz.name}
                  </button>
                ))}
                {filteredBusinesses.length === 0 && (
                  <div className="px-4 py-3 text-xs text-center text-ink-400">
                    No businesses found
                  </div>
                )}
              </div>
              {userId && profile && (
                <>
                  <div className="border-t border-ink-100 my-1" />
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setIsModalOpen(true);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-bold text-brand-600 hover:text-brand-700 hover:bg-brand-50/50 transition-colors flex items-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Manage Profiles
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {userId && profile && (
        <InvoPilotBusinessProfilesModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          profile={profile}
          userId={userId}
          maxBusinesses={maxBusinesses}
          canUploadLogo={canUploadLogo}
          activeWorkspace={activeWorkspace}
        />
      )}
    </div>
  );
}
