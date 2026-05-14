export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl">
      <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h3 className="text-xl font-semibold mb-2">No invoices yet</h3>
      <p className="text-muted mb-6 text-center max-w-sm">
        Generate your first invoice to see it here. History is kept for 30 days.
      </p>
      <button className="btn-accent">New Invoice</button>
    </div>
  );
}
