'use client';

import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface Props {
  title: string;
  content: React.ReactNode;
}

export default function HelpPopover({ title, content }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-ink-400 hover:text-brand-500 transition-colors p-1 rounded-full hover:bg-brand-50 flex items-center justify-center"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-64 p-4 bg-ink-900 text-white rounded-xl shadow-xl border border-ink-800 text-sm">
          {/* Arrow */}
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-ink-900 border-t border-l border-ink-800 transform rotate-45"></div>
          <button 
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2 p-1 text-ink-400 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <h4 className="font-bold text-white mb-1.5 pr-4">{title}</h4>
          <div className="text-ink-200 text-xs leading-relaxed">
            {content}
          </div>
        </div>
      )}
    </div>
  );
}
