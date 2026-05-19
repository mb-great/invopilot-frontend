import { Skeleton } from '@/components/ui/Skeleton'

export default function InvoicesLoading() {
  return (
    <div className="flex h-screen bg-ink-50 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes zoom-out-in {
          0% { transform: scale(1.05); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-zoom-out-page {
          animation: zoom-out-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />

      {/* Sidebar Skeleton */}
      <aside className="hidden lg:flex w-[280px] bg-white border-r border-ink-200 flex-col animate-zoom-out-page">
        <div className="px-6 py-8">
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </nav>
        <div className="p-6 border-t border-ink-200">
          <div className="flex items-center gap-3 mb-6">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <div className="flex-1 flex flex-col min-w-0 animate-zoom-out-page" style={{ animationDelay: '0.1s' }}>
        <main className="flex-1 overflow-auto p-6 md:p-10">
          <div className="max-w-[1440px] mx-auto space-y-8">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-10 w-48 rounded-lg" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-11 w-40 rounded-xl" />
            </div>

            {/* List Skeleton */}
            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
              <div className="p-8 space-y-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="flex items-center gap-6">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-8 w-24 rounded-lg" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
