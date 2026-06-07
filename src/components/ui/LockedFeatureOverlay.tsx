import { Lock } from 'lucide-react';
import Link from 'next/link';

interface Props {
  featureName?: string;
  compact?: boolean;
}

export default function LockedFeatureOverlay({ featureName = 'This feature', compact = false }: Props) {
  return (
    <div className="absolute inset-0 z-40 backdrop-blur-md bg-white/40 flex flex-col items-center justify-center rounded-[inherit] min-h-[120px]">
      <div className={`flex flex-col items-center text-center px-4 ${compact ? 'py-2' : 'py-6'} bg-white/80 rounded-2xl shadow-sm border border-ink-100`}>
        <div className={`${compact ? 'w-8 h-8' : 'w-12 h-12'} bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-2`}>
          <Lock className={compact ? 'w-4 h-4' : 'w-6 h-6'} />
        </div>
        <h3 className={`${compact ? 'text-sm' : 'text-lg'} font-bold text-ink-900 mb-1`}>
          {compact ? 'Locked' : `${featureName} is locked`}
        </h3>
        {!compact && (
          <p className="text-sm text-ink-500 mb-4 max-w-[200px]">
            Upgrade to Pro to unlock {featureName.toLowerCase()}.
          </p>
        )}
        <Link 
          href="/pricing" 
          className={`font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors rounded-xl ${compact ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm'}`}
        >
          Upgrade
        </Link>
      </div>
    </div>
  );
}
