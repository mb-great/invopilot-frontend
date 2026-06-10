'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Building, User } from 'lucide-react';

interface WorkspaceSwitcherProps {
  workspaces: any[];
  activeWorkspaceId: string;
}

export default function WorkspaceSwitcher({ workspaces, activeWorkspaceId }: WorkspaceSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (workspaceId: string) => {
    document.cookie = `invopilot_active_workspace=${workspaceId}; path=/; max-age=31536000`; // 1 year
    setIsOpen(false);
    // Remove the ?business= filter when switching workspaces since businesses belong to workspaces
    const url = new URL(window.location.href);
    url.searchParams.delete('business');
    router.push(url.pathname + url.search);
    router.refresh();
  };

  if (!workspaces || workspaces.length === 0) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-ink-200 rounded-lg shadow-sm hover:bg-ink-50 transition-colors"
      >
        {activeWorkspace?.owner_id ? <User className="w-4 h-4 text-ink-500" /> : <Building className="w-4 h-4 text-ink-500" />}
        <span className="text-sm font-bold text-ink-900 truncate max-w-[150px]">
          {activeWorkspace?.displayName || activeWorkspace?.name || 'Workspace'}
        </span>
        <ChevronDown className={`w-4 h-4 text-ink-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-ink-150 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-ink-100 bg-ink-50/50">
            <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">Switch Workspace</span>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSelect(ws.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${
                  activeWorkspaceId === ws.id ? 'bg-brand-50 text-brand-900' : 'hover:bg-ink-50 text-ink-700'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {ws.owner_id ? <User className="w-4 h-4 text-ink-400 shrink-0" /> : <Building className="w-4 h-4 text-ink-400 shrink-0" />}
                  <span className="text-sm font-medium truncate">{ws.displayName || ws.name}</span>
                </div>
                {activeWorkspaceId === ws.id && <Check className="w-4 h-4 text-brand-600 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
