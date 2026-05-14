'use client';

export interface InvoiceFormData {
  nickname: string;
  clientName: string;
  clientEmail: string;
  amount: string;
  description: string;
  currency: string;
}

interface InvoiceFormProps {
  data: InvoiceFormData;
  onChange: (data: InvoiceFormData) => void;
  onGenerate: () => void;
  status: 'idle' | 'loading' | 'error';
}

export default function InvoiceForm({ data, onChange, onGenerate, status }: InvoiceFormProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange({ ...data, [e.target.name]: e.target.value });
  };

  return (
    <div className="glass-card p-8">
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <span className="text-accent">01</span> Invoice Details
      </h3>
      
      <div className="space-y-6">
        <div>
          <label className="block text-xs uppercase font-bold text-muted mb-2 tracking-widest">Invoice Nickname</label>
          <input 
            type="text" 
            name="nickname"
            value={data.nickname}
            onChange={handleChange}
            placeholder="e.g. Acme Corp - March 2024"
            className="w-full bg-white/5 border border-border rounded-lg px-4 py-3 text-text focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase font-bold text-muted mb-2 tracking-widest">Client Name</label>
            <input 
              type="text" 
              name="clientName"
              value={data.clientName}
              onChange={handleChange}
              className="w-full bg-white/5 border border-border rounded-lg px-4 py-3 text-text focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs uppercase font-bold text-muted mb-2 tracking-widest">Client Email</label>
            <input 
              type="email" 
              name="clientEmail"
              value={data.clientEmail}
              onChange={handleChange}
              className="w-full bg-white/5 border border-border rounded-lg px-4 py-3 text-text focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs uppercase font-bold text-muted mb-2 tracking-widest">Amount</label>
            <input 
              type="number" 
              name="amount"
              value={data.amount}
              onChange={handleChange}
              className="w-full bg-white/5 border border-border rounded-lg px-4 py-3 text-text focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase font-bold text-muted mb-2 tracking-widest">Description</label>
          <textarea 
            rows={4}
            name="description"
            value={data.description}
            onChange={handleChange}
            className="w-full bg-white/5 border border-border rounded-lg px-4 py-3 text-text focus:outline-none focus:border-accent transition-colors resize-none"
          ></textarea>
        </div>

        {status === 'error' && (
          <div className="text-red-400 text-sm bg-red-500/10 p-3 rounded">
            Failed to generate invoice. Please try again.
          </div>
        )}

        <button 
          onClick={onGenerate}
          disabled={status === 'loading'}
          className="btn-accent w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'loading' ? 'Generating...' : 'Generate PDF'}
        </button>
      </div>
    </div>
  );
}
