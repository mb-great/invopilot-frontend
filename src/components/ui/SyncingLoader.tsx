import { Loader2 } from 'lucide-react'

export default function SyncingLoader() {
  return (
    <div className="min-h-[100dvh] bg-ink-50 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
    </div>
  )
}
