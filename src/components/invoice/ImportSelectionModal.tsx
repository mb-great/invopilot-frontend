import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Search, FolderOpen, Inbox } from 'lucide-react';

export type ImportItem = {
  id: string;
  name: string; // The primary display name
  subtitle?: string; // Secondary info (e.g. email or company)
  icon?: string; // Emoji or icon string
  raw: any; // The raw data object
};

interface ImportSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: ImportItem[];
  onSelect: (item: any) => void;
  emptyStateMessage?: string;
}

export default function ImportSelectionModal({
  isOpen,
  onClose,
  title,
  items,
  onSelect,
  emptyStateMessage = "No items available to import.",
}: ImportSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const lowerQuery = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        (item.name || "").toLowerCase().includes(lowerQuery) ||
        (item.subtitle || "").toLowerCase().includes(lowerQuery)
    );
  }, [items, searchQuery]);

  // Reset search when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white border border-ink-150 shadow-xl rounded-2xl">
        <DialogHeader className="px-5 py-4 border-b border-ink-100 bg-ink-50">
          <DialogTitle className="text-lg font-bold text-ink-900 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-brand-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">Select an item to import</DialogDescription>
        </DialogHeader>

        <div className="p-3 border-b border-ink-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-ink-50 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors text-ink-900 placeholder:text-ink-400"
            />
          </div>
        </div>

        <div className="max-h-[300px] overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="px-4 py-8 flex flex-col items-center justify-center text-center">
              <Inbox className="w-8 h-8 text-ink-300 mb-3" />
              <p className="text-ink-500 font-medium text-sm">{emptyStateMessage}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="px-4 py-8 flex flex-col items-center justify-center text-center">
              <Search className="w-8 h-8 text-ink-300 mb-3" />
              <p className="text-ink-500 font-medium text-sm">No results found</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.raw)}
                  className="w-full text-left px-3 py-2.5 bg-white hover:bg-ink-50 transition-colors rounded-xl flex flex-col border border-transparent hover:border-ink-200"
                >
                  <span className="font-bold text-ink-900 flex items-center gap-2 text-sm">
                    {item.icon && <span>{item.icon}</span>}
                    {item.name || "Unnamed"}
                  </span>
                  {item.subtitle && (
                    <span className="text-xs font-medium text-ink-500 mt-0.5 truncate pl-7">
                      {item.subtitle}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
