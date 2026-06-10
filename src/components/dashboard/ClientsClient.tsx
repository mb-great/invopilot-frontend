'use client';

import { useState } from 'react';
import { Plus, Edit2, Trash2, Check, X, ShieldAlert, Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import PremiumBadge from '@/components/ui/PremiumBadge';
import { saveClient, updateClient, deleteClient, dismissPotentialClient, dismissClientUpdate, dismissMultipleClientUpdates } from '@/app/dashboard/clients/actions';

type ClientRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  address: string | null;
  vat_gstin: string | null;
};

type ClientStats = {
  totalBilled: number;
  invoiceCount: number;
  paidCount: number;
  outstandingAmount: number;
  healthScore: number;
  currency: string;
  status: string;
};

type PotentialUpdate = {
  clientId: string;
  clientName: string;
  field: string;
  fieldName: string;
  oldVal: string;
  newVal: string;
  invoiceId: string;
  invoiceNumber: string;
};

type ClientsClientProps = {
  initialClients: ClientRow[];
  potentialClients: { name: string; email: string | null }[];
  potentialUpdates: PotentialUpdate[];
  billingStats: Record<string, ClientStats>;
  userTier: string;
  userId: string;
};

export default function ClientsClient({
  initialClients,
  potentialClients,
  potentialUpdates,
  billingStats,
  userTier,
  userId
}: ClientsClientProps) {
  const [clients, setClients] = useState<ClientRow[]>(initialClients);
  const [potentials, setPotentials] = useState(potentialClients);
  const [updates, setUpdates] = useState<PotentialUpdate[]>(potentialUpdates);
  const [selectedChoices, setSelectedChoices] = useState<Record<string, 'old' | 'new'>>({});
  
  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  
  // Form states
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [vatGstin, setVatGstin] = useState('');

  const isFree = userTier === 'free';
  const isStarter = userTier === 'starter';
  const clientLimit = isFree ? 5 : (isStarter ? 20 : Infinity);
  const reachedLimit = clients.length >= clientLimit;

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setCompanyName('');
    setAddress('');
    setVatGstin('');
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const handleOpenEdit = (client: ClientRow) => {
    setSelectedClient(client);
    setName(client.name);
    setEmail(client.email || '');
    setPhone(client.phone || '');
    setCompanyName(client.company_name || '');
    setAddress(client.address || '');
    setVatGstin(client.vat_gstin || '');
    setIsEditOpen(true);
  };

  const handleOpenDelete = (client: ClientRow) => {
    setSelectedClient(client);
    setIsDeleteOpen(true);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (reachedLimit) {
      toast.error(`Client limit reached. Upgrade to Pro/Business for unlimited clients.`);
      return;
    }

    setLoading(true);
    try {
      const newClient = await saveClient({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        company_name: companyName.trim() || null,
        address: address.trim() || null,
        vat_gstin: vatGstin.trim() || null,
      });

      setClients((prev) => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`Client "${name}" saved to Directory.`);
      setIsAddOpen(false);
      resetForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save client');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !name.trim()) return;

    setLoading(true);
    try {
      const updated = await updateClient(selectedClient.id, {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        company_name: companyName.trim() || null,
        address: address.trim() || null,
        vat_gstin: vatGstin.trim() || null,
      });

      setClients((prev) =>
        prev.map((c) => (c.id === selectedClient.id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name))
      );
      toast.success(`Client details updated.`);
      setIsEditOpen(false);
      setSelectedClient(null);
      resetForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update client');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!selectedClient) return;

    try {
      await deleteClient(selectedClient.id);
      setClients((prev) => prev.filter((c) => c.id !== selectedClient.id));
      toast.success(`Client "${selectedClient.name}" removed from Directory.`);
      setIsDeleteOpen(false);
      setSelectedClient(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete client');
    }
  };

  const handleSavePotential = async (potName: string, potEmail: string | null) => {
    if (reachedLimit) {
      toast.error(`Client limit reached (${clientLimit}). Upgrade to Pro/Business for unlimited clients.`);
      return;
    }

    try {
      const newClient = await saveClient({
        name: potName,
        email: potEmail,
      });

      setClients((prev) => [...prev, newClient].sort((a, b) => a.name.localeCompare(b.name)));
      setPotentials((prev) => prev.filter((p) => p.name !== potName));
      toast.success(`Saved "${potName}" to directory!`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save client');
    }
  };

  const handleDismissPotential = async (potName: string) => {
    try {
      await dismissPotentialClient(potName);
      setPotentials((prev) => prev.filter((p) => p.name !== potName));
      toast.success('Potential client suggestion dismissed.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to dismiss potential client');
    }
  };

  const getChoice = (clientId: string, field: string) => {
    const key = `${clientId}:${field}`;
    return selectedChoices[key] || 'new';
  };

  const setChoice = (clientId: string, field: string, choice: 'old' | 'new') => {
    const key = `${clientId}:${field}`;
    setSelectedChoices(prev => ({ ...prev, [key]: choice }));
  };

  const handleUpdateGroup = async (clientId: string, items: PotentialUpdate[]) => {
    const clientObj = clients.find(c => c.id === clientId);
    if (!clientObj) return;

    setLoading(true);
    try {
      const fieldMappings: Record<string, 'email' | 'company_name' | 'vat_gstin' | 'address'> = {
        email: 'email',
        company_name: 'company_name',
        vat_gstin: 'vat_gstin',
        address: 'address'
      };

      const updatedData = {
        name: clientObj.name,
        email: clientObj.email,
        phone: clientObj.phone,
        company_name: clientObj.company_name,
        address: clientObj.address,
        vat_gstin: clientObj.vat_gstin,
      };

      const dismissList: { clientId: string; field: string; newVal: string }[] = [];

      items.forEach(upd => {
        const choice = getChoice(clientId, upd.field);
        const col = fieldMappings[upd.field];
        if (col) {
          if (choice === 'new') {
            updatedData[col] = upd.newVal;
          } else {
            updatedData[col] = upd.oldVal === '—' ? null : upd.oldVal;
            dismissList.push({ clientId, field: upd.field, newVal: upd.newVal });
          }
        }
      });

      const updatedClient = await updateClient(clientId, updatedData);

      if (dismissList.length > 0) {
        await dismissMultipleClientUpdates(dismissList);
      }

      setClients(prev => prev.map(c => c.id === clientId ? updatedClient : c));
      setUpdates(prev => prev.filter(u => u.clientId !== clientId));
      toast.success(`Client details updated for ${clientObj.name}.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update client details');
    } finally {
      setLoading(false);
    }
  };

  const handleDismissGroup = async (clientId: string, items: PotentialUpdate[]) => {
    try {
      await dismissMultipleClientUpdates(items.map(upd => ({
        clientId,
        field: upd.field,
        newVal: upd.newVal
      })));
      setUpdates(prev => prev.filter(u => u.clientId !== clientId));
      toast.success('Suggestions dismissed.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to dismiss suggestions');
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <>
      <ConfirmationModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteClient}
        title="Delete client from directory?"
        message={`Are you sure you want to delete ${selectedClient?.name}? This will remove them from your client directory. Past invoices will not be modified.`}
        confirmLabel="Delete Client"
        isDestructive={true}
        requirePassword={false}
      />

      {/* Potential Clients Alert */}
      {potentials.length > 0 && (
        <div className="mb-6 bg-brand-50/70 border border-brand-100/50 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex gap-4">
            <div className="p-3 bg-brand-500/10 text-brand-600 rounded-xl">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="font-bold text-ink-900 text-lg">New Client suggestions found</h2>
              <p className="text-sm text-ink-500 mt-1 max-w-lg">
                We found unique client contacts in your recent invoices. Save them to your directory for 1-click invoice imports.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {potentials.map((pot) => (
                  <div
                    key={pot.name}
                    className="flex items-center gap-3 bg-white border border-ink-100 rounded-xl px-4 py-2 text-xs shadow-sm hover:border-brand-300 transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-ink-900">{pot.name}</span>
                      {pot.email && <span className="text-[10px] text-ink-400">{pot.email}</span>}
                    </div>
                    <div className="flex gap-1.5 ml-2 border-l pl-3 border-ink-100">
                      <button
                        onClick={() => handleSavePotential(pot.name, pot.email)}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                        title="Save to directory"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDismissPotential(pot.name)}
                        className="p-1 text-ink-400 hover:bg-ink-100 rounded-md transition-colors"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggested Updates Alert (Git Diff style comparison) */}
      {(() => {
        if (updates.length === 0) return null;

        // Group updates by client
        const groupedUpdatesMap: Record<string, {
          clientId: string;
          clientName: string;
          invoiceNumber: string;
          items: PotentialUpdate[];
        }> = {};

        updates.forEach((upd) => {
          if (!groupedUpdatesMap[upd.clientId]) {
            groupedUpdatesMap[upd.clientId] = {
              clientId: upd.clientId,
              clientName: upd.clientName,
              invoiceNumber: upd.invoiceNumber,
              items: [],
            };
          }
          groupedUpdatesMap[upd.clientId].items.push(upd);
        });

        const groups = Object.values(groupedUpdatesMap);

        return (
          <div className="mb-6 bg-amber-50/70 border border-amber-100/50 rounded-2xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex gap-4">
              <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl self-start">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-ink-900 text-lg">New client details detected</h2>
                <p className="text-sm text-ink-500 mt-1">
                  We detected different details in your recent invoices for saved clients. Compare and update your directory.
                </p>

                <div className="mt-4 space-y-4 max-w-4xl">
                  {groups.map((group) => (
                    <div
                      key={group.clientId}
                      className="bg-white border border-ink-150 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in duration-200"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ink-100 pb-3">
                        <div>
                          <span className="font-bold text-ink-900 text-base">{group.clientName}</span>
                          <span className="text-[10px] bg-amber-500/10 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded ml-2 font-medium">
                            New Details Available
                          </span>
                        </div>
                        <span className="text-[10px] text-ink-400 bg-ink-50 px-2.5 py-1 rounded-md border border-ink-100 self-start sm:self-auto">
                          Invoice: {group.invoiceNumber}
                        </span>
                      </div>

                      <div className="space-y-4">
                        {group.items.map((item) => {
                          const choice = getChoice(group.clientId, item.field);
                          return (
                            <div
                              key={item.field}
                              className="flex flex-col md:grid md:grid-cols-[120px_1fr] gap-2 md:gap-4 border-b border-ink-50 pb-4 last:border-b-0 last:pb-0"
                            >
                              <span className="text-xs font-bold text-ink-400 uppercase tracking-wider self-center md:py-2">
                                {item.fieldName}
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Current (Old) Value Option */}
                                <button
                                  type="button"
                                  onClick={() => setChoice(group.clientId, item.field, 'old')}
                                  className={`text-left p-3.5 rounded-xl border transition-all text-xs flex flex-col gap-1 relative overflow-hidden ${
                                    choice === 'old'
                                      ? 'bg-red-50/70 border-red-200 text-red-950 ring-2 ring-red-100/50'
                                      : 'bg-white border-ink-150 text-ink-400 hover:border-ink-200 hover:text-ink-600'
                                  }`}
                                >
                                  <span className={`text-[9px] font-bold uppercase tracking-wider block ${
                                    choice === 'old' ? 'text-red-600' : 'text-ink-400'
                                  }`}>
                                    Current Value (Keep)
                                  </span>
                                  <span className="font-medium break-all">{item.oldVal}</span>
                                </button>

                                {/* New Value Option */}
                                <button
                                  type="button"
                                  onClick={() => setChoice(group.clientId, item.field, 'new')}
                                  className={`text-left p-3.5 rounded-xl border transition-all text-xs flex flex-col gap-1 relative overflow-hidden ${
                                    choice === 'new'
                                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 ring-2 ring-emerald-100/50'
                                      : 'bg-white border-ink-150 text-ink-400 hover:border-ink-200 hover:text-ink-600'
                                  }`}
                                >
                                  <span className={`text-[9px] font-bold uppercase tracking-wider block ${
                                    choice === 'new' ? 'text-emerald-600' : 'text-ink-400'
                                  }`}>
                                    New Value (Update)
                                  </span>
                                  <span className="font-medium break-all">{item.newVal}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex gap-3 pt-3 border-t border-ink-100 justify-end">
                        <button
                          onClick={() => handleDismissGroup(group.clientId, group.items)}
                          className="flex items-center gap-1.5 px-4 h-10 border border-ink-200 hover:bg-ink-50 text-ink-500 font-bold text-xs rounded-xl transition-colors"
                          title="Dismiss Updates"
                        >
                          <X className="w-3.5 h-3.5" />
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleUpdateGroup(group.clientId, group.items)}
                          className="flex items-center gap-1.5 px-5 h-10 bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-brand-500/10"
                          title="Apply Selections"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Apply Selections
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Directory Title + Add Button */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 flex items-center gap-3">
            Clients
            <span className="text-xs bg-ink-100 text-ink-600 px-3 py-1 rounded-full font-medium">
              {clients.length} {clientLimit !== Infinity ? `/ ${clientLimit}` : ''} saved
            </span>
          </h1>
          <p className="text-ink-500 mt-1">Directory of clients derived from your invoice history.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 bg-brand-500 text-white hover:bg-brand-600 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-brand-500/10"
        >
          <Plus className="w-4 h-4" />
          <span>Add Client</span>
        </button>
      </div>

      {/* Directory Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto max-w-[90vw] md:max-w-full">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="text-ink-400 text-xs uppercase tracking-widest border-b border-ink-100 bg-ink-50/30">
                <th className="py-4 px-6 font-bold">Client Name</th>
                <th className="py-4 px-6 font-bold">Company / Tax ID</th>
                <th className="py-4 px-6 font-bold text-center">Total Billed</th>
                <th className="py-4 px-6 font-bold text-center">Invoices</th>
                <th className="py-4 px-6 font-bold text-right">Outstanding</th>
                <th className="py-4 px-6 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {clients.length > 0 ? (
                clients.map((client) => {
                  const stats = billingStats[client.name] || {
                    totalBilled: 0,
                    invoiceCount: 0,
                    paidCount: 0,
                    outstandingAmount: 0,
                    healthScore: 0,
                    currency: 'INR',
                    status: '—',
                  };

                  return (
                    <tr key={client.id} className="group hover:bg-ink-50/50 transition-colors">
                      <td className="py-5 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-ink-900">{client.name}</span>
                          <span className="text-xs text-ink-400">
                            {client.email || 'No email'} {client.phone ? `• ${client.phone}` : ''}
                          </span>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-ink-700">{client.company_name || '—'}</span>
                          {client.vat_gstin && (
                            <span className="text-[10px] bg-ink-50 border px-1.5 py-0.5 rounded text-ink-500 w-fit mt-0.5">
                              GSTIN: {client.vat_gstin}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-5 px-6 font-bold text-ink-900 text-center">
                        {stats.totalBilled > 0 ? formatCurrency(stats.totalBilled, stats.currency) : '—'}
                      </td>
                      <td className="py-5 px-6 text-center text-ink-500 font-medium">
                        {stats.invoiceCount > 0 ? stats.invoiceCount : '—'}
                      </td>
                      <td className="py-5 px-6 text-right font-medium text-ink-700">
                        {stats.outstandingAmount > 0 ? formatCurrency(stats.outstandingAmount, stats.currency) : '—'}
                      </td>
                      <td className="py-5 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(client)}
                            className="p-2 text-ink-400 hover:text-brand-500 hover:bg-brand-50 rounded-xl transition-all"
                            title="Edit Client"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(client)}
                            className="p-2 text-ink-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Delete Client"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-20 text-center italic text-ink-400 bg-white">
                    No clients saved in directory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Client Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white border border-ink-150 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-ink-100 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-ink-900">Add New Client</h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 hover:bg-ink-50 rounded-xl transition-colors text-ink-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddClient} className="flex-1 overflow-y-auto p-6 space-y-4">
              {reachedLimit && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs flex gap-2.5 items-start">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold flex items-center gap-1.5">
                      Limit Reached <PremiumBadge type="pro" />
                    </span>
                    You have reached the client directory limit ({clientLimit}) for your tier. Upgrade to unlock more slots.
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-400">Client Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp or Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 border border-ink-200 rounded-xl px-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-400">Client Email</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 border border-ink-200 rounded-xl px-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-400">Client Phone</label>
                  <input
                    type="text"
                    placeholder="+91 XXXXX XXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-11 border border-ink-200 rounded-xl px-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-400">Company Name</label>
                  <input
                    type="text"
                    placeholder="Legal Entity Name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full h-11 border border-ink-200 rounded-xl px-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-400">GSTIN / VAT ID</label>
                  <input
                    type="text"
                    placeholder="Tax Registration ID"
                    value={vatGstin}
                    onChange={(e) => setVatGstin(e.target.value)}
                    className="w-full h-11 border border-ink-200 rounded-xl px-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-400">Billing Address</label>
                <textarea
                  placeholder="Street details, City, State, Country, ZIP"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="w-full border border-ink-200 rounded-xl p-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                />
              </div>

              <div className="pt-4 border-t flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="h-11 border border-ink-200 hover:bg-ink-50 px-5 rounded-xl text-sm font-bold text-ink-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reachedLimit || loading}
                  className="h-11 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-6 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Save Client</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white border border-ink-150 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-ink-100 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-ink-900">Edit Client</h2>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1.5 hover:bg-ink-50 rounded-xl transition-colors text-ink-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditClient} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-400">Client Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Corp or Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 border border-ink-200 rounded-xl px-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-400">Client Email</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 border border-ink-200 rounded-xl px-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-400">Client Phone</label>
                  <input
                    type="text"
                    placeholder="+91 XXXXX XXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-11 border border-ink-200 rounded-xl px-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-400">Company Name</label>
                  <input
                    type="text"
                    placeholder="Legal Entity Name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full h-11 border border-ink-200 rounded-xl px-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-ink-400">GSTIN / VAT ID</label>
                  <input
                    type="text"
                    placeholder="Tax Registration ID"
                    value={vatGstin}
                    onChange={(e) => setVatGstin(e.target.value)}
                    className="w-full h-11 border border-ink-200 rounded-xl px-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-ink-400">Billing Address</label>
                <textarea
                  placeholder="Street details, City, State, Country, ZIP"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className="w-full border border-ink-200 rounded-xl p-4 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                />
              </div>

              <div className="pt-4 border-t flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="h-11 border border-ink-200 hover:bg-ink-50 px-5 rounded-xl text-sm font-bold text-ink-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-11 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-6 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
