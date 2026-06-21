'use client';

import { Download } from 'lucide-react';

type Props = {
  pdfUrl: string;
  invoiceNumber: string;
  slug: string;
};

export default function InvoiceViewer({ pdfUrl, invoiceNumber, slug }: Props) {
  const encodedFilename = encodeURIComponent(pdfUrl);
  const downloadUrl = `/view/${encodedFilename}/download`;

  return (
    <div className="h-[100dvh] flex flex-col bg-ink-50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-ink-200 shadow-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <img src="/logo.webp" alt="InvoPilot" className="w-7 h-7 object-contain" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-ink-900 truncate">{invoiceNumber}</h1>
            <p className="text-[10px] text-ink-400 uppercase tracking-wider">Shared Invoice</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={downloadUrl}
            className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-700 hover:bg-ink-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
        </div>
      </header>

      {/* PDF Viewer */}
      <div className="flex-1 min-h-0">
        <iframe
          src={`/api/share/${encodedFilename}`}
          className="w-full h-full border-0"
          title={invoiceNumber}
        />
      </div>
    </div>
  );
}
