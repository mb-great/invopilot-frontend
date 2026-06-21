'use client';

import React, { useState, useRef, useEffect } from 'react';
import { saveRecurringTemplate, deleteRecurringTemplate, updateRecurringTemplate } from './actions';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Edit2, Play, Calendar, Search, ChevronDown } from 'lucide-react';
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

const getNextDate = (currentDateStr: string, frequency: string) => {
  if (!currentDateStr) return null;
  const d = new Date(currentDateStr);
  if (isNaN(d.getTime())) return null;
  switch (frequency) {
    case 'daily': d.setDate(d.getDate() + 1); break;
    case 'weekly': d.setDate(d.getDate() + 7); break;
    case 'monthly': d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split('T')[0];
};

export default function RecurringClient({ initialTemplates, invoices, maxAllowed }: Props) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  
  const [nickname, setNickname] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [reminderDate, setReminderDate] = useState('');

  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openCreateModal = () => {
    setEditingTemplateId(null);
    setSelectedInvoiceId('');
    setSearchQuery('');
    setNickname('');
    setFrequency('monthly');
    setReminderDate('');
    setIsModalOpen(true);
  };

  const openEditModal = (template: Template) => {
    setEditingTemplateId(template.id);
    setNickname(template.nickname);
    setFrequency(template.frequency);
    setReminderDate(template.reminder_date || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname || !frequency) return;
    
    setIsSubmitting(true);
    try {
      if (editingTemplateId) {
        const updated = await updateRecurringTemplate(editingTemplateId, {
          nickname,
          frequency,
          reminder_date: reminderDate || null
        });
        setTemplates(templates.map(t => t.id === editingTemplateId ? { ...t, ...updated } : t));
        toast.success('Template updated successfully');
      } else {
        if (!selectedInvoiceId) throw new Error('Please select a base invoice');
        const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);
        if (!selectedInvoice) throw new Error('Invoice not found');
        
        const newTemplate = await saveRecurringTemplate({
          nickname,
          form_data: selectedInvoice.form_data,
          frequency,
          reminder_date: reminderDate || ''
        });
        setTemplates([newTemplate, ...templates]);
        toast.success('Template created successfully');
      }
      setIsModalOpen(false);
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
      toast.success('Template deleted');
      router.refresh();
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  const handleGenerateInvoice = async (template: Template) => {
    // Optimistically roll date forward if it exists
    if (template.reminder_date) {
      const nextDate = getNextDate(template.reminder_date, template.frequency);
      if (nextDate) {
        try {
          await updateRecurringTemplate(template.id, { reminder_date: nextDate });
          setTemplates(templates.map(t => t.id === template.id ? { ...t, reminder_date: nextDate } : t));
          toast.success('Notification rolled forward to next cycle.');
        } catch (e) {
          console.error("Failed to auto-roll date", e);
        }
      }
    }

    if (typeof window !== 'undefined') {
      clearInvoiceDraft();
      
      const data = template.form_data;
      if (data) {
        Object.keys(data).forEach(key => {
          if (key === 'issueDate' || key === 'dueDate') return;
          if (typeof data[key] === 'string') {
            localStorage.setItem(key, data[key]);
          } else if (data[key] !== null && data[key] !== undefined) {
            localStorage.setItem(key, JSON.stringify(data[key]));
          }
        });
        
        if (data.items) {
          localStorage.setItem('items', JSON.stringify(data.items));
        }
        localStorage.setItem('step', '1');
      }
      router.push('/invoices/new');
    }
  };

  const isLimitReached = maxAllowed !== Infinity && templates.length >= maxAllowed;
  const filteredInvoices = invoices.filter(inv => 
    inv.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    inv.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          onClick={openCreateModal}
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

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/50">
                <th className="p-4 text-xs font-bold text-ink-500 uppercase tracking-wider">Nickname</th>
                <th className="p-4 text-xs font-bold text-ink-500 uppercase tracking-wider">Frequency</th>
                <th className="p-4 text-xs font-bold text-ink-500 uppercase tracking-wider">Next Notification</th>
                <th className="p-4 text-xs font-bold text-ink-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-ink-500">
                    No recurring templates created yet. Create one to quickly generate your regular invoices.
                  </td>
                </tr>
              ) : (
                templates.map(template => (
                  <tr key={template.id} className="hover:bg-ink-50/50 transition-colors group">
                    <td className="p-4">
                      <div className="font-bold text-ink-900">{template.nickname}</div>
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-ink-100 text-ink-600 text-xs font-bold uppercase tracking-wide">
                        <Calendar className="w-3 h-3" />
                        {template.frequency}
                      </span>
                    </td>
                    <td className="p-4">
                      {(() => {
                        if (!template.reminder_date) {
                          return <span className="text-sm text-ink-400 italic">Not set</span>;
                        }
                        // Force parsing as noon to prevent timezone date shifting across the globe
                        const d = new Date(template.reminder_date.includes('T') ? template.reminder_date : `${template.reminder_date}T12:00:00`);
                        if (isNaN(d.getTime())) {
                          return <span className="text-sm font-medium text-ink-600">{template.reminder_date}</span>;
                        }
                        return (
                          <span className={`text-sm font-medium ${d <= new Date() ? 'text-amber-600 font-bold' : 'text-ink-600'}`}>
                            {format(d, 'MMM d, yyyy')}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => openEditModal(template)}
                          title="Edit Schedule"
                          className="p-2 text-ink-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleGenerateInvoice(template)}
                          title="Generate Invoice Now"
                          className="p-2 text-brand-600 hover:text-white hover:bg-brand-500 rounded-lg transition-colors"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDeleteModal({ isOpen: true, id: template.id })}
                          title="Delete Template"
                          className="p-2 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-ink-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-ink-900 mb-6">
              {editingTemplateId ? 'Edit Template' : 'New Template'}
            </h2>
            
            <form onSubmit={handleSave} className="space-y-5">
              {!editingTemplateId && (
                <div ref={dropdownRef} className="relative">
                  <label className="block text-sm font-bold text-ink-700 mb-2">Base Invoice</label>
                  <div 
                    className="flex items-center w-full p-3 rounded-xl border border-ink-200 bg-ink-50 cursor-pointer"
                    onClick={() => setShowDropdown(true)}
                  >
                    <Search className="w-4 h-4 text-ink-400 mr-2" />
                    <input 
                      type="text"
                      className="bg-transparent w-full outline-none text-sm"
                      placeholder="Search past invoices..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setShowDropdown(true);
                      }}
                    />
                    <ChevronDown className="w-4 h-4 text-ink-400 ml-2" />
                  </div>
                  
                  {showDropdown && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-ink-100 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                      {filteredInvoices.length > 0 ? (
                        filteredInvoices.map(inv => (
                          <div 
                            key={inv.id}
                            className={`p-3 text-sm cursor-pointer hover:bg-brand-50 transition-colors ${selectedInvoiceId === inv.id ? 'bg-brand-50 font-bold text-brand-700' : 'text-ink-700'}`}
                            onClick={() => {
                              setSelectedInvoiceId(inv.id);
                              setSearchQuery(inv.nickname);
                              setShowDropdown(false);
                            }}
                          >
                            {inv.nickname} <span className="text-ink-400 font-normal">({format(new Date(inv.created_at), 'MMM d, yyyy')})</span>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-sm text-ink-500 text-center">No invoices found.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-ink-700 mb-2">Template Nickname</label>
                <input 
                  type="text" 
                  required
                  value={nickname} 
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Monthly Retainer"
                  className="w-full p-3 rounded-xl border border-ink-200 bg-ink-50 focus:bg-white focus:border-brand-500 outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-ink-700 mb-2">Frequency</label>
                  <select 
                    value={frequency} 
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full p-3 rounded-xl border border-ink-200 bg-ink-50 focus:bg-white focus:border-brand-500 outline-none transition-colors"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-ink-700 mb-2">Next Notification</label>
                  <input 
                    type="date" 
                    value={reminderDate} 
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="w-full p-3 rounded-xl border border-ink-200 bg-ink-50 focus:bg-white focus:border-brand-500 outline-none transition-colors"
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
                  disabled={isSubmitting || (!editingTemplateId && !selectedInvoiceId)}
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
