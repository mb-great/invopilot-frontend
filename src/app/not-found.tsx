export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-ink-50 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-black text-ink-900 mb-4">404</h1>
        <p className="text-ink-500 mb-6">This page doesn&apos;t exist.</p>
        <a
          href="/dashboard"
          className="bg-brand-500 hover:bg-brand-600 text-white font-bold py-3 px-6 rounded-xl transition-colors inline-block"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
