import Link from 'next/link';
import { FileText } from 'lucide-react';

export default function EmptyState({ 
  title = 'No invoices yet',
  message = 'Start by creating your first invoice. Your data is stored securely and available whenever you need it.',
  href = '/invoices/new',
  buttonText = 'Create Invoice'
}: {
  title?: string;
  message?: string;
  href?: string;
  buttonText?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed border-ink-100 rounded-2xl bg-white/50">
      <div className="w-12 h-12 bg-ink-50 rounded-full flex items-center justify-center mb-4">
        <FileText className="w-6 h-6 text-ink-300" />
      </div>
      <h3 className="text-lg font-bold text-ink-900 mb-1">{title}</h3>
      <p className="text-ink-500 mb-6 text-center max-w-sm text-xs">
        {message}
      </p>
      <Link href={href} className="bg-brand-500 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-brand-600 transition-all shadow-xl shadow-brand-500/20 text-sm flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
        </svg>
        {buttonText}
      </Link>
    </div>
  );
}
