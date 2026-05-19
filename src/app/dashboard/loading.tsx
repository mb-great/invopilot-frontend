import { Skeleton } from '@/components/ui/Skeleton'

export default function DashboardLoading() {
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
          <div className="max-w-[1440px] mx-auto space-y-10">
            {/* Header Skeleton */}
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <Skeleton className="h-12 w-64 md:w-80 rounded-lg" />
                <Skeleton className="h-5 w-48 md:w-64" />
              </div>
              <Skeleton className="h-12 w-36 rounded-xl" />
            </div>

            {/* Stats Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-2xl border border-ink-100 bg-white" />
              ))}
            </div>

            {/* Table Area Skeleton */}
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-ink-100 flex justify-between">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <div className="p-6 space-y-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="flex gap-4">
                        <Skeleton className="h-4 w-8" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-8">
                <Skeleton className="h-48 w-full rounded-2xl" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
