'use client';

import React from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { useState } from 'react';
import { copyToClipboard } from '@/lib/clipboard';

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1/clients',
    description: 'Retrieve a paginated list of clients in your workspace.',
    response: `{
  "data": [
    {
      "id": "uuid",
      "name": "Acme Corp",
      "email": "billing@acme.com",
      "address": "123 Main St",
      "tax_id": "TAX-1234",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 50 }
}`
  },
  {
    method: 'POST',
    path: '/api/v1/clients',
    description: 'Create a new client programmatically.',
    body: `{
  "name": "Acme Corp",
  "email": "billing@acme.com",
  "address": "123 Main St",
  "tax_id": "TAX-1234"
}`,
    response: `{
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "email": "billing@acme.com",
    "address": "123 Main St",
    "tax_id": "TAX-1234",
    "created_at": "2024-01-01T00:00:00Z"
  }
}`
  },
  {
    method: 'GET',
    path: '/api/v1/invoices',
    description: 'Retrieve a paginated list of invoices with their PDF download links.',
    response: `{
  "data": [
    {
      "id": "uuid",
      "invoice_number": "INV-1001",
      "status": "paid",
      "amount": 1500,
      "currency": "USD",
      "pdf_download_url": "https://...",
      "view_url": "https://..."
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 50 }
}`
  },
  {
    method: 'POST',
    path: '/api/v1/invoices',
    description: 'Generate a new invoice. A background worker will automatically generate the PDF.',
    body: `{
  "client_name": "Acme Corp",
  "client_email": "billing@acme.com",
  "currency": "USD",
  "business_logo": "https://my-bucket/logo.png",
  "client_logo": "https://client-bucket/logo.png",
  "items": [
    { "name": "Web Design", "quantity": 1, "price": 1000 }
  ]
}`,
    response: `{
  "data": {
    "id": "uuid",
    "invoice_number": "INV-1002",
    "status": "draft",
    "created_at": "2024-01-01T00:00:00Z"
  }
}`
  },
  {
    method: 'GET',
    path: '/api/v1/invoices/csv',
    description: 'Export all your invoices to a CSV file (Streamed automatically).',
    response: `Invoice #,Client Name,Client Email,Amount...
INV-1001,Acme Corp,billing@acme.com,1500...`
  }
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mt-3 mb-5 group">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={handleCopy}
          className="p-1.5 bg-ink-800 hover:bg-ink-700 text-ink-300 rounded shadow-sm transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <pre className="p-4 bg-[#0d1117] text-[#c9d1d9] rounded-xl text-xs sm:text-sm font-mono overflow-x-auto border border-ink-800 shadow-inner">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function ApiDocsSection() {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002';

  return (
    <section className="glass-card bg-white border border-ink-100 shadow-sm mt-8">
      <div className="p-8 border-b border-ink-100">
        <div className="flex items-center gap-3 mb-2">
          <Terminal className="w-6 h-6 text-brand-500" />
          <h2 className="text-2xl font-bold text-ink-900 font-serif">API Documentation</h2>
        </div>
        <p className="text-ink-500">
          Integrate InvoPilot with your CRM, accounting software, or custom scripts. 
          All requests must include the <code className="bg-ink-100 text-ink-700 px-1.5 py-0.5 rounded text-sm">Authorization: Bearer YOUR_API_KEY</code> header.
        </p>
        
        <div className="mt-6 p-4 bg-brand-50 border border-brand-100 rounded-xl">
          <h4 className="font-semibold text-brand-900 mb-2">Base URL</h4>
          <code className="text-brand-700 font-mono text-sm">{baseUrl}</code>
        </div>
      </div>

      <div className="p-8 space-y-12">
        {ENDPOINTS.map((ep, idx) => (
          <div key={idx} className="pb-8 border-b border-ink-100 last:border-0 last:pb-0">
            <div className="flex items-center gap-3 mb-3">
              <span className={`px-2.5 py-1 text-xs font-bold rounded ${ep.method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                {ep.method}
              </span>
              <code className="text-base font-semibold font-mono text-ink-800">{ep.path}</code>
            </div>
            
            <p className="text-ink-600 mb-4">{ep.description}</p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {ep.body && (
                <div>
                  <h4 className="text-sm font-bold text-ink-400 uppercase tracking-wider mb-2">Request Body</h4>
                  <CodeBlock code={ep.body} />
                </div>
              )}
              <div className={!ep.body ? 'lg:col-span-2' : ''}>
                <h4 className="text-sm font-bold text-ink-400 uppercase tracking-wider mb-2">Example Response</h4>
                <CodeBlock code={ep.response} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
