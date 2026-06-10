import { Lock } from 'lucide-react';
import Link from 'next/link';

interface Props {
  featureName?: string;
  compact?: boolean;
}

export default function LockedFeatureOverlay({ featureName = 'This feature', compact = false }: Props) {
  if (compact) {
    return (
      <div className="absolute inset-0 z-40 backdrop-blur-md bg-white/95 flex flex-col items-center justify-center rounded-[inherit] p-4 text-center border-t border-ink-50 mt-1">
        <Lock className="w-5 h-5 text-amber-500 mb-2" />
        <h3 className="text-sm font-bold text-ink-900 mb-2">Locked Feature</h3>
        <Link 
          href="/pricing" 
          className="w-full font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors rounded-lg px-3 py-1.5 text-xs shadow-sm"
        >
          Upgrade Plan
        </Link>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-40 backdrop-blur-md bg-white/40 flex flex-col items-center justify-center rounded-[inherit] min-h-[120px]">
      <div className="flex flex-col items-center text-center px-4 py-6 bg-white/80 rounded-2xl shadow-sm border border-ink-100">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-2">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-ink-900 mb-1">
          {featureName} is locked
        </h3>
        <p className="text-sm text-ink-500 mb-4 max-w-[200px]">
          Upgrade to Pro to unlock {featureName.toLowerCase()}.
        </p>
        <Link 
          href="/pricing" 
          className="font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors rounded-xl px-5 py-2.5 text-sm"
        >
          Upgrade
        </Link>
      </div>
    </div>
  );
}
