'use client';

import React, { useState } from 'react';
import { saveRecurringTemplate, deleteRecurringTemplate } from './actions';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Edit2, Play, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { clearInvoiceDraft } from '@/lib/invoiceStorage';
import { toast } from 'sonner';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

type Template = {
  id: string;
  nickname: string;
  frequency: string;
  reminder_date: string;
  form_data: any;
  created_at: string;
};

type Invoice = {
  id: string;
  nickname: string;
  form_data: any;
  created_at: string;
};

interface Props {
  initialTemplates: Template[];
  invoices: Invoice[];
  maxAllowed: number;
}

export default function RecurringClient({ initialTemplates, invoices, maxAllowed }: Props) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [nickname, setNickname] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [reminderDate, setReminderDate] = useState('');

  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || !nickname || !frequency) return;
    
    setIsSubmitting(true);
    try {
      const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);
      if (!selectedInvoice) throw new Error('Invoice not found');
      
      const newTemplate = await saveRecurringTemplate({
        nickname,
        form_data: selectedInvoice.form_data,
        frequency,
        reminder_date: reminderDate
      });
      
      setTemplates([newTemplate, ...templates]);
      setIsModalOpen(false);
      setNickname('');
      setFrequency('monthly');
      setReminderDate('');
      setSelectedInvoiceId('');
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) return;
    try {
      await deleteRecurringTemplate(deleteModal.id);
      setTemplates(templates.filter(t => t.id !== deleteModal.id));
      setDeleteModal({ isOpen: false, id: null });
      router.refresh();
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  const handleGenerateInvoice = (template: Template) => {
    // Save the template form data into localStorage and push to /invoices/new
    if (typeof window !== 'undefined') {
      clearInvoiceDraft();
      
      const data = template.form_data;
      if (data) {
        // Iterate through all the keys in form_data and save to localStorage
        Object.keys(data).forEach(key => {
          // Skip dates so they default to current when generating a new invoice
          if (key === 'issueDate' || key === 'dueDate') return;
          
          if (typeof data[key] === 'string') {
            localStorage.setItem(key, data[key]);
          } else if (data[key] !== null && data[key] !== undefined) {
            localStorage.setItem(key, JSON.stringify(data[key]));
          }
        });
        
        // Ensure items is stringified since it's an array/object
        if (data.items) {
          localStorage.setItem('items', JSON.stringify(data.items));
        }
        
        // Default to step 1 so they can edit
        localStorage.setItem('step', '1');
      }
      
      router.push('/invoices/new');
    }
  };

  const isLimitReached = maxAllowed !== Infinity && templates.length >= maxAllowed;

  return (
    <div>
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="Delete Template"
        message="Are you sure you want to delete this recurring template? This action cannot be undone."
        confirmLabel="Delete Template"
        isDestructive={true}
        requirePassword={false}
      />

      <div className="flex justify-between items-center mb-6">
        <div>
          <span className="text-sm font-medium text-ink-500">
            {templates.length} {maxAllowed !== Infinity ? `/ ${maxAllowed}` : ''} Templates Used
          </span>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          disabled={isLimitReached}
          className={`flex items-center gap-2 px-4 py-2 font-bold rounded-xl transition-colors ${
            isLimitReached 
            ? 'bg-ink-100 text-ink-400 cursor-not-allowed' 
            : 'bg-brand-500 text-white hover:bg-brand-600'
          }`}
        >
          <Plus className="w-4 h-4" />
          Create Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map(template => (
          <div key={template.id} className="glass-card p-6 flex flex-col group hover:border-brand-300 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-lg text-ink-900 group-hover:text-brand-600 transition-colors">{template.nickname}</h3>
                <div className="flex items-center gap-2 mt-2 text-xs font-medium text-ink-500 uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{template.frequency}</span>
                  {template.reminder_date && <span>• {template.reminder_date}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setDeleteModal({ isOpen: true, id: template.id })}
                  className="p-1.5 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-auto pt-6">
              <button 
                onClick={() => handleGenerateInvoice(template)}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-ink-50 hover:bg-brand-50 text-ink-700 hover:text-brand-700 font-bold rounded-xl transition-colors border border-transparent hover:border-brand-200"
              >
                <Play className="w-4 h-4" />
                Generate Invoice
              </button>
            </div>
          </div>
        ))}

        {templates.length === 0 && (
          <div className="col-span-full py-20 text-center text-ink-500 glass-card">
            <p>No recurring templates created yet.</p>
            <p className="text-sm mt-2">Create one to quickly generate your regular invoices.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-ink-900 mb-6">New Template</h2>
            
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-ink-700 mb-2">Base Invoice</label>
                <select 
                  required
                  value={selectedInvoiceId} 
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="w-full p-3 rounded-xl border border-ink-200 bg-ink-50 focus:bg-white focus:border-brand-500 outline-none"
                >
                  <option value="">Select a previous invoice...</option>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.nickname} ({format(new Date(inv.created_at), 'MMM d, yyyy')})
                    </option>
                  ))}
                </select>
                {invoices.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2 font-medium">You need at least one saved invoice to create a template.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-ink-700 mb-2">Template Nickname</label>
                <input 
                  type="text" 
                  required
                  value={nickname} 
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Monthly Retainer - Acme Corp"
                  className="w-full p-3 rounded-xl border border-ink-200 bg-ink-50 focus:bg-white focus:border-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-ink-700 mb-2">Frequency</label>
                  <select 
                    value={frequency} 
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full p-3 rounded-xl border border-ink-200 bg-ink-50 focus:bg-white focus:border-brand-500 outline-none"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-ink-700 mb-2">Reminder Date (Optional)</label>
                  <input 
                    type="text" 
                    value={reminderDate} 
                    onChange={(e) => setReminderDate(e.target.value)}
                    placeholder="e.g. 1st of month"
                    className="w-full p-3 rounded-xl border border-ink-200 bg-ink-50 focus:bg-white focus:border-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-ink-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-bold text-ink-600 hover:bg-ink-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || invoices.length === 0}
                  className="px-5 py-2.5 text-sm font-bold bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
