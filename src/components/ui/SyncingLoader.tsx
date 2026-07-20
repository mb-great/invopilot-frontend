import { Loader2 } from 'lucide-react'

export default function SyncingLoader() {
  return (
    <div className="min-h-[100dvh] bg-ink-50 flex items-center justify-center flex-col gap-4 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes zoom-out-in {
          0% { transform: scale(1.1); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-zoom-out {
          animation: zoom-out-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />

      <div className="animate-zoom-out flex flex-col items-center gap-6">
        <div className="flex items-center gap-2">
          <img src="/logo.webp" alt="InvoPilot Logo" className="w-12 h-12 object-contain drop-shadow-sm" />
          <span className="font-bold text-2xl tracking-tight text-ink-900">InvoPilot</span>
        </div>

        <div className="flex items-center gap-3 bg-white px-8 py-4 rounded-2xl shadow-xl border border-ink-100">
          <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
          <span className="text-ink-600 font-bold tracking-tight">Syncing session...</span>
        </div>
      </div>
    </div>
  )
}
