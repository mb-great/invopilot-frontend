'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('[GlobalError]', error);

  const isChunkLoadError =
    error.message?.includes('Loading chunk') ||
    error.message?.includes('load chunk') ||
    error.message?.includes('ChunkLoadError') ||
    error.name === 'ChunkLoadError';

  if (isChunkLoadError) {
    return (
      <div className="min-h-[100dvh] bg-ink-50 flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-4xl font-bold text-ink-900 mb-4">Update Available</h1>
          <p className="text-ink-500 mb-6">
            The app has been updated. Please hard refresh to load the latest version.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
          >
            Refresh Now
          </button>
          <p className="text-xs text-ink-400 mt-4">
            Tip: Press <kbd className="px-1.5 py-0.5 bg-ink-100 rounded text-ink-600 font-mono">Ctrl+Shift+R</kbd> (Windows) or <kbd className="px-1.5 py-0.5 bg-ink-100 rounded text-ink-600 font-mono">Cmd+Shift+R</kbd> (Mac) to hard refresh.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-ink-50 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold text-ink-900 mb-4">Something went wrong</h1>
        <p className="text-ink-500 mb-6">
          {error.message || 'An unexpected error occurred.'}
        </p>
        {error.digest && (
          <p className="text-xs text-ink-400 mb-6">Error ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
